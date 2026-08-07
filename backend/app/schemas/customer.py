from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ORMModel
from app.services.phones import validate_local_phone

CATALOG_PRODUCTS = ["Grow", "لبانة", "Dermaroller", "Ketoderm"]
ANALYSIS_ALGORITHM_VERSION = "v1.0"


class CarePlanIn(BaseModel):
    case_summary: Optional[str] = None
    possible_causes: Optional[str] = None
    internal_diagnosis: Optional[str] = None
    nutrition_advice: Optional[str] = None
    external_care: Optional[str] = None
    recommended_products_text: Optional[str] = None
    program_duration: Optional[str] = None
    next_follow_up: Optional[str] = None


class CustomerCreate(BaseModel):
    advisor_name: str = Field(min_length=1, max_length=200)
    # 1. Perso
    full_name: str = Field(min_length=1, max_length=200)
    birth_date: date
    gender: str = Field(min_length=1, max_length=20)
    city: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=10, max_length=10)
    email: Optional[EmailStr] = None
    # 2–14 + medical (+ optional free text)
    questionnaire: dict[str, Any] = Field(default_factory=dict)
    notes: Optional[str] = None
    status: str = "formulaire_rempli"
    advisor_id: Optional[int] = None

    @field_validator("phone")
    @classmethod
    def check_phone(cls, value: str) -> str:
        return validate_local_phone(value)


class CustomerUpdate(BaseModel):
    advisor_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    full_name: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    questionnaire: Optional[dict[str, Any]] = None
    care_plan: Optional[CarePlanIn] = None
    recommended_catalog: Optional[list[str]] = None
    status: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def check_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return validate_local_phone(value)


class CustomerOut(ORMModel):
    id: int
    customer_code: str
    advisor_id: int
    advisor_name: Optional[str] = None
    full_name: str
    first_name: str
    last_name: str
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    phone: str
    email: Optional[str] = None
    city: str
    age: Optional[int] = None
    hair_type: Optional[str] = None
    hair_concerns: Optional[str] = None
    questionnaire: Optional[dict[str, Any]] = None
    care_plan: Optional[dict[str, Any]] = None
    recommended_catalog: Optional[list[Any]] = None
    status: str = "nouvelle"
    notes: Optional[str] = None
    humidity: Optional[float] = None
    humidity_measured_at: Optional[datetime] = None
    analysis_algorithm_version: Optional[str] = None
    created_at: datetime
    diagnostic_link: Optional[str] = None
    deleted_at: Optional[datetime] = None
    purge_in_hours: Optional[float] = None


class CustomerLookupOut(BaseModel):
    customer_code: str
    first_name: str
    full_name: Optional[str] = None
    valid: bool = True
    diagnostic_done: bool = False
    humidity: Optional[float] = None
    humidity_measured_at: Optional[datetime] = None
    analysis_algorithm_version: Optional[str] = None
    message: Optional[str] = None


class DiagnosticResult(BaseModel):
    customer_code: str
    humidity: float
    measured_at: datetime
    analysis_algorithm_version: str = ANALYSIS_ALGORITHM_VERSION
    message: str = "انتهى التحليل. تمت معالجة الصورة مؤقتاً ولم تُحفظ."
