from typing import Optional

from pydantic import BaseModel, Field

from app.models.entities import UserRole
from app.schemas.common import ORMModel


class LoginRequest(BaseModel):
    # Identifiant libre : email OU username partagé (ex: conseillere)
    email: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(ORMModel):
    id: int
    email: str
    role: UserRole
    is_active: bool
    advisor_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    shared_workspace: bool = False


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
