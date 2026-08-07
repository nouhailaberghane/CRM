from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.core.deps import DbSession, require_roles
from app.models.entities import User, UserRole
from app.schemas.dashboard import DashboardResponse
from app.services.audit import log_action
from app.services.dashboard import get_dashboard
from app.services.exports import export_dashboard_pdf

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
async def dashboard(
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin)),
    advisor_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
):
    """Tableau de bord réservé exclusivement à l'administrateur."""
    return await get_dashboard(
        db,
        advisor_id=advisor_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/export-pdf")
async def export_pdf(
    db: DbSession,
    user: User = Depends(require_roles(UserRole.admin)),
    advisor_id: Optional[int] = None,
):
    data = await get_dashboard(db, advisor_id=advisor_id)
    content = export_dashboard_pdf(data)
    await log_action(db, user_id=user.id, action="export_dashboard_pdf", entity_type="dashboard")
    return StreamingResponse(
        iter([content]),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=dashboard-report.pdf"},
    )
