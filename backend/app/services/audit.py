from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import AuditLog


async def log_action(
    db: AsyncSession,
    *,
    user_id: Optional[int],
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
        )
    )
