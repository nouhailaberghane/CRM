from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select

from app.core.deps import DbSession, require_roles
from app.models.entities import AuditLog, User, UserRole
from app.schemas.common import ORMModel, PaginatedResponse

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


class AuditLogOut(ORMModel):
    id: int
    user_id: int | None
    action: str
    entity_type: str | None
    entity_id: str | None
    details: dict | None
    created_at: object


@router.get("", response_model=PaginatedResponse[AuditLogOut])
async def list_audit_logs(
    db: DbSession,
    _user: User = Depends(require_roles(UserRole.admin)),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    total = int((await db.execute(select(func.count()).select_from(AuditLog))).scalar_one() or 0)
    rows = (
        await db.execute(
            select(AuditLog)
            .order_by(desc(AuditLog.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    pages = (total + page_size - 1) // page_size if total else 0
    return PaginatedResponse(items=rows, total=total, page=page, page_size=page_size, pages=pages)
