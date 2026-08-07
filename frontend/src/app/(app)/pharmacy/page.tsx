"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, X } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import type { Order, Paginated } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { digitsOnly, validatePhonePair } from "@/lib/phone";
import { PageHeader } from "@/components/ui/page-header";

const PRODUCTS: { type: string; price: number; label: string }[] = [
  { type: "Grow", price: 180, label: "Grow — 180 DH" },
  { type: "Loubana-oil", price: 150, label: "Loubana-oil — 150 DH" },
  { type: "pack", price: 300, label: "Pack — 300 DH" },
];

/** Flags de suivi commande */
const ORDER_STATUSES: { value: string; label: string; color: string }[] = [
  { value: "saisiee", label: "مسجّلة", color: "#2f6f4e" },
  { value: "occupee", label: "مشغولة", color: "#b45309" },
  { value: "pickup", label: "Pickup", color: "#1d4ed8" },
  { value: "livree", label: "مسلّمة", color: "#047857" },
  { value: "retournee", label: "ثم الاسترجاع", color: "#7c3aed" },
  { value: "annulee", label: "ملغاة", color: "#b42318" },
];

function statusMeta(status: string) {
  const found = ORDER_STATUSES.find((s) => s.value === status);
  if (found) return found;
  // Anciens statuts
  const legacy: Record<string, { label: string; color: string }> = {
    pending: { label: "مسجّلة", color: "#2f6f4e" },
    confirmed: { label: "مسجّلة", color: "#2f6f4e" },
    shipped: { label: "مشغولة", color: "#b45309" },
    delivered: { label: "مسلّمة", color: "#047857" },
    cancelled: { label: "ملغاة", color: "#b42318" },
  };
  return { value: status, label: legacy[status]?.label || status, color: legacy[status]?.color || "#5f6f66" };
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className="inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
      style={{ background: meta.color }}
    >
      {meta.label}
    </span>
  );
}

type FormState = {
  name: string;
  city: string;
  address: string;
  phone: string;
  phoneConfirm: string;
  productType: string;
  amount: number;
  status: string;
};

const emptyForm = (): FormState => ({
  name: "",
  city: "",
  address: "",
  phone: "",
  phoneConfirm: "",
  productType: "Grow",
  amount: 180,
  status: "saisiee",
});

export default function PharmacyPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState<Order | null>(null);
  const [phoneError, setPhoneError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["orders", search, statusFilter],
    queryFn: async () =>
      (
        await api.get<Paginated<Order>>("/orders", {
          params: {
            search: search || undefined,
            status: statusFilter || undefined,
            page_size: 50,
          },
        })
      ).data,
  });

  const createOrder = useMutation({
    mutationFn: async () =>
      api.post<Order>("/orders", {
        customer_name: form.name,
        city: form.city,
        address: form.address,
        phone: form.phone,
        product_type: form.productType,
        amount: Number(form.amount),
        status: form.status,
      }),
    onSuccess: async (res) => {
      setMessage(`تم تسجيل الطلب ${res.data.external_order_id}`);
      setForm(emptyForm());
      setPhoneError("");
      await qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => setMessage(getErrorMessage(err)),
  });

  const updateOrder = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("لا يوجد طلب للتعديل");
      return api.patch<Order>(`/orders/${editing.id}`, {
        customer_name: form.name,
        city: form.city,
        address: form.address,
        phone: form.phone,
        product_type: form.productType,
        amount: Number(form.amount),
        status: form.status,
      });
    },
    onSuccess: async () => {
      setMessage("تم تحديث الطلب.");
      setEditing(null);
      setForm(emptyForm());
      setPhoneError("");
      await qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => setMessage(getErrorMessage(err)),
  });

  const submitOrderForm = () => {
    const issue = validatePhonePair(form.phone, form.phoneConfirm);
    if (issue) {
      setPhoneError(issue);
      setMessage(issue);
      return;
    }
    setPhoneError("");
    if (editing) updateOrder.mutate();
    else createOrder.mutate();
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      api.patch<Order>(`/orders/${id}`, { status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => setMessage(getErrorMessage(err)),
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: number) => api.delete(`/orders/${id}`),
    onSuccess: async () => {
      setMessage("تم نقل الطلب إلى سلة المحذوفات (حذف نهائي بعد 48 ساعة).");
      await qc.invalidateQueries({ queryKey: ["orders"] });
      await qc.invalidateQueries({ queryKey: ["trash-orders"] });
    },
    onError: (err) => setMessage(getErrorMessage(err)),
  });

  const startEdit = (o: Order) => {
    const phone = digitsOnly(o.phone || "");
    setEditing(o);
    setForm({
      name: o.customer_name || "",
      city: o.city || "",
      address: o.address || "",
      phone,
      phoneConfirm: phone,
      productType: o.product_type || "Grow",
      amount: o.amount,
      status: ORDER_STATUSES.some((s) => s.value === o.status) ? o.status : "saisiee",
    });
    setMessage("");
    setPhoneError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyForm());
    setPhoneError("");
  };

  return (
    <div>
      <PageHeader
        title="طلبات الصيدلية"
        description="تسجيل ومتابعة الطلبات — الحالة، التعديل، والنقل إلى سلة المحذوفات"
        actions={
          <Link href="/trash" className="btn-secondary">
            <Trash2 size={14} />
            سلة المحذوفات
          </Link>
        }
      />

      <form
        className="panel mb-6 space-y-4 p-5"
        dir="rtl"
        onSubmit={(e) => {
          e.preventDefault();
          submitOrderForm();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-[var(--primary)]">
            {editing ? `تعديل الطلب ${editing.external_order_id}` : "طلب جديد"}
          </h3>
          {editing ? (
            <button className="btn-secondary" type="button" onClick={cancelEdit}>
              <X size={16} />
              إلغاء التعديل
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">الاسم *</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">المدينة *</label>
            <input
              className="input"
              required
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">العنوان *</label>
            <input
              className="input"
              required
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">رقم الهاتف * (يبدأ بـ 0 — 10 أرقام)</label>
            <input
              className="input"
              required
              dir="ltr"
              inputMode="numeric"
              pattern="0[0-9]{9}"
              maxLength={10}
              placeholder="0612345678"
              value={form.phone}
              onChange={(e) => {
                setPhoneError("");
                setForm((f) => ({ ...f, phone: digitsOnly(e.target.value) }));
              }}
            />
          </div>
          <div>
            <label className="label">تأكيد رقم الهاتف *</label>
            <input
              className="input"
              required
              dir="ltr"
              inputMode="numeric"
              pattern="0[0-9]{9}"
              maxLength={10}
              placeholder="أعيدي إدخال الرقم"
              value={form.phoneConfirm}
              onChange={(e) => {
                setPhoneError("");
                setForm((f) => ({ ...f, phoneConfirm: digitsOnly(e.target.value) }));
              }}
            />
          </div>
          {phoneError ? (
            <div className="md:col-span-2">
              <p className="text-sm text-[var(--danger)]">{phoneError}</p>
            </div>
          ) : null}
          <div>
            <label className="label">نوع المنتج *</label>
            <select
              className="input"
              value={form.productType}
              onChange={(e) => {
                const type = e.target.value;
                const found = PRODUCTS.find((p) => p.type === type);
                setForm((f) => ({
                  ...f,
                  productType: type,
                  amount: found ? found.price : f.amount,
                }));
              }}
            >
              {PRODUCTS.map((p) => (
                <option key={p.type} value={p.type}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">المبلغ (DH) *</label>
            <input
              className="input"
              type="number"
              min={1}
              step="1"
              required
              dir="ltr"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label">حالة الطلب *</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {message ? (
          <p className="text-sm" style={{ color: message.includes("تم") ? "var(--primary)" : "var(--danger)" }}>
            {message}
          </p>
        ) : null}

        <button
          className="btn-primary"
          type="submit"
          disabled={createOrder.isPending || updateOrder.isPending}
        >
          {createOrder.isPending || updateOrder.isPending
            ? "جاري الحفظ…"
            : editing
              ? "حفظ التعديلات"
              : "تسجيل الطلب"}
        </button>
      </form>

      <div className="panel mb-4 grid gap-3 p-4 md:grid-cols-2">
        <input
          className="input"
          placeholder="بحث بالاسم / الهاتف / المدينة…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="panel overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المدينة</th>
                <th>العنوان</th>
                <th>الهاتف</th>
                <th>المنتج</th>
                <th>المبلغ</th>
                <th>الحالة</th>
                <th>التاريخ</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9}>جاري التحميل…</td>
                </tr>
              ) : null}
              {data?.items.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">{o.customer_name || "—"}</td>
                  <td>{o.city || "—"}</td>
                  <td className="max-w-xs truncate">{o.address || "—"}</td>
                  <td dir="ltr">{o.phone}</td>
                  <td>{o.product_type || o.items?.[0]?.product_name || "—"}</td>
                  <td dir="ltr">{o.amount} DH</td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={o.status} />
                      <select
                        className="input py-1 text-xs"
                        value={ORDER_STATUSES.some((s) => s.value === o.status) ? o.status : "saisiee"}
                        disabled={updateStatus.isPending}
                        onChange={(e) => updateStatus.mutate({ id: o.id, status: e.target.value })}
                        title="تغيير الحالة"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>{formatDate(o.created_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-secondary" type="button" onClick={() => startEdit(o)}>
                        <Pencil size={14} />
                        تعديل
                      </button>
                      <button
                        className="btn-secondary"
                        type="button"
                        disabled={deleteOrder.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `نقل الطلب ${o.external_order_id} إلى سلة المحذوفات؟\nيُحذف نهائيًا تلقائيًا بعد 48 ساعة.`
                            )
                          ) {
                            deleteOrder.mutate(o.id);
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
                  <td colSpan={9}>لا توجد طلبات بعد.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
