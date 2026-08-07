"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import type { Paginated, Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/context/auth-context";

interface FormValues {
  name: string;
  price: number;
  category: string;
  description?: string;
  purchase_url?: string;
}

export default function ProductsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { category: "علاج", price: 25 },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["products", search],
    queryFn: async () =>
      (
        await api.get<Paginated<Product>>("/products", {
          params: { search: search || undefined, page_size: 100, active_only: false },
        })
      ).data,
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) =>
      api.post("/products", { ...values, price: Number(values.price) }),
    onSuccess: async () => {
      reset();
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
  });

  return (
    <div>
      <PageHeader title="المنتجات" description="كتالوج المنتجات لاقتراحات المستشارات." />

      {user?.role === "admin" ? (
        <form
          className="panel mb-4 grid gap-3 p-4 md:grid-cols-5"
          onSubmit={handleSubmit((v) => create.mutate(v))}
        >
          <input className="input" placeholder="الاسم" {...register("name", { required: true })} />
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="السعر"
            dir="ltr"
            {...register("price", { required: true, valueAsNumber: true })}
          />
          <input className="input" placeholder="الفئة" {...register("category", { required: true })} />
          <input className="input" placeholder="رابط الشراء" dir="ltr" {...register("purchase_url")} />
          <button className="btn-primary" disabled={create.isPending}>
            إضافة منتج
          </button>
          {create.isError ? (
            <p className="md:col-span-5 text-sm text-[var(--danger)]">{getErrorMessage(create.error)}</p>
          ) : null}
        </form>
      ) : null}

      <div className="panel mb-4 p-4">
        <input
          className="input"
          placeholder="بحث عن منتجات…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="panel overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الفئة</th>
                <th>السعر</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4}>جاري التحميل…</td>
                </tr>
              ) : null}
              {data?.items.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.category}</td>
                  <td>{formatCurrency(p.price)}</td>
                  <td>{p.is_active ? "نشط" : "غير نشط"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
