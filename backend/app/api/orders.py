from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import DbSession, require_roles
from app.models.entities import Order, OrderStatus, User, UserRole
from app.schemas.common import PaginatedResponse
from app.schemas.order import (
    PHARMACY_PRODUCTS,
    OrderCreate,
    OrderImportRequest,
    OrderItemOut,
    OrderOut,
    OrderUpdate,
)
from app.services.audit import log_action
from app.services.orders import create_pharmacy_order, import_order, resolve_customer_by_phone
from app.services.trash import hours_left, soft_delete_order

router = APIRouter(prefix="/orders", tags=["Pharmacy Orders"])


def to_order_out(order: Order) -> OrderOut:
    customer_code = order.customer.customer_code if order.customer else None
    stored_name = getattr(order, "customer_name", None)
    if not stored_name and order.customer:
        stored_name = getattr(order.customer, "full_name", None) or (
            f"{order.customer.first_name} {order.customer.last_name}".strip()
        )
    advisor_name = (
        f"{order.advisor.first_name} {order.advisor.last_name}" if order.advisor else None
    )
    return OrderOut(
        id=order.id,
        external_order_id=order.external_order_id,
        customer_id=order.customer_id,
        customer_code=customer_code,
        customer_name=stored_name,
        city=getattr(order, "city", None),
        address=getattr(order, "address", None),
        phone=order.phone,
        product_type=getattr(order, "product_type", None),
        advisor_id=order.advisor_id,
        advisor_name=advisor_name,
        amount=order.amount,
        status=order.status,
        source=getattr(order, "source", None) or "message",
        notes=getattr(order, "notes", None),
        created_at=order.created_at,
        deleted_at=getattr(order, "deleted_at", None),
        purge_in_hours=hours_left(order.deleted_at) if getattr(order, "deleted_at", None) else None,
        items=[
            OrderItemOut(
                id=i.id,
                product_id=i.product_id,
                product_name=i.product_name,
                quantity=i.quantity,
                price=i.price,
            )
            for i in order.items
        ],
    )


@router.get("", response_model=PaginatedResponse[OrderOut])
async def list_orders(
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.pharmacy)),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[OrderStatus] = Query(default=None, alias="status"),
    advisor_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
):
    """Commandes parapharmacie — accès séparé (rôle pharmacy) + admin."""
    query = select(Order).options(
        selectinload(Order.items),
        selectinload(Order.customer),
        selectinload(Order.advisor),
    ).where(Order.deleted_at.is_(None))
    count_query = select(func.count()).select_from(Order).where(Order.deleted_at.is_(None))

    if advisor_id is not None:
        query = query.where(Order.advisor_id == advisor_id)
        count_query = count_query.where(Order.advisor_id == advisor_id)

    if status_filter:
        query = query.where(Order.status == status_filter)
        count_query = count_query.where(Order.status == status_filter)
    if customer_id:
        query = query.where(Order.customer_id == customer_id)
        count_query = count_query.where(Order.customer_id == customer_id)
    if date_from:
        query = query.where(Order.created_at >= date_from)
        count_query = count_query.where(Order.created_at >= date_from)
    if date_to:
        query = query.where(Order.created_at <= date_to)
        count_query = count_query.where(Order.created_at <= date_to)
    if search:
        like = f"%{search}%"
        query = query.where(
            Order.external_order_id.ilike(like)
            | Order.phone.ilike(like)
            | Order.customer_name.ilike(like)
            | Order.city.ilike(like)
            | Order.address.ilike(like)
            | Order.product_type.ilike(like)
        )
        count_query = count_query.where(
            Order.external_order_id.ilike(like)
            | Order.phone.ilike(like)
            | Order.customer_name.ilike(like)
            | Order.city.ilike(like)
            | Order.address.ilike(like)
            | Order.product_type.ilike(like)
        )

    total = int((await db.execute(count_query)).scalar_one() or 0)
    rows = (
        await db.execute(
            query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().unique().all()
    pages = (total + page_size - 1) // page_size if total else 0
    return PaginatedResponse(
        items=[to_order_out(o) for o in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def register_pharmacy_order(
    payload: OrderCreate,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.pharmacy)),
):
    """Compte parapharmacie : enregistre une commande reçue par message."""
    try:
        order = await create_pharmacy_order(db, payload, user=user, source="message")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await log_action(
        db,
        user_id=user.id,
        action="register_pharmacy_order",
        entity_type="order",
        entity_id=order.external_order_id,
        details={"source": "message", "phone": order.phone, "amount": order.amount},
    )
    return to_order_out(order)


@router.post("/import")
async def import_orders(
    payload: OrderImportRequest,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin)),
):
    imported = []
    errors = []
    for item in payload.orders:
        try:
            order = await import_order(db, item, user_id=user.id)
            imported.append(to_order_out(order))
        except ValueError as exc:
            errors.append({"order_id": item.external_order_id, "error": str(exc)})
    await log_action(
        db,
        user_id=user.id,
        action="import_orders",
        entity_type="order",
        details={"imported": len(imported), "errors": len(errors)},
    )
    return {"imported": imported, "errors": errors}


@router.get("/trash/list", response_model=PaginatedResponse[OrderOut])
async def list_trashed_orders(
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.pharmacy)),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """Corbeille commandes — suppression auto après 48 h (pas de suppression manuelle)."""
    query = (
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.advisor),
        )
        .where(Order.deleted_at.is_not(None))
    )
    count_query = select(func.count()).select_from(Order).where(Order.deleted_at.is_not(None))
    total = int((await db.execute(count_query)).scalar_one() or 0)
    rows = (
        await db.execute(
            query.order_by(Order.deleted_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().unique().all()
    pages = (total + page_size - 1) // page_size if total else 0
    return PaginatedResponse(
        items=[to_order_out(o) for o in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: int,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.pharmacy)),
):
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.advisor),
        )
        .where(Order.id == order_id, Order.deleted_at.is_(None))
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return to_order_out(order)


@router.patch("/{order_id}", response_model=OrderOut)
async def update_order(
    order_id: int,
    payload: OrderUpdate,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.pharmacy)),
):
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.advisor),
        )
        .where(Order.id == order_id, Order.deleted_at.is_(None))
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    data = payload.model_dump(exclude_unset=True)
    phone_changed = "phone" in data
    product_changed = "product_type" in data

    for key, value in data.items():
        setattr(order, key, value)

    if phone_changed:
        customer = await resolve_customer_by_phone(db, order.phone)
        order.customer_id = customer.id if customer else None
        order.advisor_id = customer.advisor_id if customer else None

    if product_changed:
        amount = float(data.get("amount") or PHARMACY_PRODUCTS.get(order.product_type or "", order.amount))
        order.amount = amount
        if order.items:
            order.items[0].product_name = order.product_type or order.items[0].product_name
            order.items[0].price = amount

    await log_action(
        db,
        user_id=user.id,
        action="update_pharmacy_order",
        entity_type="order",
        entity_id=order.external_order_id,
        details={"status": str(order.status), "phone": order.phone},
    )
    await db.flush()
    return to_order_out(order)


@router.post("/{order_id}/restore", response_model=OrderOut)
async def restore_order(
    order_id: int,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.pharmacy)),
):
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.advisor),
        )
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None or order.deleted_at is None:
        raise HTTPException(status_code=404, detail="العنصر غير موجود في سلة المحذوفات")

    order.deleted_at = None
    await log_action(
        db,
        user_id=user.id,
        action="restore_pharmacy_order",
        entity_type="order",
        entity_id=order.external_order_id,
    )
    await db.flush()
    return to_order_out(order)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: int,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.pharmacy)),
):
    """Met en corbeille (soft-delete). Suppression définitive auto après 48 h."""
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.deleted_at.is_(None))
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    code = order.external_order_id
    await soft_delete_order(db, order)
    await log_action(
        db,
        user_id=user.id,
        action="trash_pharmacy_order",
        entity_type="order",
        entity_id=code,
    )
    return None
