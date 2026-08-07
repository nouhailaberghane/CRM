from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import DbSession, require_roles
from app.core.security import hash_password
from app.models.entities import Advisor, Customer, User, UserRole
from app.schemas.advisor import AdvisorCreate, AdvisorOut, AdvisorUpdate
from app.schemas.common import PaginatedResponse
from app.services.advisor_code import generate_advisor_code
from app.services.audit import log_action

router = APIRouter(prefix="/advisors", tags=["Advisors"])


def to_advisor_out(advisor: Advisor, customer_count: int = 0) -> AdvisorOut:
    return AdvisorOut(
        id=advisor.id,
        advisor_code=getattr(advisor, "advisor_code", None) or f"CS{advisor.id:06d}",
        first_name=advisor.first_name,
        last_name=advisor.last_name,
        email=advisor.user.email if advisor.user else f"{advisor.first_name.lower()}@internal.local",
        phone=advisor.phone,
        is_active=advisor.is_active,
        created_at=advisor.created_at,
        customer_count=customer_count,
    )


@router.get("/names")
async def list_advisor_names(
    db: DbSession,
    _user: User = Depends(require_roles(UserRole.admin, UserRole.advisor)),
):
    """Liste des noms pour l'espace conseillère commun."""
    rows = (
        await db.execute(
            select(Advisor).where(Advisor.is_active.is_(True)).order_by(Advisor.first_name, Advisor.last_name)
        )
    ).scalars().all()
    return [
        {
            "id": a.id,
            "advisor_code": getattr(a, "advisor_code", None) or f"CS{a.id:06d}",
            "name": f"{a.first_name} {a.last_name}".strip(),
        }
        for a in rows
    ]


@router.get("", response_model=PaginatedResponse[AdvisorOut])
async def list_advisors(
    db: DbSession,
    _user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
):
    query = select(Advisor).options(selectinload(Advisor.user))
    count_query = select(func.count()).select_from(Advisor)
    if search:
        like = f"%{search}%"
        filter_clause = (
            Advisor.first_name.ilike(like)
            | Advisor.last_name.ilike(like)
            | Advisor.phone.ilike(like)
            | Advisor.advisor_code.ilike(like)
        )
        query = query.where(filter_clause)
        count_query = count_query.where(filter_clause)

    total = int((await db.execute(count_query)).scalar_one() or 0)
    rows = (
        await db.execute(
            query.order_by(Advisor.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().all()

    items = []
    for advisor in rows:
        count = int(
            (
                await db.execute(
                    select(func.count())
                    .select_from(Customer)
                    .where(Customer.advisor_id == advisor.id, Customer.deleted_at.is_(None))
                )
            ).scalar_one()
            or 0
        )
        items.append(to_advisor_out(advisor, count))

    pages = (total + page_size - 1) // page_size if total else 0
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.post("", response_model=AdvisorOut, status_code=status.HTTP_201_CREATED)
async def create_advisor(
    payload: AdvisorCreate,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin)),
):
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=UserRole.advisor,
    )
    db.add(new_user)
    await db.flush()

    advisor = Advisor(
        advisor_code=await generate_advisor_code(db),
        user_id=new_user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
    )
    db.add(advisor)
    await db.flush()
    await db.refresh(advisor, attribute_names=["user"])
    await log_action(
        db,
        user_id=user.id,
        action="create_advisor",
        entity_type="advisor",
        entity_id=str(advisor.id),
    )
    return to_advisor_out(advisor, 0)


@router.get("/{advisor_id}", response_model=AdvisorOut)
async def get_advisor(
    advisor_id: int,
    db: DbSession,
    _user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    result = await db.execute(
        select(Advisor).options(selectinload(Advisor.user)).where(Advisor.id == advisor_id)
    )
    advisor = result.scalar_one_or_none()
    if advisor is None:
        raise HTTPException(status_code=404, detail="Advisor not found")
    count = int(
        (
            await db.execute(
                select(func.count())
                    .select_from(Customer)
                    .where(Customer.advisor_id == advisor.id, Customer.deleted_at.is_(None))
            )
        ).scalar_one()
        or 0
    )
    return to_advisor_out(advisor, count)


@router.patch("/{advisor_id}", response_model=AdvisorOut)
async def update_advisor(
    advisor_id: int,
    payload: AdvisorUpdate,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin)),
):
    result = await db.execute(
        select(Advisor).options(selectinload(Advisor.user)).where(Advisor.id == advisor_id)
    )
    advisor = result.scalar_one_or_none()
    if advisor is None:
        raise HTTPException(status_code=404, detail="Advisor not found")

    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    for key, value in data.items():
        setattr(advisor, key, value)
    if password:
        advisor.user.password_hash = hash_password(password)

    await log_action(
        db,
        user_id=user.id,
        action="update_advisor",
        entity_type="advisor",
        entity_id=str(advisor.id),
    )
    count = int(
        (
            await db.execute(
                select(func.count())
                    .select_from(Customer)
                    .where(Customer.advisor_id == advisor.id, Customer.deleted_at.is_(None))
            )
        ).scalar_one()
        or 0
    )
    return to_advisor_out(advisor, count)
