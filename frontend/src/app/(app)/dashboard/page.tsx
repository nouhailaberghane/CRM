"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { formatCurrency, formatDate, downloadBlob } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { DashboardCharts } from "@/components/charts/dashboard-charts";

const STATUS_COLORS: Record<string, string> = {
  saisiee: "#2f6f4e",
  occupee: "#b45309",
  pickup: "#1d4ed8",
  livree: "#047857",
  retournee: "#7c3aed",
  annulee: "#b42318",
};

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span style={{ color: "var(--muted)" }}>—</span>;
  const labels: Record<string, string> = {
    saisiee: "مسجّلة",
    occupee: "مشغولة",
    pickup: "Pickup",
    livree: "مسلّمة",
    retournee: "ثم الاسترجاع",
    annulee: "ملغاة",
  };
  const color = STATUS_COLORS[status] || "#5f6f66";
  return (
    <span
      className="inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
      style={{ background: color }}
    >
      {labels[status] || status}
    </span>
  );
}

export default function DashboardPage() {
  const [advisorFilter, setAdvisorFilter] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await api.get<DashboardData>("/dashboard");
      return res.data;
    },
  });

  const filterKey = advisorFilter.trim().toLowerCase();
  const pk = data?.pharmacy_kpis;

  const filteredByAdvisor = useMemo(() => {
    const list = data?.pharmacy_by_advisor || [];
    if (!filterKey) return list;
    return list.filter((item) => {
      const name = (item.advisor_name || "").toLowerCase();
      const code = (item.advisor_code || "").toLowerCase();
      const id = item.advisor_id != null ? String(item.advisor_id) : "";
      return name.includes(filterKey) || code.includes(filterKey) || id === filterKey;
    });
  }, [data?.pharmacy_by_advisor, filterKey]);

  const filteredOrders = useMemo(() => {
    const list = data?.pharmacy_order_attribution || [];
    if (!filterKey) return list;
    return list.filter((o) => {
      if (!o.matched) return false;
      const name = (o.advisor_name || "").toLowerCase();
      const code = (o.advisor_code || "").toLowerCase();
      const id = o.advisor_id != null ? String(o.advisor_id) : "";
      return name.includes(filterKey) || code.includes(filterKey) || id === filterKey;
    });
  }, [data?.pharmacy_order_attribution, filterKey]);

  return (
    <div>
      <PageHeader
        title="لوحة التحكم"
        description="إحصائيات ومؤشرات مسار العميلة ومتابعة طلبات الصيدلية حسب الحالة."
        actions={
          <button
            className="btn-secondary"
            onClick={() => downloadBlob("/dashboard/export-pdf", "dashboard-report.pdf")}
          >
            <Download size={16} />
            تصدير PDF
          </button>
        }
      />

      {isLoading ? <p style={{ color: "var(--muted)" }}>جاري التحميل…</p> : null}
      {error ? <p className="text-[var(--danger)]">الوصول مخصص للمدير فقط.</p> : null}

      {data ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="إجمالي العميلات" value={data.kpis.total_customers} hint="كل المستشارات" />
            <KpiCard label="مسجّلات اليوم" value={data.kpis.customers_today} />
            <KpiCard label="طلبات نشطة (إيراد)" value={data.kpis.total_orders} />
            <KpiCard label="الإيرادات" value={formatCurrency(data.kpis.revenue)} />
            <KpiCard
              label="متوسط قيمة الطلب"
              value={data.kpis.average_order_value != null ? formatCurrency(data.kpis.average_order_value) : "—"}
            />
            <KpiCard label="نسبة التحويل" value={`${data.kpis.conversion_rate}%`} />
          </div>

          {pk ? (
            <div className="panel mb-6 p-5">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">متابعة طلبات الصيدلية — مؤشرات الأداء</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  تتبع حالات الطلبات: مسجّلة، مشغولة، Pickup، مسلّمة، ثم الاسترجاع، ملغاة
                </p>
              </div>

              <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="إجمالي الطلبات" value={pk.total} hint="كل الحالات" />
                <KpiCard label="طلبات اليوم" value={pk.today} />
                <KpiCard label="قيد المتابعة" value={pk.in_progress} hint="مسجّلة + مشغولة + Pickup" />
                <KpiCard label="نسبة التسليم" value={`${pk.delivery_rate}%`} hint="من الطلبات المغلقة" />
                <KpiCard label="مسلّمة" value={pk.livree} hint={formatCurrency(pk.revenue_delivered)} />
                <KpiCard label="ثم الاسترجاع" value={pk.retournee} />
                <KpiCard label="ملغاة" value={pk.annulee} />
                <KpiCard label="إيرادات كل الطلبات" value={formatCurrency(pk.revenue_total)} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pk.by_status.map((item) => (
                  <div
                    key={item.status}
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: "var(--primary-soft)",
                      borderInlineStart: `4px solid ${STATUS_COLORS[item.status] || "var(--primary)"}`,
                    }}
                  >
                    <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                      {item.label}
                    </p>
                    <p
                      className="mt-1 text-2xl font-semibold"
                      style={{ color: STATUS_COLORS[item.status] || "var(--primary)" }}
                    >
                      {item.count}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                      {formatCurrency(item.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="panel mb-6 p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">طلبات الصيدلية حسب المستشارة</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  يتم الربط عبر رقم الهاتف: طلب الصيدلية ↔ عميلة مسجّلة من المستشارة
                </p>
              </div>
              {data.pharmacy_unmatched_count > 0 ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  غير مرتبطة بمستشارة: {data.pharmacy_unmatched_count}
                </p>
              ) : null}
            </div>

            <div className="mb-5">
              <label className="label">تصفية حسب المستشارة (الاسم أو المعرّف)</label>
              <input
                className="input max-w-md"
                placeholder="مثال: سارة أو CS000001"
                value={advisorFilter}
                onChange={(e) => setAdvisorFilter(e.target.value)}
              />
            </div>

            {filteredByAdvisor.length ? (
              <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredByAdvisor.map((item) => (
                  <div
                    key={item.advisor_code || item.advisor_name}
                    className="rounded-xl px-4 py-3"
                    style={{ background: "var(--primary-soft)" }}
                  >
                    <p className="text-xs font-medium" style={{ color: "var(--muted)" }} dir="ltr">
                      {item.advisor_code || "—"}
                    </p>
                    <p className="font-semibold text-[var(--primary)]">{item.advisor_name}</p>
                    <p className="mt-2 text-sm">
                      الطلبات: <strong>{item.orders_count}</strong>
                    </p>
                    <p className="text-sm">
                      المبلغ: <strong>{formatCurrency(item.revenue)}</strong>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-5 text-sm" style={{ color: "var(--muted)" }}>
                {filterKey
                  ? "لا توجد نتائج لهذا الفلتر."
                  : "لا توجد طلبات مرتبطة بمستشارة بعد. سجّلي طلبات بالصيدلية بنفس هاتف العميلات."}
              </p>
            )}

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>الطلب</th>
                    <th>الاسم</th>
                    <th>الهاتف</th>
                    <th>المنتج</th>
                    <th>الحالة</th>
                    <th>المبلغ</th>
                    <th>معرّف المستشارة</th>
                    <th>المستشارة</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o.external_order_id}>
                      <td dir="ltr">{o.external_order_id}</td>
                      <td>{o.customer_name || "—"}</td>
                      <td dir="ltr">{o.phone}</td>
                      <td>{o.product_type || "—"}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>{formatCurrency(o.amount)}</td>
                      <td dir="ltr">{o.advisor_code || "—"}</td>
                      <td>
                        {o.matched ? (
                          <span className="font-medium text-[var(--primary)]">{o.advisor_name}</span>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>غير مرتبطة</span>
                        )}
                      </td>
                      <td>{formatDate(o.created_at)}</td>
                    </tr>
                  ))}
                  {!filteredOrders.length ? (
                    <tr>
                      <td colSpan={9}>{filterKey ? "لا توجد نتائج." : "لا توجد طلبات بعد."}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <h3 className="mb-3 text-lg font-semibold">أفضل المستشارات</h3>
              <ul className="space-y-2">
                {data.top_advisors.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between rounded-xl px-3 py-2"
                    style={{ background: "var(--primary-soft)" }}
                  >
                    <span>{item.name}</span>
                    <span className="font-semibold">{formatCurrency(Number(item.value))}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel p-5">
              <h3 className="mb-3 text-lg font-semibold">أفضل المنتجات</h3>
              <ul className="space-y-2">
                {data.top_products.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between rounded-xl px-3 py-2"
                    style={{ background: "var(--primary-soft)" }}
                  >
                    <span>{item.name}</span>
                    <span className="font-semibold">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DashboardCharts data={data} />
        </>
      ) : null}
    </div>
  );
}
