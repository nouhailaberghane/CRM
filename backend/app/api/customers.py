from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.deps import DbSession, require_roles
from app.models.entities import (
    Advisor,
    CareProgram,
    Customer,
    CustomerProduct,
    CustomerProgram,
    Order,
    User,
    UserRole,
)
from app.schemas.catalog import (
    AssignProgramRequest,
    CustomerProductOut,
    CustomerProgramOut,
    RecommendProductRequest,
)
from app.schemas.common import PaginatedResponse
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate
from app.services.audit import log_action
from app.services.customer_code import generate_customer_code
from app.services.exports import export_customers_excel
from app.services.trash import hours_left, restore_phone, soft_delete_customer

router = APIRouter(prefix="/customers", tags=["Customers"])
settings = get_settings()


def _split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split(None, 1)
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


def _age_from_birth(birth: Optional[date]) -> Optional[int]:
    if not birth:
        return None
    today = date.today()
    return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))


def to_customer_out(customer: Customer) -> CustomerOut:
    advisor_name = None
    if customer.advisor:
        advisor_name = f"{customer.advisor.first_name} {customer.advisor.last_name}"
    full_name = getattr(customer, "full_name", None) or f"{customer.first_name} {customer.last_name}".strip()
    deleted_at = getattr(customer, "deleted_at", None)
    phone = restore_phone(customer.phone) if deleted_at else customer.phone
    return CustomerOut(
        id=customer.id,
        customer_code=customer.customer_code,
        advisor_id=customer.advisor_id,
        advisor_name=advisor_name,
        full_name=full_name,
        first_name=customer.first_name,
        last_name=customer.last_name,
        birth_date=getattr(customer, "birth_date", None),
        gender=getattr(customer, "gender", None),
        phone=phone,
        email=customer.email,
        city=customer.city,
        age=customer.age or _age_from_birth(getattr(customer, "birth_date", None)),
        hair_type=customer.hair_type,
        hair_concerns=customer.hair_concerns,
        questionnaire=customer.questionnaire,
        care_plan=getattr(customer, "care_plan", None),
        recommended_catalog=getattr(customer, "recommended_catalog", None),
        status=getattr(customer, "status", None) or "nouvelle",
        notes=customer.notes,
        humidity=customer.humidity,
        humidity_measured_at=customer.humidity_measured_at,
        analysis_algorithm_version=getattr(customer, "analysis_algorithm_version", None),
        created_at=customer.created_at,
        diagnostic_link=f"{settings.frontend_url}/diagnostic",
        deleted_at=deleted_at,
        purge_in_hours=hours_left(deleted_at) if deleted_at else None,
    )


def is_shared_advisor_workspace(user: User) -> bool:
    """Compte unique partagé : toutes les conseillères voient le même espace."""
    return user.role == UserRole.advisor and (
        user.email.lower() == "conseillere" or user.advisor is None
    )


async def ensure_customer_access(user: User, customer: Customer) -> None:
    if user.role == UserRole.advisor and not is_shared_advisor_workspace(user):
        if not user.advisor or customer.advisor_id != user.advisor.id:
            raise HTTPException(status_code=403, detail="Not allowed to access this customer")


@router.get("", response_model=PaginatedResponse[CustomerOut])
async def list_customers(
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor, UserRole.manager)),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    city: Optional[str] = None,
    advisor_id: Optional[int] = None,
    program_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
):
    query = select(Customer).options(selectinload(Customer.advisor)).where(Customer.deleted_at.is_(None))
    count_query = select(func.count()).select_from(Customer).where(Customer.deleted_at.is_(None))

    # Conseillère individuelle : uniquement ses clientes.
    # Espace commun / admin / manager : peuvent filtrer par advisor_id.
    if user.role == UserRole.advisor and not is_shared_advisor_workspace(user):
        if not user.advisor:
            raise HTTPException(status_code=400, detail="Advisor profile missing")
        query = query.where(Customer.advisor_id == user.advisor.id)
        count_query = count_query.where(Customer.advisor_id == user.advisor.id)
    elif advisor_id is not None:
        query = query.where(Customer.advisor_id == advisor_id)
        count_query = count_query.where(Customer.advisor_id == advisor_id)

    if search:
        like = f"%{search}%"
        clause = or_(
            Customer.full_name.ilike(like),
            Customer.first_name.ilike(like),
            Customer.last_name.ilike(like),
            Customer.phone.ilike(like),
            Customer.customer_code.ilike(like),
            Customer.email.ilike(like),
            Customer.city.ilike(like),
        )
        query = query.where(clause)
        count_query = count_query.where(clause)
    if city:
        query = query.where(Customer.city.ilike(f"%{city}%"))
        count_query = count_query.where(Customer.city.ilike(f"%{city}%"))
    if date_from:
        query = query.where(Customer.created_at >= date_from)
        count_query = count_query.where(Customer.created_at >= date_from)
    if date_to:
        query = query.where(Customer.created_at <= date_to)
        count_query = count_query.where(Customer.created_at <= date_to)
    if program_id:
        query = query.join(CustomerProgram).where(CustomerProgram.program_id == program_id)
        count_query = count_query.join(CustomerProgram).where(CustomerProgram.program_id == program_id)

    total = int((await db.execute(count_query)).scalar_one() or 0)
    rows = (
        await db.execute(
            query.order_by(Customer.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().unique().all()
    pages = (total + page_size - 1) // page_size if total else 0
    return PaginatedResponse(
        items=[to_customer_out(c) for c in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


async def resolve_advisor_id(db: DbSession, user: User, payload: CustomerCreate) -> int:
    """Lie la cliente à la conseillère via le nom saisi (espace commun partagé)."""
    name = payload.advisor_name.strip()
    name_lower = name.lower()

    if payload.advisor_id is not None and user.role == UserRole.admin:
        return payload.advisor_id

    result = await db.execute(select(Advisor).where(Advisor.is_active.is_(True)))
    advisors = result.scalars().all()
    for advisor in advisors:
        full = f"{advisor.first_name} {advisor.last_name}".strip().lower()
        if name_lower == full or name_lower == advisor.first_name.lower():
            return advisor.id

    raise HTTPException(
        status_code=400,
        detail=f"Aucune conseillère trouvée pour « {payload.advisor_name} ». "
        "Choisissez un nom dans la liste (ex: Sara Benali).",
    )


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor)),
):
    advisor_id = await resolve_advisor_id(db, user, payload)

    existing_phone = await db.execute(
        select(Customer.id).where(Customer.phone == payload.phone, Customer.deleted_at.is_(None))
    )
    if existing_phone.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ce numéro de téléphone est déjà enregistré")

    code = await generate_customer_code(db)
    first, last = _split_name(payload.full_name)
    q = payload.questionnaire or {}
    hair_type = "—"
    if isinstance(q.get("nature_cheveux"), dict):
        hair_type = q["nature_cheveux"].get("type_cheveux") or "—"

    customer = Customer(
        customer_code=code,
        advisor_id=advisor_id,
        full_name=payload.full_name.strip(),
        first_name=first or payload.full_name.strip(),
        last_name=last or "-",
        birth_date=payload.birth_date,
        gender=payload.gender,
        phone=payload.phone,
        email=str(payload.email) if payload.email else None,
        city=payload.city,
        age=_age_from_birth(payload.birth_date) or 0,
        hair_type=hair_type,
        questionnaire=q,
        notes=payload.notes,
        status=payload.status or "formulaire_rempli",
        care_plan={},
        recommended_catalog=[],
    )
    db.add(customer)
    await db.flush()
    result = await db.execute(
        select(Customer).options(selectinload(Customer.advisor)).where(Customer.id == customer.id)
    )
    customer = result.scalar_one()
    await log_action(
        db,
        user_id=user.id,
        action="create_customer",
        entity_type="customer",
        entity_id=customer.customer_code,
    )
    return to_customer_out(customer)


@router.get("/export")
async def export_customers(
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager, UserRole.advisor)),
):
    query = select(Customer).options(selectinload(Customer.advisor)).where(Customer.deleted_at.is_(None))
    if user.role == UserRole.advisor and not is_shared_advisor_workspace(user):
        if not user.advisor:
            raise HTTPException(status_code=400, detail="Advisor profile missing")
        query = query.where(Customer.advisor_id == user.advisor.id)
    customers = (await db.execute(query.order_by(Customer.created_at.desc()))).scalars().all()
    content = export_customers_excel(customers)
    await log_action(db, user_id=user.id, action="export_customers", entity_type="customer")
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=customers.xlsx"},
    )


@router.get("/autocomplete")
async def autocomplete_customers(
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor, UserRole.manager)),
    q: str = Query(min_length=1),
    limit: int = Query(10, ge=1, le=25),
):
    like = f"%{q}%"
    query = select(Customer).where(
        Customer.deleted_at.is_(None),
        or_(
            Customer.customer_code.ilike(like),
            Customer.first_name.ilike(like),
            Customer.last_name.ilike(like),
            Customer.phone.ilike(like),
        ),
    )
    if user.role == UserRole.advisor and not is_shared_advisor_workspace(user) and user.advisor:
        query = query.where(Customer.advisor_id == user.advisor.id)
    rows = (await db.execute(query.order_by(Customer.created_at.desc()).limit(limit))).scalars().all()
    return [
        {
            "id": c.id,
            "customer_code": c.customer_code,
            "label": f"{c.customer_code} — {c.first_name} {c.last_name}",
            "phone": c.phone,
        }
        for c in rows
    ]


@router.get("/trash/list", response_model=PaginatedResponse[CustomerOut])
async def list_trashed_customers(
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor)),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """Corbeille clientes — suppression auto après 48 h (pas de suppression manuelle)."""
    query = select(Customer).options(selectinload(Customer.advisor)).where(Customer.deleted_at.is_not(None))
    count_query = select(func.count()).select_from(Customer).where(Customer.deleted_at.is_not(None))
    if user.role == UserRole.advisor and not is_shared_advisor_workspace(user):
        if not user.advisor:
            raise HTTPException(status_code=400, detail="Advisor profile missing")
        query = query.where(Customer.advisor_id == user.advisor.id)
        count_query = count_query.where(Customer.advisor_id == user.advisor.id)

    total = int((await db.execute(count_query)).scalar_one() or 0)
    rows = (
        await db.execute(
            query.order_by(Customer.deleted_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().all()
    pages = (total + page_size - 1) // page_size if total else 0
    return PaginatedResponse(
        items=[to_customer_out(c) for c in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: int,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor, UserRole.manager)),
):
    result = await db.execute(
        select(Customer)
        .options(selectinload(Customer.advisor))
        .where(Customer.id == customer_id, Customer.deleted_at.is_(None))
    )
    customer = result.scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    await ensure_customer_access(user, customer)
    return to_customer_out(customer)


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor)),
):
    result = await db.execute(
        select(Customer)
        .options(selectinload(Customer.advisor))
        .where(Customer.id == customer_id, Customer.deleted_at.is_(None))
    )
    customer = result.scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    await ensure_customer_access(user, customer)

    data = payload.model_dump(exclude_unset=True)
    advisor_name = data.pop("advisor_name", None)
    if advisor_name:
        # Réutilise la résolution par nom (espace commun)
        fake = CustomerCreate(
            advisor_name=advisor_name,
            full_name=customer.full_name or customer.first_name,
            birth_date=customer.birth_date or date.today(),
            gender=customer.gender or "أنثى",
            city=customer.city or "—",
            phone=customer.phone,
        )
        customer.advisor_id = await resolve_advisor_id(db, user, fake)

    if "phone" in data and data["phone"]:
        dup = await db.execute(
            select(Customer.id).where(
                Customer.phone == data["phone"],
                Customer.id != customer.id,
                Customer.deleted_at.is_(None),
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ce numéro de téléphone est déjà enregistré")

    if "care_plan" in data and data["care_plan"] is not None:
        data["care_plan"] = data["care_plan"]
    if "full_name" in data and data["full_name"]:
        first, last = _split_name(data["full_name"])
        data["first_name"] = first
        data["last_name"] = last
    if "birth_date" in data:
        data["age"] = _age_from_birth(data["birth_date"])
    if "questionnaire" in data and data["questionnaire"]:
        q = data["questionnaire"]
        nature = q.get("nature_cheveux") if isinstance(q, dict) else None
        if isinstance(nature, dict) and nature.get("type_cheveux"):
            data["hair_type"] = nature["type_cheveux"]
        raisons = q.get("raisons_contact") if isinstance(q, dict) else None
        if isinstance(raisons, list) and raisons:
            data["hair_concerns"] = ", ".join(str(x) for x in raisons[:3])

    for key, value in data.items():
        setattr(customer, key, value)
    await log_action(
        db,
        user_id=user.id,
        action="update_customer",
        entity_type="customer",
        entity_id=customer.customer_code,
    )
    return to_customer_out(customer)


@router.post("/{customer_id}/restore", response_model=CustomerOut)
async def restore_customer(
    customer_id: int,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor)),
):
    result = await db.execute(
        select(Customer).options(selectinload(Customer.advisor)).where(Customer.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if customer is None or customer.deleted_at is None:
        raise HTTPException(status_code=404, detail="العنصر غير موجود في سلة المحذوفات")
    await ensure_customer_access(user, customer)

    original_phone = restore_phone(customer.phone)
    dup = await db.execute(
        select(Customer.id).where(
            Customer.phone == original_phone,
            Customer.deleted_at.is_(None),
            Customer.id != customer.id,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="تعذّرت الاستعادة: رقم الهاتف مستخدم بالفعل من عميلة أخرى",
        )

    customer.phone = original_phone
    customer.deleted_at = None
    await log_action(
        db,
        user_id=user.id,
        action="restore_customer",
        entity_type="customer",
        entity_id=customer.customer_code,
    )
    return to_customer_out(customer)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: int,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor)),
):
    """Met en corbeille (soft-delete). Suppression définitive auto après 48 h."""
    result = await db.execute(
        select(Customer).options(selectinload(Customer.advisor)).where(Customer.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if customer is None or customer.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Customer not found")
    await ensure_customer_access(user, customer)

    code = customer.customer_code
    await soft_delete_customer(db, customer)
    await log_action(
        db,
        user_id=user.id,
        action="trash_customer",
        entity_type="customer",
        entity_id=code,
    )
    return None


@router.post("/{customer_id}/programs", response_model=CustomerProgramOut)
async def assign_program(
    customer_id: int,
    payload: AssignProgramRequest,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor)),
):
    customer = (
        await db.execute(select(Customer).where(Customer.id == customer_id))
    ).scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    await ensure_customer_access(user, customer)

    program = (
        await db.execute(select(CareProgram).where(CareProgram.id == payload.program_id))
    ).scalar_one_or_none()
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")

    assignment = CustomerProgram(
        customer_id=customer.id,
        program_id=program.id,
        notes=payload.notes,
    )
    db.add(assignment)
    await db.flush()
    await log_action(
        db,
        user_id=user.id,
        action="assign_program",
        entity_type="customer",
        entity_id=customer.customer_code,
        details={"program_id": program.id},
    )
    return CustomerProgramOut(
        id=assignment.id,
        customer_id=customer.id,
        program_id=program.id,
        program_name=program.name,
        assigned_at=assignment.assigned_at,
        notes=assignment.notes,
    )


@router.get("/{customer_id}/programs", response_model=list[CustomerProgramOut])
async def list_customer_programs(
    customer_id: int,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor, UserRole.manager)),
):
    customer = (
        await db.execute(select(Customer).where(Customer.id == customer_id))
    ).scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    await ensure_customer_access(user, customer)

    rows = (
        await db.execute(
            select(CustomerProgram)
            .options(selectinload(CustomerProgram.program))
            .where(CustomerProgram.customer_id == customer_id)
            .order_by(CustomerProgram.assigned_at.desc())
        )
    ).scalars().all()
    return [
        CustomerProgramOut(
            id=r.id,
            customer_id=r.customer_id,
            program_id=r.program_id,
            program_name=r.program.name,
            assigned_at=r.assigned_at,
            notes=r.notes,
        )
        for r in rows
    ]


@router.post("/{customer_id}/products", response_model=CustomerProductOut)
async def recommend_product(
    customer_id: int,
    payload: RecommendProductRequest,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor)),
):
    from app.models.entities import Product

    customer = (
        await db.execute(select(Customer).where(Customer.id == customer_id))
    ).scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    await ensure_customer_access(user, customer)

    product = (
        await db.execute(select(Product).where(Product.id == payload.product_id))
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    recommendation = CustomerProduct(
        customer_id=customer.id,
        product_id=product.id,
        notes=payload.notes,
    )
    db.add(recommendation)
    await db.flush()
    await log_action(
        db,
        user_id=user.id,
        action="recommend_product",
        entity_type="customer",
        entity_id=customer.customer_code,
        details={"product_id": product.id},
    )
    return CustomerProductOut(
        id=recommendation.id,
        customer_id=customer.id,
        product_id=product.id,
        product_name=product.name,
        product_price=product.price,
        purchase_url=product.purchase_url or f"{settings.pharmacy_base_url}/product/{product.id}",
        recommended_at=recommendation.recommended_at,
        notes=recommendation.notes,
    )


@router.get("/{customer_id}/products", response_model=list[CustomerProductOut])
async def list_customer_products(
    customer_id: int,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin, UserRole.advisor, UserRole.manager)),
):
    customer = (
        await db.execute(select(Customer).where(Customer.id == customer_id))
    ).scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    await ensure_customer_access(user, customer)

    rows = (
        await db.execute(
            select(CustomerProduct)
            .options(selectinload(CustomerProduct.product))
            .where(CustomerProduct.customer_id == customer_id)
            .order_by(CustomerProduct.recommended_at.desc())
        )
    ).scalars().all()
    return [
        CustomerProductOut(
            id=r.id,
            customer_id=r.customer_id,
            product_id=r.product_id,
            product_name=r.product.name,
            product_price=r.product.price,
            purchase_url=r.product.purchase_url or f"{settings.pharmacy_base_url}/product/{r.product.id}",
            recommended_at=r.recommended_at,
            notes=r.notes,
        )
        for r in rows
    ]
