from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entities import Customer, Order, OrderItem, OrderStatus, User
from app.schemas.order import PHARMACY_PRODUCTS, OrderCreate, OrderImportItem
from app.services.phones import normalize_phone_key


async def generate_pharmacy_order_id(db: AsyncSession) -> str:
    result = await db.execute(select(func.count()).select_from(Order))
    count = int(result.scalar_one() or 0) + 1
    while True:
        code = f"MSG{count:06d}"
        exists = await db.execute(select(Order.id).where(Order.external_order_id == code))
        if exists.scalar_one_or_none() is None:
            return code
        count += 1


async def resolve_customer_by_phone(db: AsyncSession, phone: str) -> Customer | None:
    key = normalize_phone_key(phone)
    if not key:
        return None

    # Correspondance exacte d'abord (hors corbeille)
    result = await db.execute(
        select(Customer)
        .where(Customer.phone == phone.strip(), Customer.deleted_at.is_(None))
        .order_by(Customer.created_at.desc())
    )
    exact = result.scalars().first()
    if exact is not None:
        return exact

    # Puis rapprochement normalisé (+2126… / 06… / 6…)
    rows = (
        await db.execute(
            select(Customer).where(Customer.deleted_at.is_(None)).order_by(Customer.created_at.desc())
        )
    ).scalars().all()
    for customer in rows:
        if normalize_phone_key(customer.phone) == key:
            return customer
    return None


async def create_pharmacy_order(
    db: AsyncSession,
    payload: OrderCreate,
    *,
    user: User,
    source: str = "message",
) -> Order:
    external_id = await generate_pharmacy_order_id(db)
    customer = await resolve_customer_by_phone(db, payload.phone)
    advisor_id = customer.advisor_id if customer is not None else None
    amount = float(payload.amount or PHARMACY_PRODUCTS[payload.product_type])

    order = Order(
        external_order_id=external_id,
        customer_id=customer.id if customer else None,
        customer_name=payload.customer_name.strip(),
        city=payload.city.strip(),
        address=payload.address.strip(),
        phone=payload.phone.strip(),
        product_type=payload.product_type,
        advisor_id=advisor_id,
        amount=amount,
        status=getattr(payload, "status", None) or OrderStatus.saisiee,
        source=source,
        registered_by_user_id=user.id,
    )
    db.add(order)
    await db.flush()

    db.add(
        OrderItem(
            order_id=order.id,
            product_name=payload.product_type,
            quantity=1,
            price=amount,
        )
    )
    await db.flush()
    return await load_order(db, order.id)


async def import_order(db: AsyncSession, payload: OrderImportItem, *, user_id: int | None = None) -> Order:
    existing = await db.execute(
        select(Order).where(Order.external_order_id == payload.external_order_id)
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Order {payload.external_order_id} already exists")

    customer = None
    if payload.customer_code:
        result = await db.execute(
            select(Customer).where(
                Customer.customer_code == payload.customer_code.upper(),
                Customer.deleted_at.is_(None),
            )
        )
        customer = result.scalar_one_or_none()

    if customer is None:
        customer = await resolve_customer_by_phone(db, payload.phone)

    order = Order(
        external_order_id=payload.external_order_id,
        customer_id=customer.id if customer else None,
        customer_name=payload.customer_name or (customer.full_name if customer else None),
        city=payload.city or (customer.city if customer else None),
        address=payload.address,
        phone=payload.phone,
        product_type=payload.product_type,
        advisor_id=customer.advisor_id if customer else None,
        amount=payload.amount,
        status=payload.status,
        created_at=payload.created_at,
        source="import",
        notes=payload.notes,
        registered_by_user_id=user_id,
    )
    db.add(order)
    await db.flush()

    if payload.products:
        for item in payload.products:
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=item.product_id,
                    product_name=item.product_name,
                    quantity=item.quantity,
                    price=item.price,
                )
            )
    elif payload.product_type:
        db.add(
            OrderItem(
                order_id=order.id,
                product_name=payload.product_type,
                quantity=1,
                price=payload.amount,
            )
        )
    await db.flush()
    return await load_order(db, order.id)


async def load_order(db: AsyncSession, order_id: int) -> Order:
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.advisor),
        )
        .where(Order.id == order_id)
    )
    return result.scalar_one()


async def find_customer_for_order(
    db: AsyncSession, *, customer_code: str | None, phone: str
) -> Customer | None:
    if customer_code:
        result = await db.execute(
            select(Customer).where(
                Customer.customer_code == customer_code.upper(),
                Customer.deleted_at.is_(None),
            )
        )
        found = result.scalar_one_or_none()
        if found is not None:
            return found
    return await resolve_customer_by_phone(db, phone)
