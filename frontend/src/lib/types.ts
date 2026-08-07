export type UserRole = "admin" | "advisor" | "pharmacy" | "manager" | "customer";

export interface User {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  advisor_id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  shared_workspace?: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CarePlan {
  case_summary?: string;
  possible_causes?: string;
  internal_diagnosis?: string;
  nutrition_advice?: string;
  external_care?: string;
  recommended_products_text?: string;
  program_duration?: string;
  next_follow_up?: string;
}

export interface Customer {
  id: number;
  customer_code: string;
  advisor_id: number;
  advisor_name?: string | null;
  full_name: string;
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  gender?: string | null;
  phone: string;
  email?: string | null;
  city: string;
  age?: number | null;
  hair_type?: string | null;
  hair_concerns?: string | null;
  questionnaire?: Record<string, unknown> | null;
  care_plan?: CarePlan | null;
  recommended_catalog?: string[] | null;
  status: string;
  notes?: string | null;
  humidity?: number | null;
  humidity_measured_at?: string | null;
  analysis_algorithm_version?: string | null;
  created_at: string;
  deleted_at?: string | null;
  purge_in_hours?: number | null;
  diagnostic_link?: string | null;
}

export interface Advisor {
  id: number;
  advisor_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  customer_count: number;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  description?: string | null;
  purchase_url?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CareProgram {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CustomerProgram {
  id: number;
  customer_id: number;
  program_id: number;
  program_name: string;
  assigned_at: string;
  notes?: string | null;
}

export interface CustomerProduct {
  id: number;
  customer_id: number;
  product_id: number;
  product_name: string;
  product_price: number;
  purchase_url?: string | null;
  recommended_at: string;
  notes?: string | null;
}

export interface OrderItem {
  id: number;
  product_id?: number | null;
  product_name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  external_order_id: string;
  customer_id?: number | null;
  customer_code?: string | null;
  customer_name?: string | null;
  city?: string | null;
  address?: string | null;
  phone: string;
  product_type?: string | null;
  advisor_id?: number | null;
  advisor_name?: string | null;
  amount: number;
  status: string;
  source?: string;
  notes?: string | null;
  created_at: string;
  deleted_at?: string | null;
  purge_in_hours?: number | null;
  items: OrderItem[];
}

export interface NamedCount {
  name: string;
  value: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface PharmacyAdvisorBreakdown {
  advisor_id?: number | null;
  advisor_code?: string | null;
  advisor_name: string;
  orders_count: number;
  revenue: number;
}

export interface PharmacyOrderAttribution {
  external_order_id: string;
  customer_name?: string | null;
  phone: string;
  product_type?: string | null;
  amount: number;
  status?: string | null;
  advisor_id?: number | null;
  advisor_code?: string | null;
  advisor_name?: string | null;
  matched: boolean;
  created_at: string;
}

export interface PharmacyStatusCount {
  status: string;
  label: string;
  count: number;
  revenue: number;
}

export interface PharmacyOrderKPIs {
  total: number;
  today: number;
  in_progress: number;
  livree: number;
  retournee: number;
  annulee: number;
  delivery_rate: number;
  revenue_total: number;
  revenue_delivered: number;
  by_status: PharmacyStatusCount[];
}

export interface DashboardData {
  kpis: {
    total_customers: number;
    customers_today: number;
    diagnostics_completed: number;
    average_humidity: number | null;
    total_orders: number;
    revenue: number;
    average_order_value: number | null;
    conversion_rate: number;
  };
  revenue_over_time: TimeSeriesPoint[];
  orders_per_advisor: NamedCount[];
  customers_per_advisor: NamedCount[];
  top_products: NamedCount[];
  conversion_funnel: NamedCount[];
  customer_growth: TimeSeriesPoint[];
  customers_by_city: NamedCount[];
  top_advisors: NamedCount[];
  monthly_sales: TimeSeriesPoint[];
  pharmacy_kpis: PharmacyOrderKPIs;
  pharmacy_by_advisor: PharmacyAdvisorBreakdown[];
  pharmacy_order_attribution: PharmacyOrderAttribution[];
  pharmacy_unmatched_count: number;
}

export interface AdvisorStats {
  advisor_id: number;
  advisor_name: string;
  total_customers: number;
  diagnostics_completed: number;
  total_orders: number;
  revenue: number;
  conversion_rate: number;
}
