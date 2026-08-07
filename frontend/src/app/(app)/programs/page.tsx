"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api, getErrorMessage } from "@/lib/api";
import type { CareProgram } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/context/auth-context";

interface FormValues {
  name: string;
  description?: string;
}

export default function ProgramsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm<FormValues>();

  const { data, isLoading } = useQuery({
    queryKey: ["programs-all"],
    queryFn: async () => (await api.get<CareProgram[]>("/programs", { params: { active_only: false } })).data,
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) => api.post("/programs", values),
    onSuccess: async () => {
      reset();
      await qc.invalidateQueries({ queryKey: ["programs-all"] });
    },
  });

  return (
    <div>
      <PageHeader title="برامج العناية" description="برامج جاهزة يمكن للمستشارة تعيينها بعد التشخيص." />

      {user?.role === "admin" ? (
        <form className="panel mb-4 grid gap-3 p-4 md:grid-cols-3" onSubmit={handleSubmit((v) => create.mutate(v))}>
          <input className="input" placeholder="اسم البرنامج" {...register("name", { required: true })} />
          <input className="input" placeholder="الوصف" {...register("description")} />
          <button className="btn-primary" disabled={create.isPending}>
            إضافة برنامج
          </button>
          {create.isError ? (
            <p className="md:col-span-3 text-sm text-[var(--danger)]">{getErrorMessage(create.error)}</p>
          ) : null}
        </form>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? <p style={{ color: "var(--muted)" }}>جاري التحميل…</p> : null}
        {data?.map((program) => (
          <div key={program.id} className="panel p-5">
            <h3 className="display text-3xl text-[var(--primary)]">{program.name}</h3>
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              {program.description || "بدون وصف"}
            </p>
            <p className="mt-4 text-xs tracking-wide" style={{ color: "var(--muted)" }}>
              {program.is_active ? "نشط" : "غير نشط"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
