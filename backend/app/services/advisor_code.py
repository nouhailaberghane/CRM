from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Advisor


async def generate_advisor_code(db: AsyncSession) -> str:
    result = await db.execute(select(Advisor.id, Advisor.advisor_code))
    rows = result.all()
    max_n = 0
    for advisor_id, code in rows:
        if code and str(code).upper().startswith("CS"):
            try:
                max_n = max(max_n, int(str(code)[2:]))
            except ValueError:
                pass
        elif advisor_id:
            max_n = max(max_n, int(advisor_id))
    n = max_n + 1
    while True:
        code = f"CS{n:06d}"
        exists = await db.execute(select(Advisor.id).where(Advisor.advisor_code == code))
        if exists.scalar_one_or_none() is None:
            return code
        n += 1


async def ensure_advisor_codes(db: AsyncSession) -> None:
    """Attribue un code CS… aux conseillères qui n’en ont pas encore."""
    rows = (await db.execute(select(Advisor).order_by(Advisor.id))).scalars().all()
    for advisor in rows:
        code = (advisor.advisor_code or "").strip()
        if code:
            continue
        advisor.advisor_code = await generate_advisor_code(db)
        await db.flush()
