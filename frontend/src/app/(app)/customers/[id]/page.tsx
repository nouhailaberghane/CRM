"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import type {
  CareProgram,
  Customer,
  CustomerProduct,
  CustomerProgram,
  Paginated,
  Product,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const [programId, setProgramId] = useState("");
  const [productId, setProductId] = useState("");
  const [message, setMessage] = useState("");

  const customer = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => (await api.get<Customer>(`/customers/${id}`)).data,
  });
  const programs = useQuery({
    queryKey: ["programs"],
    queryFn: async () => (await api.get<CareProgram[]>("/programs")).data,
  });
  const products = useQuery({
    queryKey: ["products-all"],
    queryFn: async () =>
      (await api.get<Paginated<Product>>("/products", { params: { page_size: 100 } })).data.items,
  });
  const historyPrograms = useQuery({
    queryKey: ["customer-programs", id],
    queryFn: async () => (await api.get<CustomerProgram[]>(`/customers/${id}/programs`)).data,
  });
  const historyProducts = useQuery({
    queryKey: ["customer-products", id],
    queryFn: async () => (await api.get<CustomerProduct[]>(`/customers/${id}/products`)).data,
  });

  const assignProgram = useMutation({
    mutationFn: async () =>
      api.post(`/customers/${id}/programs`, { program_id: Number(programId) }),
    onSuccess: async () => {
      setMessage("تم تعيين برنامج العناية.");
      setProgramId("");
      await qc.invalidateQueries({ queryKey: ["customer-programs", id] });
    },
    onError: (err) => setMessage(getErrorMessage(err)),
  });

  const recommendProduct = useMutation({
    mutationFn: async () =>
      api.post(`/customers/${id}/products`, { product_id: Number(productId) }),
    onSuccess: async () => {
      setMessage("تم اقتراح المنتج.");
      setProductId("");
      await qc.invalidateQueries({ queryKey: ["customer-products", id] });
    },
    onError: (err) => setMessage(getErrorMessage(err)),
  });

  if (customer.isLoading) return <p style={{ color: "var(--muted)" }}>جاري التحميل…</p>;
  if (!customer.data) return <p className="text-[var(--danger)]">العميلة غير موجودة.</p>;

  const c = customer.data;

  return (
    <div>
      <PageHeader
        title={`${c.first_name} ${c.last_name}`}
        description={`${c.customer_code} · ${c.city} · المستشارة ${c.advisor_name || c.advisor_id}`}
      />

      {message ? (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: "var(--primary-soft)" }}>
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="panel space-y-3 p-5 xl:col-span-1">
          <h3 className="text-lg font-semibold">الملف الشخصي</h3>
          <Info label="الهاتف" value={c.phone} />
          <Info label="البريد" value={c.email || "—"} />
          <Info label="العمر" value={String(c.age)} />
          <Info label="نوع الشعر" value={c.hair_type || "—"} />
          <Info label="الاهتمامات" value={c.hair_concerns || "—"} />
          <Info label="مؤشر صحة البصيلات" value={c.humidity != null ? `${c.humidity}%` : "غير مقاس"} />
          <Info label="تاريخ القياس" value={formatDate(c.humidity_measured_at)} />
          <Info label="تاريخ الإنشاء" value={formatDate(c.created_at)} />
          <Info label="ملاحظات" value={c.notes || "—"} />
        </div>

        <div className="space-y-4 xl:col-span-2">
          <div className="panel p-5">
            <h3 className="mb-3 text-lg font-semibold">الاستبيان</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(c.questionnaire || {}).map(([key, value]) => (
                <div key={key} className="rounded-xl p-3" style={{ background: "var(--primary-soft)" }}>
                  <p className="text-xs tracking-wide" style={{ color: "var(--muted)" }}>
                    {key.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 font-medium">{typeof value === "object" ? JSON.stringify(value) : String(value)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="mb-3 text-lg font-semibold">تعيين برنامج عناية</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select className="input" value={programId} onChange={(e) => setProgramId(e.target.value)}>
                <option value="">اختاري برنامجاً</option>
                {programs.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                className="btn-primary"
                disabled={!programId || assignProgram.isPending}
                onClick={() => assignProgram.mutate()}
              >
                تعيين
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {historyPrograms.data?.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between rounded-xl px-3 py-2 text-sm"
                  style={{ background: "var(--bg)" }}
                >
                  <span>{item.program_name}</span>
                  <span style={{ color: "var(--muted)" }}>{formatDate(item.assigned_at)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-5">
            <h3 className="mb-3 text-lg font-semibold">اقتراح منتجات</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">اختاري منتجاً</option>
                {products.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(p.price)}
                  </option>
                ))}
              </select>
              <button
                className="btn-primary"
                disabled={!productId || recommendProduct.isPending}
                onClick={() => recommendProduct.mutate()}
              >
                اقتراح
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {historyProducts.data?.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm"
                  style={{ background: "var(--bg)" }}
                >
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p style={{ color: "var(--muted)" }}>
                      {formatCurrency(item.product_price)} · {formatDate(item.recommended_at)}
                    </p>
                  </div>
                  {item.purchase_url ? (
                    <a className="btn-secondary" href={item.purchase_url} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} />
                      الصيدلية
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-wide" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
