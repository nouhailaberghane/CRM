from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.deps import DbSession, require_roles
from app.models.entities import CareProgram, Product, User, UserRole
from app.schemas.catalog import (
    CareProgramCreate,
    CareProgramOut,
    CareProgramUpdate,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)
from app.schemas.common import PaginatedResponse
from app.services.audit import log_action

programs_router = APIRouter(prefix="/programs", tags=["Care Programs"])
products_router = APIRouter(prefix="/products", tags=["Products"])


@programs_router.get("", response_model=list[CareProgramOut])
async def list_programs(
    db: DbSession,
    _user: User = Depends(require_roles(UserRole.admin, UserRole.advisor)),
    active_only: bool = True,
):
    query = select(CareProgram).order_by(CareProgram.name)
    if active_only:
        query = query.where(CareProgram.is_active.is_(True))
    rows = (await db.execute(query)).scalars().all()
    return rows


@programs_router.post("", response_model=CareProgramOut, status_code=status.HTTP_201_CREATED)
async def create_program(
    payload: CareProgramCreate,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin)),
):
    program = CareProgram(**payload.model_dump())
    db.add(program)
    await db.flush()
    await log_action(db, user_id=user.id, action="create_program", entity_type="program", entity_id=str(program.id))
    return program


@programs_router.patch("/{program_id}", response_model=CareProgramOut)
async def update_program(
    program_id: int,
    payload: CareProgramUpdate,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin)),
):
    program = (
        await db.execute(select(CareProgram).where(CareProgram.id == program_id))
    ).scalar_one_or_none()
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(program, key, value)
    await log_action(db, user_id=user.id, action="update_program", entity_type="program", entity_id=str(program.id))
    return program


@products_router.get("", response_model=PaginatedResponse[ProductOut])
async def list_products(
    db: DbSession,
    _user: User = Depends(require_roles(UserRole.admin, UserRole.advisor, UserRole.pharmacy)),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    category: Optional[str] = None,
    active_only: bool = True,
):
    query = select(Product)
    count_query = select(func.count()).select_from(Product)
    if active_only:
        query = query.where(Product.is_active.is_(True))
        count_query = count_query.where(Product.is_active.is_(True))
    if search:
        like = f"%{search}%"
        query = query.where(Product.name.ilike(like))
        count_query = count_query.where(Product.name.ilike(like))
    if category:
        query = query.where(Product.category == category)
        count_query = count_query.where(Product.category == category)

    total = int((await db.execute(count_query)).scalar_one() or 0)
    rows = (
        await db.execute(
            query.order_by(Product.name).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().all()
    pages = (total + page_size - 1) // page_size if total else 0
    return PaginatedResponse(items=rows, total=total, page=page, page_size=page_size, pages=pages)


@products_router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin)),
):
    product = Product(**payload.model_dump())
    db.add(product)
    await db.flush()
    await log_action(db, user_id=user.id, action="create_product", entity_type="product", entity_id=str(product.id))
    return product


@products_router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin)),
):
    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    await log_action(db, user_id=user.id, action="update_product", entity_type="product", entity_id=str(product.id))
    return product
