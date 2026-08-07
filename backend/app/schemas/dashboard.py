from typing import Optional

from pydantic import BaseModel


class KPIStats(BaseModel):
    total_customers: int
    customers_today: int
    diagnostics_completed: int
    average_humidity: Optional[float]
    total_orders: int
    revenue: float
    average_order_value: Optional[float]
    conversion_rate: float


class NamedCount(BaseModel):
    name: str
    value: float | int


class TimeSeriesPoint(BaseModel):
    date: str
    value: float


class PharmacyAdvisorBreakdown(BaseModel):
    advisor_id: Optional[int] = None
    advisor_code: Optional[str] = None
    advisor_name: str
    orders_count: int
    revenue: float


class PharmacyOrderAttribution(BaseModel):
    external_order_id: str
    customer_name: Optional[str] = None
    phone: str
    product_type: Optional[str] = None
    amount: float
    status: Optional[str] = None
    advisor_id: Optional[int] = None
    advisor_code: Optional[str] = None
    advisor_name: Optional[str] = None
    matched: bool
    created_at: str


class PharmacyStatusCount(BaseModel):
    status: str
    label: str
    count: int
    revenue: float = 0


class PharmacyOrderKPIs(BaseModel):
    """Suivi KPI des commandes parapharmacie (tous les statuts)."""

    total: int = 0
    today: int = 0
    in_progress: int = 0
    livree: int = 0
    retournee: int = 0
    annulee: int = 0
    delivery_rate: float = 0.0
    revenue_total: float = 0.0
    revenue_delivered: float = 0.0
    by_status: list[PharmacyStatusCount] = []


class DashboardResponse(BaseModel):
    kpis: KPIStats
    revenue_over_time: list[TimeSeriesPoint]
    orders_per_advisor: list[NamedCount]
    customers_per_advisor: list[NamedCount]
    top_products: list[NamedCount]
    conversion_funnel: list[NamedCount]
    customer_growth: list[TimeSeriesPoint]
    customers_by_city: list[NamedCount]
    top_advisors: list[NamedCount]
    monthly_sales: list[TimeSeriesPoint]
    pharmacy_kpis: PharmacyOrderKPIs = PharmacyOrderKPIs()
    pharmacy_by_advisor: list[PharmacyAdvisorBreakdown] = []
    pharmacy_order_attribution: list[PharmacyOrderAttribution] = []
    pharmacy_unmatched_count: int = 0


class AdvisorStats(BaseModel):
    advisor_id: int
    advisor_name: str
    total_customers: int
    diagnostics_completed: int
    total_orders: int
    revenue: float
    conversion_rate: float
