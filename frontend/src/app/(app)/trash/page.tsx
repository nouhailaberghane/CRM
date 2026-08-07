"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import type { Customer, Order, Paginated } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/context/auth-context";
import { useState } from "react";

function hoursLabel(hours?: number | null) {
  if (hours == null) return "—";
  if (hours <= 0) return "حذف تلقائي قريبًا";
  if (hours < 1) return "أقل من ساعة";
  return `${Math.ceil(hours)} ساعة متبقية`;
}

export default function TrashPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const canCustomers = user?.role === "admin" || user?.role === "advisor";
  const canOrders = user?.role === "admin" || user?.role === "pharmacy";

  const customers = useQuery({
    queryKey: ["trash-customers"],
    enabled: !!canCustomers,
    queryFn: async () =>
      (await api.get<Paginated<Customer>>("/customers/trash/list", { params: { page_size: 100 } })).data,
  });

  const orders = useQuery({
    queryKey: ["trash-orders"],
    enabled: !!canOrders,
    queryFn: async () =>
      (await api.get<Paginated<Order>>("/orders/trash/list", { params: { page_size: 100 } })).data,
  });

  const restoreCustomer = useMutation({
    mutationFn: async (id: number) => api.post(`/customers/${id}/restore`),
    onSuccess: async () => {
      setMessage("تمت استعادة الاستمارة.");
      await qc.invalidateQueries({ queryKey: ["trash-customers"] });
      await qc.invalidateQueries({ queryKey: ["workspace-customers"] });
      await qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (err) => setMessage(getErrorMessage(err)),
  });

  const restoreOrder = useMutation({
    mutationFn: async (id: number) => api.post(`/orders/${id}/restore`),
    onSuccess: async () => {
      setMessage("تمت استعادة الطلب.");
      await qc.invalidateQueries({ queryKey: ["trash-orders"] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      await qc.invalidateQueries({ queryKey: ["pharmacy-orders"] });
    },
    onError: (err) => setMessage(getErrorMessage(err)),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="سلة المحذوفات"
        description="يمكنك استعادة أي عنصر يدويًا في أي وقت. العناصر غير المستعادة تُحذف نهائيًا تلقائيًا بعد 48 ساعة — بدون حذف يدوي من السلة."
      />

      {message ? (
        <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--primary-soft)" }}>
          {message}
        </p>
      ) : null}

      {canCustomers ? (
        <section className="panel overflow-hidden">
          <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-lg font-semibold">استمارات العميلات</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {customers.data?.total ?? 0} عنصر
            </p>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>المعرّف</th>
                  <th>الاسم</th>
                  <th>الهاتف</th>
                  <th>تاريخ الحذف</th>
                  <th>الوقت المتبقي</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {customers.isLoading ? (
                  <tr>
                    <td colSpan={6}>جاري التحميل…</td>
                  </tr>
                ) : null}
                {customers.data?.items.map((c) => (
                  <tr key={c.id}>
                    <td dir="ltr">{c.customer_code}</td>
                    <td>{c.full_name}</td>
                    <td dir="ltr">{c.phone}</td>
                    <td>{c.deleted_at ? formatDate(c.deleted_at) : "—"}</td>
                    <td>{hoursLabel(c.purge_in_hours)}</td>
                    <td>
                      <button
                        className="btn-primary"
                        type="button"
                        disabled={restoreCustomer.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `استعادة استمارة ${c.customer_code} — ${c.full_name} إلى القائمة؟`
                            )
                          ) {
                            restoreCustomer.mutate(c.id);
                          }
                        }}
                      >
                        <RotateCcw size={14} />
                        استعادة يدوية
                      </button>
                    </td>
                  </tr>
                ))}
                {!customers.isLoading && (customers.data?.items.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={6}>سلة استمارات العميلات فارغة.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canOrders ? (
        <section className="panel overflow-hidden">
          <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-lg font-semibold">طلبات الصيدلية</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {orders.data?.total ?? 0} عنصر
            </p>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>العميلة</th>
                  <th>الهاتف</th>
                  <th>المنتج</th>
                  <th>تاريخ الحذف</th>
                  <th>الوقت المتبقي</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {orders.isLoading ? (
                  <tr>
                    <td colSpan={7}>جاري التحميل…</td>
                  </tr>
                ) : null}
                {orders.data?.items.map((o) => (
                  <tr key={o.id}>
                    <td dir="ltr">{o.external_order_id}</td>
                    <td>{o.customer_name || "—"}</td>
                    <td dir="ltr">{o.phone}</td>
                    <td>{o.product_type || "—"}</td>
                    <td>{o.deleted_at ? formatDate(o.deleted_at) : "—"}</td>
                    <td>{hoursLabel(o.purge_in_hours)}</td>
                    <td>
                      <button
                        className="btn-primary"
                        type="button"
                        disabled={restoreOrder.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `استعادة الطلب ${o.external_order_id} إلى قائمة الطلبات؟`
                            )
                          ) {
                            restoreOrder.mutate(o.id);
                          }
                        }}
                      >
                        <RotateCcw size={14} />
                        استعادة يدوية
                      </button>
                    </td>
                  </tr>
                ))}
                {!orders.isLoading && (orders.data?.items.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={7}>سلة الطلبات فارغة.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
