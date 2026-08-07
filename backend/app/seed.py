from sqlalchemy import delete, select

from app.config import get_settings
from app.core.security import hash_password
from app.database import AsyncSessionLocal, engine
from app.models.entities import (
    Advisor,
    CareProgram,
    Customer,
    CustomerProduct,
    CustomerProgram,
    Order,
    OrderItem,
    Product,
    User,
    UserRole,
)
from app.services.advisor_code import ensure_advisor_codes, generate_advisor_code

settings = get_settings()

PROGRAMS = [
    ("استعادة الشعر الجاف", "بروتوكول ترطيب مكثف للشعر الجاف."),
    ("روتين الشعر المجعد", "روتين للشعر المجعد والمتجدد."),
    ("عناية فروة الرأس الدهنية", "روتين لفروة الرأس الدهنية."),
    ("إصلاح الشعر التالف", "بروتوكول للشعر المتضرر."),
]

PRODUCTS = [
    ("Grow", 180.0, "علاج", "علاج نمو الشعر Grow"),
    ("Loubana-oil", 150.0, "علاج", "زيت لبانة"),
    ("Pack Grow + Loubana", 300.0, "باقة", "باقة Grow + Loubana-oil"),
]


async def seed_database() -> None:
    async with engine.begin() as conn:
        from app.database import Base

        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        existing_admin = await db.execute(select(User).where(User.email == settings.default_admin_email))
        if existing_admin.scalar_one_or_none():
            await _ensure_shared_accounts(db)
            await _ensure_advisors(db)
            await ensure_advisor_codes(db)
            await _remove_demo_customers(db)
            await _ensure_catalog(db)
            await db.commit()
            return

        admin = User(
            email=settings.default_admin_email,
            password_hash=hash_password(settings.default_admin_password),
            role=UserRole.admin,
        )
        db.add(admin)
        await db.flush()

        pharmacy = User(
            email="pharmacy@haircare.com",
            password_hash=hash_password("Pharma123!"),
            role=UserRole.pharmacy,
        )
        shared_advisor = User(
            email="conseillere",
            password_hash=hash_password("cccc1234@"),
            role=UserRole.advisor,
        )
        db.add_all([pharmacy, shared_advisor])
        await db.flush()

        if settings.app_env == "production":
            await db.commit()
            return

        await _ensure_advisors(db)
        await ensure_advisor_codes(db)
        await _ensure_catalog(db)
        await db.commit()


async def _ensure_shared_accounts(db) -> None:
    existing_pharma = await db.execute(select(User).where(User.email == "pharmacy@haircare.com"))
    if existing_pharma.scalar_one_or_none() is None:
        db.add(
            User(
                email="pharmacy@haircare.com",
                password_hash=hash_password("Pharma123!"),
                role=UserRole.pharmacy,
            )
        )

    existing_shared = await db.execute(select(User).where(User.email == "conseillere"))
    if existing_shared.scalar_one_or_none() is None:
        db.add(
            User(
                email="conseillere",
                password_hash=hash_password("cccc1234@"),
                role=UserRole.advisor,
            )
        )
    else:
        shared = (await db.execute(select(User).where(User.email == "conseillere"))).scalar_one()
        shared.is_active = True
        shared.role = UserRole.advisor

    for email in ("sara@haircare.com", "amine@haircare.com", "lina@haircare.com"):
        row = await db.execute(select(User).where(User.email == email))
        user = row.scalar_one_or_none()
        if user:
            user.is_active = False


async def _ensure_advisors(db) -> None:
    count = (await db.execute(select(Advisor.id))).scalars().first()
    if count is not None:
        return
    for first, last, phone in (
        ("Sara", "Benali", "+212600000001"),
        ("Amine", "Alaoui", "+212600000002"),
        ("Lina", "Mansouri", "+212600000003"),
    ):
        code = await generate_advisor_code(db)
        db.add(
            Advisor(
                advisor_code=code,
                user_id=None,
                first_name=first,
                last_name=last,
                phone=phone,
            )
        )
        await db.flush()


async def _ensure_catalog(db) -> None:
    has_program = (await db.execute(select(CareProgram.id))).scalars().first()
    if has_program is None:
        for name, description in PROGRAMS:
            db.add(CareProgram(name=name, description=description))

    has_product = (await db.execute(select(Product.id))).scalars().first()
    if has_product is None:
        for name, price, category, description in PRODUCTS:
            db.add(
                Product(
                    name=name,
                    price=price,
                    category=category,
                    description=description,
                    purchase_url=None,
                )
            )
    await db.flush()


async def _remove_demo_customers(db) -> None:
    """Supprime les anciennes fiches / commandes de démonstration."""
    result = await db.execute(
        select(Customer.id).where(
            (Customer.last_name == "Demo") | (Customer.notes == "Seed customer")
        )
    )
    ids = list(result.scalars().all())

    seed_order_ids = list(
        (
            await db.execute(select(Order.id).where(Order.notes == "Commande seed parapharmacie"))
        ).scalars().all()
    )
    order_ids = set(seed_order_ids)
    if ids:
        linked = (
            await db.execute(select(Order.id).where(Order.customer_id.in_(ids)))
        ).scalars().all()
        order_ids.update(linked)

    if order_ids:
        await db.execute(delete(OrderItem).where(OrderItem.order_id.in_(order_ids)))
        await db.execute(delete(Order).where(Order.id.in_(order_ids)))

    if ids:
        await db.execute(delete(CustomerProgram).where(CustomerProgram.customer_id.in_(ids)))
        await db.execute(delete(CustomerProduct).where(CustomerProduct.customer_id.in_(ids)))
        await db.execute(delete(Customer).where(Customer.id.in_(ids)))
