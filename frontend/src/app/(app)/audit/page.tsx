"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Paginated } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/context/auth-context";

interface AuditLog {
  id: number;
  user_id?: number | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export default function AuditPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["audit"],
    enabled: user?.role === "admin",
    queryFn: async () => (await api.get<Paginated<AuditLog>>("/audit-logs", { params: { page_size: 100 } })).data,
  });

  if (user?.role !== "admin") return <p className="text-[var(--danger)]">غير مسموح بالوصول.</p>;

  return (
    <div>
      <PageHeader title="سجل النشاط" description="تتبع الإجراءات الحساسة داخل النظام." />
      <div className="panel overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المستخدم</th>
                <th>الإجراء</th>
                <th>العنصر</th>
                <th>التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5}>جاري التحميل…</td>
                </tr>
              ) : null}
              {data?.items.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.created_at)}</td>
                  <td>{log.user_id ?? "النظام"}</td>
                  <td>{log.action}</td>
                  <td>
                    {log.entity_type || "—"} {log.entity_id || ""}
                  </td>
                  <td className="max-w-xs truncate text-xs" dir="ltr">
                    {log.details ? JSON.stringify(log.details) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
