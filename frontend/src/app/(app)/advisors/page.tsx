"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api, getErrorMessage } from "@/lib/api";
import type { Advisor, Paginated } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/context/auth-context";

interface FormValues {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone?: string;
}

export default function AdvisorsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm<FormValues>();

  const { data, isLoading } = useQuery({
    queryKey: ["advisors"],
    queryFn: async () => (await api.get<Paginated<Advisor>>("/advisors", { params: { page_size: 100 } })).data,
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) => api.post("/advisors", values),
    onSuccess: async () => {
      reset();
      await qc.invalidateQueries({ queryKey: ["advisors"] });
    },
  });

  if (user?.role !== "admin" && user?.role !== "manager") {
    return <p className="text-[var(--danger)]">غير مسموح بالوصول.</p>;
  }

  return (
    <div>
      <PageHeader title="المستشارات" description="إدارة المستشارات ومتابعة عدد العميلات." />

      {user.role === "admin" ? (
        <form className="panel mb-4 grid gap-3 p-4 md:grid-cols-5" onSubmit={handleSubmit((v) => create.mutate(v))}>
          <input className="input" placeholder="الاسم الشخصي" {...register("first_name", { required: true })} />
          <input className="input" placeholder="النسب" {...register("last_name", { required: true })} />
          <input className="input" type="email" placeholder="البريد" dir="ltr" {...register("email", { required: true })} />
          <input
            className="input"
            type="password"
            placeholder="كلمة المرور"
            dir="ltr"
            {...register("password", { required: true, minLength: 8 })}
          />
          <button className="btn-primary" disabled={create.isPending}>
            إضافة مستشارة
          </button>
          {create.isError ? (
            <p className="md:col-span-5 text-sm text-[var(--danger)]">{getErrorMessage(create.error)}</p>
          ) : null}
        </form>
      ) : null}

      <div className="panel overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>المعرّف</th>
                <th>الاسم</th>
                <th>البريد</th>
                <th>الهاتف</th>
                <th>العميلات</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6}>جاري التحميل…</td>
                </tr>
              ) : null}
              {data?.items.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium text-[var(--primary)]" dir="ltr">
                    {a.advisor_code}
                  </td>
                  <td>
                    {a.first_name} {a.last_name}
                  </td>
                  <td dir="ltr">{a.email}</td>
                  <td dir="ltr">{a.phone || "—"}</td>
                  <td>{a.customer_count}</td>
                  <td>{a.is_active ? "نشطة" : "غير نشطة"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
