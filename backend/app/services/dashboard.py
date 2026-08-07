from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Advisor, Customer, Order, OrderItem, OrderStatus
from app.schemas.dashboard import (
    AdvisorStats,
    DashboardResponse,
    KPIStats,
    NamedCount,
    PharmacyAdvisorBreakdown,
    PharmacyOrderAttribution,
    PharmacyOrderKPIs,
    PharmacyStatusCount,
    TimeSeriesPoint,
)
from app.services.phones import normalize_phone_key


PHARMACY_STATUS_LABELS: dict[str, str] = {
    "saisiee": "مسجّلة",
    "occupee": "مشغولة",
    "pickup": "Pickup",
    "livree": "مسلّمة",
    "retournee": "ثم الاسترجاع",
    "annulee": "ملغاة",
}

PHARMACY_STATUS_NORMALIZE: dict[str, str] = {
    "pending": "saisiee",
    "confirmed": "saisiee",
    "shipped": "occupee",
    "delivered": "livree",
    "cancelled": "annulee",
}

IN_PROGRESS_STATUSES = {"saisiee", "occupee", "pickup"}


def _normalize_order_status(status: OrderStatus | str | None) -> str:
    raw = status.value if isinstance(status, OrderStatus) else str(status or "saisiee")
    return PHARMACY_STATUS_NORMALIZE.get(raw, raw)


def _day_start(dt: Optional[datetime] = None) -> datetime:
    now = dt or datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


async def get_dashboard(
    db: AsyncSession,
    *,
    advisor_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> DashboardResponse:
    customer_filters = [Customer.deleted_at.is_(None)]
    order_filters = [
        Order.deleted_at.is_(None),
        Order.status.notin_([OrderStatus.cancelled, OrderStatus.annulee, OrderStatus.retournee]),
    ]
    if advisor_id is not None:
        customer_filters.append(Customer.advisor_id == advisor_id)
        order_filters.append(Order.advisor_id == advisor_id)
    if date_from is not None:
        customer_filters.append(Customer.created_at >= date_from)
        order_filters.append(Order.created_at >= date_from)
    if date_to is not None:
        customer_filters.append(Customer.created_at <= date_to)
        order_filters.append(Order.created_at <= date_to)

    total_customers = int(
        (
            await db.execute(select(func.count()).select_from(Customer).where(*customer_filters))
        ).scalar_one()
        or 0
    )

    today = _day_start()
    customers_today = int(
        (
            await db.execute(
                select(func.count())
                .select_from(Customer)
                .where(
                    Customer.created_at >= today,
                    Customer.deleted_at.is_(None),
                    *([Customer.advisor_id == advisor_id] if advisor_id else []),
                )
            )
        ).scalar_one()
        or 0
    )

    diagnostics_q = select(func.count()).select_from(Customer).where(
        Customer.humidity.is_not(None), Customer.deleted_at.is_(None)
    )
    avg_humidity_q = select(func.avg(Customer.humidity)).where(
        Customer.humidity.is_not(None), Customer.deleted_at.is_(None)
    )
    if advisor_id is not None:
        diagnostics_q = diagnostics_q.where(Customer.advisor_id == advisor_id)
        avg_humidity_q = avg_humidity_q.where(Customer.advisor_id == advisor_id)

    diagnostics_completed = int((await db.execute(diagnostics_q)).scalar_one() or 0)
    average_humidity = (await db.execute(avg_humidity_q)).scalar_one()
    average_humidity = round(float(average_humidity), 1) if average_humidity is not None else None

    total_orders = int(
        (await db.execute(select(func.count()).select_from(Order).where(*order_filters))).scalar_one() or 0
    )
    revenue = float(
        (await db.execute(select(func.coalesce(func.sum(Order.amount), 0)).where(*order_filters))).scalar_one()
        or 0
    )
    average_order_value = round(revenue / total_orders, 2) if total_orders else None
    conversion_rate = round((total_orders / total_customers) * 100, 1) if total_customers else 0.0

    kpis = KPIStats(
        total_customers=total_customers,
        customers_today=customers_today,
        diagnostics_completed=diagnostics_completed,
        average_humidity=average_humidity,
        total_orders=total_orders,
        revenue=round(revenue, 2),
        average_order_value=average_order_value,
        conversion_rate=conversion_rate,
    )

    # Revenue over last 30 days
    start = _day_start() - timedelta(days=29)
    revenue_rows = (
        await db.execute(
            select(func.date(Order.created_at), func.coalesce(func.sum(Order.amount), 0))
            .where(Order.created_at >= start, *order_filters)
            .group_by(func.date(Order.created_at))
            .order_by(func.date(Order.created_at))
        )
    ).all()
    revenue_map = {str(r[0]): float(r[1]) for r in revenue_rows}
    revenue_over_time = [
        TimeSeriesPoint(date=(start + timedelta(days=i)).date().isoformat(), value=revenue_map.get((start + timedelta(days=i)).date().isoformat(), 0.0))
        for i in range(30)
    ]

    # Also try YYYY-MM-DD keys from sqlite which may differ
    if not any(p.value for p in revenue_over_time) and revenue_rows:
        revenue_over_time = [TimeSeriesPoint(date=str(r[0]), value=float(r[1])) for r in revenue_rows]

    orders_per_advisor_rows = (
        await db.execute(
            select(
                Advisor.first_name,
                Advisor.last_name,
                func.count(Order.id),
            )
            .join(Order, Order.advisor_id == Advisor.id)
            .where(*order_filters)
            .group_by(Advisor.id)
            .order_by(func.count(Order.id).desc())
            .limit(10)
        )
    ).all()
    orders_per_advisor = [
        NamedCount(name=f"{r[0]} {r[1]}", value=int(r[2])) for r in orders_per_advisor_rows
    ]

    customers_per_advisor_rows = (
        await db.execute(
            select(Advisor.first_name, Advisor.last_name, func.count(Customer.id))
            .join(Customer, Customer.advisor_id == Advisor.id)
            .where(*customer_filters)
            .group_by(Advisor.id)
            .order_by(func.count(Customer.id).desc())
            .limit(10)
        )
    ).all()
    customers_per_advisor = [
        NamedCount(name=f"{r[0]} {r[1]}", value=int(r[2])) for r in customers_per_advisor_rows
    ]

    top_products_rows = (
        await db.execute(
            select(OrderItem.product_name, func.sum(OrderItem.quantity))
            .join(Order, Order.id == OrderItem.order_id)
            .where(*order_filters)
            .group_by(OrderItem.product_name)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(8)
        )
    ).all()
    top_products = [NamedCount(name=r[0], value=int(r[1] or 0)) for r in top_products_rows]

    registered = total_customers
    diagnosed = diagnostics_completed
    ordered = total_orders
    conversion_funnel = [
        NamedCount(name="مسجّلة", value=registered),
        NamedCount(name="تم التشخيص", value=diagnosed),
        NamedCount(name="طلبت", value=ordered),
    ]

    growth_rows = (
        await db.execute(
            select(func.date(Customer.created_at), func.count(Customer.id))
            .where(Customer.created_at >= start, *customer_filters)
            .group_by(func.date(Customer.created_at))
            .order_by(func.date(Customer.created_at))
        )
    ).all()
    customer_growth = [TimeSeriesPoint(date=str(r[0]), value=float(r[1])) for r in growth_rows]

    city_rows = (
        await db.execute(
            select(Customer.city, func.count(Customer.id))
            .where(*customer_filters)
            .group_by(Customer.city)
            .order_by(func.count(Customer.id).desc())
            .limit(10)
        )
    ).all()
    customers_by_city = [NamedCount(name=r[0], value=int(r[1])) for r in city_rows]

    top_advisor_rows = (
        await db.execute(
            select(
                Advisor.first_name,
                Advisor.last_name,
                func.coalesce(func.sum(Order.amount), 0),
            )
            .outerjoin(
                Order,
                (Order.advisor_id == Advisor.id)
                & (Order.deleted_at.is_(None))
                & Order.status.notin_([OrderStatus.cancelled, OrderStatus.annulee, OrderStatus.retournee]),
            )
            .where(*([Advisor.id == advisor_id] if advisor_id else [True]))
            .group_by(Advisor.id)
            .order_by(func.coalesce(func.sum(Order.amount), 0).desc())
            .limit(10)
        )
    ).all()
    top_advisors = [NamedCount(name=f"{r[0]} {r[1]}", value=round(float(r[2]), 2)) for r in top_advisor_rows]

    # Dialect-safe monthly aggregation
    all_orders = (
        await db.execute(select(Order.created_at, Order.amount).where(*order_filters))
    ).all()
    monthly_map: dict[str, float] = {}
    for created_at, amount in all_orders:
        if created_at is None:
            continue
        key = created_at.strftime("%Y-%m")
        monthly_map[key] = monthly_map.get(key, 0.0) + float(amount)
    monthly_sales = [
        TimeSeriesPoint(date=k, value=round(v, 2)) for k, v in sorted(monthly_map.items())
    ]

    pharmacy_filters = [Order.deleted_at.is_(None)]
    if advisor_id is not None:
        pharmacy_filters.append(Order.advisor_id == advisor_id)
    if date_from is not None:
        pharmacy_filters.append(Order.created_at >= date_from)
    if date_to is not None:
        pharmacy_filters.append(Order.created_at <= date_to)

    pharmacy_kpis = await _pharmacy_order_kpis(db, pharmacy_filters=pharmacy_filters)

    pharmacy_by_advisor, pharmacy_order_attribution, pharmacy_unmatched_count = (
        await _pharmacy_attribution_by_phone(db, order_filters=pharmacy_filters)
    )

    return DashboardResponse(
        kpis=kpis,
        revenue_over_time=revenue_over_time,
        orders_per_advisor=orders_per_advisor,
        customers_per_advisor=customers_per_advisor,
        top_products=top_products,
        conversion_funnel=conversion_funnel,
        customer_growth=customer_growth,
        customers_by_city=customers_by_city,
        top_advisors=top_advisors,
        monthly_sales=monthly_sales,
        pharmacy_kpis=pharmacy_kpis,
        pharmacy_by_advisor=pharmacy_by_advisor,
        pharmacy_order_attribution=pharmacy_order_attribution,
        pharmacy_unmatched_count=pharmacy_unmatched_count,
    )


async def _pharmacy_order_kpis(db: AsyncSession, *, pharmacy_filters: list) -> PharmacyOrderKPIs:
    """KPI de suivi des commandes parapharmacie par statut."""
    today = _day_start()
    rows = (
        await db.execute(
            select(Order.status, Order.amount, Order.created_at).where(*pharmacy_filters)
        )
    ).all()

    buckets: dict[str, dict[str, float]] = {
        key: {"count": 0, "revenue": 0.0} for key in PHARMACY_STATUS_LABELS
    }
    today_count = 0

    for status, amount, created_at in rows:
        key = _normalize_order_status(status)
        if key not in buckets:
            buckets[key] = {"count": 0, "revenue": 0.0}
        buckets[key]["count"] += 1
        buckets[key]["revenue"] += float(amount or 0)
        if created_at is not None:
            ts = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
            if ts >= today:
                today_count += 1

    order_keys = ["saisiee", "occupee", "pickup", "livree", "retournee", "annulee"]
    by_status = [
        PharmacyStatusCount(
            status=status,
            label=PHARMACY_STATUS_LABELS.get(status, status),
            count=int(buckets.get(status, {"count": 0})["count"]),
            revenue=round(float(buckets.get(status, {"revenue": 0.0})["revenue"]), 2),
        )
        for status in order_keys
    ]

    total = sum(int(v["count"]) for v in buckets.values())
    in_progress = sum(int(buckets.get(s, {"count": 0})["count"]) for s in IN_PROGRESS_STATUSES)
    livree = int(buckets.get("livree", {"count": 0})["count"])
    retournee = int(buckets.get("retournee", {"count": 0})["count"])
    annulee = int(buckets.get("annulee", {"count": 0})["count"])
    revenue_total = round(sum(float(v["revenue"]) for v in buckets.values()), 2)
    revenue_delivered = round(float(buckets.get("livree", {"revenue": 0.0})["revenue"]), 2)
    closed = livree + retournee + annulee
    delivery_rate = round((livree / closed) * 100, 1) if closed else 0.0

    return PharmacyOrderKPIs(
        total=total,
        today=today_count,
        in_progress=in_progress,
        livree=livree,
        retournee=retournee,
        annulee=annulee,
        delivery_rate=delivery_rate,
        revenue_total=revenue_total,
        revenue_delivered=revenue_delivered,
        by_status=by_status,
    )


async def _pharmacy_attribution_by_phone(
    db: AsyncSession, *, order_filters: list
) -> tuple[list[PharmacyAdvisorBreakdown], list[PharmacyOrderAttribution], int]:
    """Rattache chaque commande pharma à une conseillère via le téléphone de la cliente CRM."""
    customers = (
        await db.execute(
            select(Customer, Advisor)
            .join(Advisor, Advisor.id == Customer.advisor_id)
            .where(Customer.deleted_at.is_(None))
            .order_by(Customer.created_at.desc())
        )
    ).all()

    phone_to_advisor: dict[str, dict] = {}
    for customer, advisor in customers:
        key = normalize_phone_key(customer.phone)
        if key and key not in phone_to_advisor:
            phone_to_advisor[key] = {
                "id": advisor.id,
                "code": (getattr(advisor, "advisor_code", None) or f"CS{advisor.id:06d}").strip(),
                "name": f"{advisor.first_name} {advisor.last_name}".strip(),
            }

    advisors_by_id = {
        a.id: {
            "id": a.id,
            "code": (getattr(a, "advisor_code", None) or f"CS{a.id:06d}").strip(),
            "name": f"{a.first_name} {a.last_name}".strip(),
        }
        for a in (await db.execute(select(Advisor))).scalars().all()
    }

    all_orders = (
        await db.execute(select(Order).where(*order_filters).order_by(Order.created_at.desc()))
    ).scalars().all()

    def resolve_advisor(order: Order) -> dict | None:
        key = normalize_phone_key(order.phone)
        info = phone_to_advisor.get(key)
        if info:
            return info
        if order.advisor_id:
            return advisors_by_id.get(order.advisor_id)
        return None

    totals: dict[int, dict] = {}
    unmatched = 0
    for order in all_orders:
        info = resolve_advisor(order)
        if info:
            bucket = totals.setdefault(
                info["id"],
                {"id": info["id"], "code": info["code"], "name": info["name"], "orders": 0, "revenue": 0.0},
            )
            bucket["orders"] += 1
            bucket["revenue"] += float(order.amount or 0)
        else:
            unmatched += 1

    pharmacy_by_advisor = [
        PharmacyAdvisorBreakdown(
            advisor_id=int(vals["id"]),
            advisor_code=str(vals["code"]),
            advisor_name=str(vals["name"]),
            orders_count=int(vals["orders"]),
            revenue=round(float(vals["revenue"]), 2),
        )
        for vals in sorted(totals.values(), key=lambda x: x["orders"], reverse=True)
    ]

    attribution: list[PharmacyOrderAttribution] = []
    for order in all_orders[:50]:
        info = resolve_advisor(order)
        attribution.append(
            PharmacyOrderAttribution(
                external_order_id=order.external_order_id,
                customer_name=getattr(order, "customer_name", None),
                phone=order.phone,
                product_type=getattr(order, "product_type", None),
                amount=float(order.amount or 0),
                status=_normalize_order_status(order.status),
                advisor_id=info["id"] if info else None,
                advisor_code=info["code"] if info else None,
                advisor_name=info["name"] if info else None,
                matched=info is not None,
                created_at=order.created_at.isoformat() if order.created_at else "",
            )
        )

    return pharmacy_by_advisor, attribution, unmatched


async def get_advisor_stats(db: AsyncSession, advisor_id: int) -> AdvisorStats:
    advisor = (
        await db.execute(select(Advisor).where(Advisor.id == advisor_id))
    ).scalar_one_or_none()
    if advisor is None:
        raise ValueError("Advisor not found")

    total_customers = int(
        (
            await db.execute(
                select(func.count())
                .select_from(Customer)
                .where(Customer.advisor_id == advisor_id, Customer.deleted_at.is_(None))
            )
        ).scalar_one()
        or 0
    )
    diagnostics_completed = int(
        (
            await db.execute(
                select(func.count())
                .select_from(Customer)
                .where(
                    Customer.advisor_id == advisor_id,
                    Customer.humidity.is_not(None),
                    Customer.deleted_at.is_(None),
                )
            )
        ).scalar_one()
        or 0
    )
    total_orders = int(
        (
            await db.execute(
                select(func.count())
                .select_from(Order)
                .where(Order.advisor_id == advisor_id, Order.deleted_at.is_(None))
            )
        ).scalar_one()
        or 0
    )
    revenue = float(
        (
            await db.execute(
                select(func.coalesce(func.sum(Order.amount), 0)).where(
                    Order.advisor_id == advisor_id, Order.deleted_at.is_(None)
                )
            )
        ).scalar_one()
        or 0
    )
    conversion_rate = round((total_orders / total_customers) * 100, 1) if total_customers else 0.0
    return AdvisorStats(
        advisor_id=advisor.id,
        advisor_name=f"{advisor.first_name} {advisor.last_name}",
        total_customers=total_customers,
        diagnostics_completed=diagnostics_completed,
        total_orders=total_orders,
        revenue=round(revenue, 2),
        conversion_rate=conversion_rate,
    )
