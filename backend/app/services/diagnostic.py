import random
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Customer, CustomerStatus
from app.schemas.customer import ANALYSIS_ALGORITHM_VERSION


async def process_diagnostic(db: AsyncSession, customer_code: str) -> tuple[Customer, float, datetime, str]:
    result = await db.execute(
        select(Customer).where(
            Customer.customer_code == customer_code.upper(),
            Customer.deleted_at.is_(None),
        )
    )
    customer = result.scalar_one_or_none()
    if customer is None:
        raise ValueError("المعرّف غير موجود")

    # Une seule analyse par cliente — résultat déjà lié à la fiche
    if customer.humidity is not None or customer.humidity_measured_at is not None:
        raise ValueError("تم إجراء التشخيص مسبقاً")

    # مؤشر صحة البصيلات (40–50 %). L’image n’est jamais persistée.
    humidity = round(random.uniform(40.0, 50.0), 1)
    measured_at = datetime.now(timezone.utc)
    customer.humidity = humidity
    customer.humidity_measured_at = measured_at
    customer.analysis_algorithm_version = ANALYSIS_ALGORITHM_VERSION
    if customer.status in (CustomerStatus.nouvelle.value, CustomerStatus.formulaire_rempli.value, None, ""):
        customer.status = CustomerStatus.analyse_effectuee.value
    await db.flush()
    return customer, humidity, measured_at, ANALYSIS_ALGORITHM_VERSION
