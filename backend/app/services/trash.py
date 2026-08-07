"""Corbeille : soft-delete + purge automatique après 48 h."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.entities import Customer, CustomerProduct, CustomerProgram, Order, OrderItem

TRASH_RETENTION = timedelta(hours=48)
PHONE_TRASH_MARKER = "__trash_"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def purge_deadline(deleted_at: datetime) -> datetime:
    if deleted_at.tzinfo is None:
        deleted_at = deleted_at.replace(tzinfo=timezone.utc)
    return deleted_at + TRASH_RETENTION


def hours_left(deleted_at: datetime) -> float:
    left = (purge_deadline(deleted_at) - utcnow()).total_seconds() / 3600
    return max(0.0, round(left, 1))


def mark_phone_trashed(phone: str, customer_id: int) -> str:
    if PHONE_TRASH_MARKER in phone:
        return phone
    return f"{phone}{PHONE_TRASH_MARKER}{customer_id}"


def restore_phone(phone: str) -> str:
    if PHONE_TRASH_MARKER in phone:
        return phone.rsplit(PHONE_TRASH_MARKER, 1)[0]
    return phone


async def soft_delete_customer(db: AsyncSession, customer: Customer) -> None:
    customer.deleted_at = utcnow()
    customer.phone = mark_phone_trashed(customer.phone, customer.id)


async def soft_delete_order(db: AsyncSession, order: Order) -> None:
    order.deleted_at = utcnow()


async def hard_delete_customer(db: AsyncSession, customer: Customer) -> None:
    await db.execute(delete(CustomerProgram).where(CustomerProgram.customer_id == customer.id))
    await db.execute(delete(CustomerProduct).where(CustomerProduct.customer_id == customer.id))
    # Détacher les commandes actives encore liées
    orders = (
        await db.execute(select(Order).where(Order.customer_id == customer.id))
    ).scalars().all()
    for order in orders:
        order.customer_id = None
    await db.delete(customer)


async def hard_delete_order(db: AsyncSession, order: Order) -> None:
    await db.execute(delete(OrderItem).where(OrderItem.order_id == order.id))
    await db.delete(order)


async def purge_expired_trash(db: AsyncSession | None = None) -> dict[str, int]:
    """Supprime définitivement les éléments en corbeille depuis plus de 48 h."""
    owns_session = db is None
    if owns_session:
        db = AsyncSessionLocal()

    assert db is not None
    cutoff = utcnow() - TRASH_RETENTION
    removed_customers = 0
    removed_orders = 0

    try:
        customers = (
            await db.execute(
                select(Customer).where(
                    Customer.deleted_at.is_not(None),
                    Customer.deleted_at <= cutoff,
                )
            )
        ).scalars().all()
        for customer in customers:
            await hard_delete_customer(db, customer)
            removed_customers += 1

        orders = (
            await db.execute(
                select(Order)
                .options(selectinload(Order.items))
                .where(Order.deleted_at.is_not(None), Order.deleted_at <= cutoff)
            )
        ).scalars().all()
        for order in orders:
            await hard_delete_order(db, order)
            removed_orders += 1

        if owns_session:
            await db.commit()
        else:
            await db.flush()
    finally:
        if owns_session:
            await db.close()

    return {"customers": removed_customers, "orders": removed_orders}
