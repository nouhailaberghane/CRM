import enum
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    advisor = "advisor"
    pharmacy = "pharmacy"
    manager = "manager"
    customer = "customer"


class OrderStatus(str, enum.Enum):
    """Statuts suivi commande parapharmacie."""

    saisiee = "saisiee"  # مسجّلة
    occupee = "occupee"  # مشغولة
    pickup = "pickup"  # استلام
    livree = "livree"  # مسلّمة
    retournee = "retournee"  # ثم الاسترجاع
    annulee = "annulee"  # ملغاة
    # Anciens statuts (compatibilité données existantes)
    pending = "pending"
    confirmed = "confirmed"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


class CustomerStatus(str, enum.Enum):
    nouvelle = "nouvelle"
    formulaire_rempli = "formulaire_rempli"
    analyse_effectuee = "analyse_effectuee"
    programme_envoye = "programme_envoye"
    produits_proposes = "produits_proposes"
    a_commande = "a_commande"
    en_suivi = "en_suivi"
    suivi_termine = "suivi_termine"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    advisor: Mapped[Optional["Advisor"]] = relationship(back_populates="user", uselist=False)


class Advisor(Base):
    """Profil conseillère (nom affiché). Pas de login individuel — espace commun partagé."""

    __tablename__ = "advisors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    advisor_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False, default="")
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[Optional["User"]] = relationship(back_populates="advisor")
    customers: Mapped[list["Customer"]] = relationship(back_populates="advisor")
    orders: Mapped[list["Order"]] = relationship(back_populates="advisor")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    customer_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    advisor_id: Mapped[int] = mapped_column(ForeignKey("advisors.id"), nullable=False, index=True)

    # 1. Informations personnelles
    full_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    birth_date: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    city: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255))

    # Compat / dérivés
    age: Mapped[Optional[int]] = mapped_column(Integer)
    hair_type: Mapped[Optional[str]] = mapped_column(String(100))
    hair_concerns: Mapped[Optional[str]] = mapped_column(Text)

    # 2–14 + analyses médicales + compléments (JSON structuré)
    questionnaire: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)

    # 15–16 Analyse image (photo jamais stockée)
    humidity: Mapped[Optional[float]] = mapped_column(Float)  # indice d'hydratation %
    humidity_measured_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    analysis_algorithm_version: Mapped[Optional[str]] = mapped_column(String(50))

    # 17 Programme de soins (conseillère)
    care_plan: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)

    # 18 Produits catalogue fixe (Grow, لبانة, …)
    recommended_catalog: Mapped[Optional[list[Any]]] = mapped_column(JSON)

    # 19 Statut
    status: Mapped[str] = mapped_column(
        String(40), default=CustomerStatus.nouvelle.value, nullable=False, index=True
    )

    # 20 Notes internes
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)

    advisor: Mapped["Advisor"] = relationship(back_populates="customers")
    programs: Mapped[list["CustomerProgram"]] = relationship(back_populates="customer")
    products: Mapped[list["CustomerProduct"]] = relationship(back_populates="customer")
    orders: Mapped[list["Order"]] = relationship(back_populates="customer")


class CareProgram(Base):
    __tablename__ = "care_programs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    assignments: Mapped[list["CustomerProgram"]] = relationship(back_populates="program")


class CustomerProgram(Base):
    __tablename__ = "customer_programs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("care_programs.id"), nullable=False, index=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[Optional[str]] = mapped_column(Text)

    customer: Mapped["Customer"] = relationship(back_populates="programs")
    program: Mapped["CareProgram"] = relationship(back_populates="assignments")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    purchase_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    recommendations: Mapped[list["CustomerProduct"]] = relationship(back_populates="product")
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="product")


class CustomerProduct(Base):
    __tablename__ = "customer_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    recommended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[Optional[str]] = mapped_column(Text)

    customer: Mapped["Customer"] = relationship(back_populates="products")
    product: Mapped["Product"] = relationship(back_populates="recommendations")


class Order(Base):
    """Table réservée aux commandes parapharmacie."""

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_order_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"), index=True)
    # Saisie parapharmacie
    customer_name: Mapped[Optional[str]] = mapped_column(String(200))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    address: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    product_type: Mapped[Optional[str]] = mapped_column(String(100))  # Grow | Loubana-oil | pack
    advisor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("advisors.id"), index=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, native_enum=False), default=OrderStatus.pending, index=True
    )
    source: Mapped[str] = mapped_column(String(30), default="message", nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    registered_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)

    customer: Mapped[Optional["Customer"]] = relationship(back_populates="orders")
    advisor: Mapped[Optional["Advisor"]] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False, index=True)
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id"))
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")
    product: Mapped[Optional["Product"]] = relationship(back_populates="order_items")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(100))
    entity_id: Mapped[Optional[str]] = mapped_column(String(100))
    details: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
