from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CareProgramCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: Optional[str] = None


class CareProgramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CareProgramOut(ORMModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0)
    category: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    purchase_url: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = Field(default=None, gt=0)
    category: Optional[str] = None
    description: Optional[str] = None
    purchase_url: Optional[str] = None
    is_active: Optional[bool] = None


class ProductOut(ORMModel):
    id: int
    name: str
    price: float
    category: str
    description: Optional[str] = None
    purchase_url: Optional[str] = None
    is_active: bool
    created_at: datetime


class AssignProgramRequest(BaseModel):
    program_id: int
    notes: Optional[str] = None


class CustomerProgramOut(ORMModel):
    id: int
    customer_id: int
    program_id: int
    program_name: str
    assigned_at: datetime
    notes: Optional[str] = None


class RecommendProductRequest(BaseModel):
    product_id: int
    notes: Optional[str] = None


class CustomerProductOut(ORMModel):
    id: int
    customer_id: int
    product_id: int
    product_name: str
    product_price: float
    purchase_url: Optional[str] = None
    recommended_at: datetime
    notes: Optional[str] = None
