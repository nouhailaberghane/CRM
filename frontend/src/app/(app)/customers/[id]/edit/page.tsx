"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import {
  CustomerIntakeForm,
  type IntakeFormValues,
} from "@/components/customers/customer-intake-form";
import { customerToIntakeValues } from "@/lib/customer-intake";
import { useAuth } from "@/context/auth-context";

export default function EditCustomerPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const qc = useQueryClient();

  const customer = useQuery({
    queryKey: ["customer", id],
    enabled: Number.isFinite(id),
    queryFn: async () => (await api.get<Customer>(`/customers/${id}`)).data,
  });

  const advisorNames = useQuery({
    queryKey: ["advisor-names"],
    queryFn: async () =>
      (await api.get<{ id: number; name: string; advisor_code?: string }[]>("/advisors/names")).data,
  });

  const updateCustomer = useMutation({
    mutationFn: async (values: IntakeFormValues) => {
      const res = await api.patch<Customer>(`/customers/${id}`, {
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
      await qc.invalidateQueries({ queryKey: ["customer", id] });
      await qc.invalidateQueries({ queryKey: ["admin-customers"] });
      router.push("/customers");
    },
  });

  if (user?.role !== "admin" && user?.role !== "advisor") {
    return <p className="text-[var(--danger)]">غير مسموح بالوصول.</p>;
  }

  if (customer.isLoading) return <p style={{ color: "var(--muted)" }}>جاري التحميل…</p>;
  if (!customer.data) return <p className="text-[var(--danger)]">العميلة غير موجودة.</p>;

  return (
    <div>
      <PageHeader
        title={`تعديل الاستمارة — ${customer.data.customer_code}`}
        description={customer.data.full_name}
      />
      <CustomerIntakeForm
        key={customer.data.id}
        advisorNames={advisorNames.data || []}
        initialValues={customerToIntakeValues(customer.data)}
        submitLabel="حفظ التعديلات"
        submitting={updateCustomer.isPending}
        error={updateCustomer.isError ? getErrorMessage(updateCustomer.error) : undefined}
        onCancel={() => router.push(user?.role === "admin" ? "/customers" : "/workspace")}
        onSubmit={(v) => updateCustomer.mutate(v)}
      />
    </div>
  );
}
