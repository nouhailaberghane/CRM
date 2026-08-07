from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession
from app.core.security import create_access_token, hash_password, verify_password
from app.models.entities import User, UserRole
from app.schemas.auth import LoginRequest, PasswordChange, TokenResponse, UserOut
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["Authentication"])

SHARED_ADVISOR_LOGIN = "conseillere"


def is_shared_advisor(user: User) -> bool:
    return user.role == UserRole.advisor and (
        user.email.lower() == SHARED_ADVISOR_LOGIN or user.advisor is None
    )


def serialize_user(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        advisor_id=user.advisor.id if user.advisor else None,
        first_name=user.advisor.first_name if user.advisor else None,
        last_name=user.advisor.last_name if user.advisor else None,
        shared_workspace=is_shared_advisor(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DbSession):
    identifier = payload.email.strip().lower()
    result = await db.execute(
        select(User).options(selectinload(User.advisor)).where(User.email == identifier)
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiant ou mot de passe incorrect")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte inactif")

    token = create_access_token(str(user.id), {"role": user.role.value})
    await log_action(db, user_id=user.id, action="login", entity_type="user", entity_id=str(user.id))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return serialize_user(user)


@router.post("/change-password")
async def change_password(payload: PasswordChange, user: CurrentUser, db: DbSession):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    await log_action(db, user_id=user.id, action="change_password", entity_type="user", entity_id=str(user.id))
    return {"message": "Password updated"}
