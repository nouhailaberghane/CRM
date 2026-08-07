"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import type { Customer, Paginated } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import {
  CustomerIntakeForm,
  type IntakeFormValues,
} from "@/components/customers/customer-intake-form";
import { customerToIntakeValues } from "@/lib/customer-intake";
import { CUSTOMER_STATUSES } from "@/lib/customer-form-options";

type Mode = "list" | "create" | "edit";

export default function WorkspacePage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("list");
  const [created, setCreated] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const advisorNames = useQuery({
    queryKey: ["advisor-names"],
    queryFn: async () =>
      (await api.get<{ id: number; name: string; advisor_code?: string }[]>("/advisors/names")).data,
  });

  const customers = useQuery({
    queryKey: ["workspace-customers", search],
    queryFn: async () =>
      (
        await api.get<Paginated<Customer>>("/customers", {
          params: { search: search || undefined, page_size: 50 },
        })
      ).data,
  });

  const createCustomer = useMutation({
    mutationFn: async (values: IntakeFormValues) => {
      const res = await api.post<Customer>("/customers", {
        advisor_name: values.advisor_name,
        full_name: values.full_name,
        birth_date: values.birth_date,
        gender: values.gender,
        city: values.city,
        phone: values.phone,
        notes: values.notes,
        questionnaire: values.questionnaire,
        status: "formulaire_rempli",
      });
      return res.data;
    },
    onSuccess: async (data) => {
      setCreated(data);
      setMode("list");
      await qc.invalidateQueries({ queryKey: ["workspace-customers"] });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async (values: IntakeFormValues) => {
      if (!editing) throw new Error("لا توجد عميلة للتعديل");
      const res = await api.patch<Customer>(`/customers/${editing.id}`, {
        advisor_name: values.advisor_name,
        full_name: values.full_name,
        birth_date: values.birth_date,
        gender: values.gender,
        city: values.city,
        phone: values.phone,
        notes: values.notes,
        questionnaire: values.questionnaire,
      });
      return res.data;
    },
    onSuccess: async () => {
      setMessage("تم تحديث الاستمارة بنجاح.");
      setEditing(null);
      setMode("list");
      await qc.invalidateQueries({ queryKey: ["workspace-customers"] });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: number) => api.delete(`/customers/${id}`),
    onSuccess: async () => {
      setMessage("تم نقل الاستمارة إلى سلة المحذوفات (حذف نهائي بعد 48 ساعة).");
      await qc.invalidateQueries({ queryKey: ["workspace-customers"] });
      await qc.invalidateQueries({ queryKey: ["trash-customers"] });
    },
    onError: (err) => setMessage(getErrorMessage(err, "فشل الحذف")),
  });

  if (created) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="تم تسجيل العميلة"
          description="أعطي العميلة معرّفها الشخصي لإجراء التشخيص من صفحة الدخول."
        />
        <div className="panel space-y-5 p-6 text-center">
          <div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              المعرّف الشخصي لهذه العميلة
            </p>
            <p className="display mt-2 text-6xl text-[var(--primary)]" dir="ltr">
              {created.customer_code}
            </p>
            <p className="mt-2 text-sm">
              {created.full_name} · المستشارة: {created.advisor_name}
            </p>
            <button
              className="btn-secondary mt-3"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(created.customer_code);
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 1500);
              }}
            >
              {copiedId ? <Check size={16} /> : <Copy size={16} />}
              نسخ المعرّف
            </button>
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              setCreated(null);
              setMode("list");
            }}
          >
            العودة إلى القائمة
          </button>
        </div>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div>
        <PageHeader title="استمارة جديدة" description="تعبئة استمارة تسجيل العميلة" />
        <CustomerIntakeForm
          advisorNames={advisorNames.data || []}
          submitting={createCustomer.isPending}
          error={createCustomer.isError ? getErrorMessage(createCustomer.error) : undefined}
          onCancel={() => setMode("list")}
          onSubmit={(v) => createCustomer.mutate(v)}
        />
      </div>
    );
  }

  if (mode === "edit" && editing) {
    return (
      <div>
        <PageHeader
          title={`تعديل الاستمارة — ${editing.customer_code}`}
          description={editing.full_name}
        />
        <CustomerIntakeForm
          key={editing.id}
          advisorNames={advisorNames.data || []}
          initialValues={customerToIntakeValues(editing)}
          submitLabel="حفظ التعديلات"
          submitting={updateCustomer.isPending}
          error={updateCustomer.isError ? getErrorMessage(updateCustomer.error) : undefined}
          onCancel={() => {
            setEditing(null);
            setMode("list");
          }}
          onSubmit={(v) => updateCustomer.mutate(v)}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="مساحة المستشارة"
        description="قائمة الاستمارات — التعديل أو النقل إلى سلة المحذوفات"
        actions={
          <>
            <Link href="/trash" className="btn-secondary">
              <Trash2 size={14} />
              سلة المحذوفات
            </Link>
            <button
              className="btn-primary"
              onClick={() => {
                setMessage("");
                setMode("create");
              }}
            >
              <Plus size={16} />
              استمارة جديدة
            </button>
          </>
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
          placeholder="بحث بالمعرّف، الاسم، الهاتف…"
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
                <th>الحالة</th>
                <th>التاريخ</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {customers.isLoading ? (
                <tr>
                  <td colSpan={8}>جاري التحميل…</td>
                </tr>
              ) : null}
              {customers.data?.items.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-[var(--primary)]" dir="ltr">
                    {c.customer_code}
                  </td>
                  <td>{c.full_name || `${c.first_name} ${c.last_name}`}</td>
                  <td dir="ltr">{c.phone}</td>
                  <td>{c.city}</td>
                  <td>{c.advisor_name || "—"}</td>
                  <td>{CUSTOMER_STATUSES.find((s) => s.value === c.status)?.label || c.status}</td>
                  <td>{formatDate(c.created_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => {
                          setMessage("");
                          setEditing(c);
                          setMode("edit");
                        }}
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
              {!customers.isLoading && customers.data?.items.length === 0 ? (
                <tr>
                  <td colSpan={8}>لا توجد استمارات بعد.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
