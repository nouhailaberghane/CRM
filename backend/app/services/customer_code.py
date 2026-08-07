from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Customer


async def generate_customer_code(db: AsyncSession) -> str:
    result = await db.execute(select(func.count()).select_from(Customer))
    count = int(result.scalar_one() or 0)
    next_number = count + 1

    while True:
        code = f"CL{next_number:06d}"
        exists = await db.execute(select(Customer.id).where(Customer.customer_code == code))
        if exists.scalar_one_or_none() is None:
            return code
        next_number += 1
