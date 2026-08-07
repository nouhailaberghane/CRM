"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import type { Customer, Paginated } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { CUSTOMER_STATUSES } from "@/lib/customer-form-options";
import { useAuth } from "@/context/auth-context";

export default function AdminCustomersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers", search],
    enabled: user?.role === "admin",
    queryFn: async () =>
      (
        await api.get<Paginated<Customer>>("/customers", {
          params: { search: search || undefined, page_size: 50 },
        })
      ).data,
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: number) => api.delete(`/customers/${id}`),
    onSuccess: async () => {
      setMessage("تم نقل الاستمارة إلى سلة المحذوفات (حذف نهائي بعد 48 ساعة).");
      await qc.invalidateQueries({ queryKey: ["admin-customers"] });
      await qc.invalidateQueries({ queryKey: ["trash-customers"] });
    },
    onError: (err) => setMessage(getErrorMessage(err, "فشل الحذف")),
  });

  if (user?.role !== "admin") {
    return <p className="text-[var(--danger)]">الوصول مخصص للمدير فقط.</p>;
  }

  return (
    <div>
      <PageHeader
        title="جميع العميلات"
        description="عرض المدير — يمكن تعديل أو نقل أي استمارة إلى سلة المحذوفات."
        actions={
          <Link href="/trash" className="btn-secondary">
            <Trash2 size={14} />
            سلة المحذوفات
          </Link>
        }
      />

      {message ? (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: "var(--primary-soft)" }}>
          {message}
        </div>
      ) : null}

      <div className="panel mb-4 p-4">
        <input
          className="input"
          placeholder="بحث بالمعرّف، الاسم، الهاتف، المدينة…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="panel overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>المعرّف</th>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>المدينة</th>
                <th>المستشارة</th>
                <th>مؤشر صحة البصيلات</th>
                <th>الحالة</th>
                <th>تاريخ الإنشاء</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9}>جاري التحميل…</td>
                </tr>
              ) : null}
              {data?.items.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-[var(--primary)]" dir="ltr">
                    {c.customer_code}
                  </td>
                  <td>{c.full_name || `${c.first_name} ${c.last_name}`}</td>
                  <td dir="ltr">{c.phone}</td>
                  <td>{c.city}</td>
                  <td>{c.advisor_name || "—"}</td>
                  <td>{c.humidity != null ? `${c.humidity}%` : "—"}</td>
                  <td>{CUSTOMER_STATUSES.find((s) => s.value === c.status)?.label || c.status}</td>
                  <td>{formatDate(c.created_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => router.push(`/customers/${c.id}/edit`)}
                      >
                        <Pencil size={14} />
                        تعديل
                      </button>
                      <button
                        className="btn-secondary"
                        type="button"
                        disabled={deleteCustomer.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `نقل استمارة ${c.customer_code} — ${c.full_name} إلى سلة المحذوفات؟\nتُحذف نهائيًا تلقائيًا بعد 48 ساعة.`
                            )
                          ) {
                            deleteCustomer.mutate(c.id);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && data?.items.length === 0 ? (
                <tr>
                  <td colSpan={9}>لا توجد عميلات بعد.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
