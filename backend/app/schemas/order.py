from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.entities import OrderStatus
from app.schemas.common import ORMModel
from app.services.phones import validate_local_phone

# Catalogue fixe parapharmacie (DH)
PHARMACY_PRODUCTS: dict[str, float] = {
    "Grow": 180.0,
    "Loubana-oil": 150.0,
    "pack": 300.0,
}


class OrderItemIn(BaseModel):
    product_id: Optional[int] = None
    product_name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(ge=1, default=1)
    price: float = Field(gt=0)


class OrderCreate(BaseModel):
    """Saisie simple commande parapharmacie."""

    customer_name: str = Field(min_length=1, max_length=200)  # الاسم
    city: str = Field(min_length=1, max_length=100)  # المدينة
    address: str = Field(min_length=1)  # العنوان
    phone: str = Field(min_length=10, max_length=10)  # رقم الهاتف
    product_type: str = Field(description="Grow | Loubana-oil | pack")
    amount: Optional[float] = Field(default=None, gt=0)  # المبلغ (auto si vide)
    status: OrderStatus = OrderStatus.saisiee

    @field_validator("phone")
    @classmethod
    def check_phone(cls, value: str) -> str:
        return validate_local_phone(value)

    @model_validator(mode="after")
    def apply_catalog_price(self):
        if self.product_type not in PHARMACY_PRODUCTS:
            raise ValueError(f"Type produit invalide. Choix: {', '.join(PHARMACY_PRODUCTS)}")
        if self.amount is None:
            self.amount = PHARMACY_PRODUCTS[self.product_type]
        return self


class OrderUpdate(BaseModel):
    customer_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    city: Optional[str] = Field(default=None, min_length=1, max_length=100)
    address: Optional[str] = Field(default=None, min_length=1)
    phone: Optional[str] = Field(default=None, min_length=10, max_length=10)
    product_type: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
    status: Optional[OrderStatus] = None
    notes: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def check_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return validate_local_phone(value)

    @model_validator(mode="after")
    def apply_catalog_price(self):
        if self.product_type is not None and self.product_type not in PHARMACY_PRODUCTS:
            raise ValueError(f"Type produit invalide. Choix: {', '.join(PHARMACY_PRODUCTS)}")
        if self.product_type is not None and self.amount is None:
            self.amount = PHARMACY_PRODUCTS[self.product_type]
        return self


class OrderImportItem(BaseModel):
    external_order_id: str
    phone: str
    customer_code: Optional[str] = None
    customer_name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    product_type: Optional[str] = None
    amount: float = Field(gt=0)
    status: OrderStatus = OrderStatus.saisiee
    created_at: Optional[datetime] = None
    notes: Optional[str] = None
    products: list[OrderItemIn] = []


class OrderImportRequest(BaseModel):
    orders: list[OrderImportItem]


class OrderItemOut(ORMModel):
    id: int
    product_id: Optional[int] = None
    product_name: str
    quantity: int
    price: float


class OrderOut(ORMModel):
    id: int
    external_order_id: str
    customer_id: Optional[int] = None
    customer_code: Optional[str] = None
    customer_name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    phone: str
    product_type: Optional[str] = None
    advisor_id: Optional[int] = None
    advisor_name: Optional[str] = None
    amount: float
    status: OrderStatus
    source: str = "message"
    notes: Optional[str] = None
    created_at: datetime
    deleted_at: Optional[datetime] = None
    purge_in_hours: Optional[float] = None
    items: list[OrderItemOut] = []
