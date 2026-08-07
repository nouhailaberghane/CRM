"use client";

import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Camera } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { getErrorMessage } from "@/lib/api";
import { APP_NAME } from "@/lib/brand";
import { expectedRoleForAccess, homeForRole } from "@/components/auth/role-guard";

type Access = "advisor" | "admin" | "pharmacy";

interface FormValues {
  email: string;
  password: string;
}

const ACCESS_META: Record<Access, { title: string; subtitle: string }> = {
  advisor: {
    title: "المستشارة",
    subtitle: "تعبئة استمارة العميلة وإعطاء المعرّف للتشخيص",
  },
  admin: {
    title: "المدير",
    subtitle: "لوحة التحكم، العميلات، الطلبات والإحصائيات",
  },
  pharmacy: {
    title: "الصيدلية",
    subtitle: "تسجيل الطلبات الواردة",
  },
};

function LoginForm() {
  const { login, clearSession } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const raw = params.get("access");
  const access: Access =
    raw === "admin" || raw === "pharmacy" || raw === "advisor" ? raw : "advisor";
  const meta = ACCESS_META[access];

  const { register, handleSubmit, formState, reset } = useForm<FormValues>({
    defaultValues: { email: "", password: "" },
  });

  const switchAccess = (next: Access) => {
    router.replace(next === "advisor" ? "/login" : `/login?access=${next}`);
    reset({ email: "", password: "" });
    setError("");
  };

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    try {
      const user = await login(values.email, values.password);
      const expected = expectedRoleForAccess(access);
      if (expected && user.role !== expected) {
        clearSession();
        setError(`هذا الحساب ليس صلاحية «${meta.title}». اختاري التبويب المناسب.`);
        return;
      }
      router.push(homeForRole(user.role));
    } catch (err) {
      setError(getErrorMessage(err, "فشل تسجيل الدخول"));
    }
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(135deg, rgba(47,111,78,0.16), transparent 40%), linear-gradient(320deg, rgba(143,191,159,0.22), transparent 45%), var(--bg)",
        }}
      />
      <div className="panel w-full max-w-md overflow-hidden">
        <div
          className="border-b px-8 py-7"
          style={{ borderColor: "var(--border)", background: "var(--primary-soft)" }}
        >
          <p className="display text-3xl leading-tight text-[var(--primary)] md:text-4xl">
            {APP_NAME}
          </p>
          <p className="mt-2 text-sm font-semibold">{meta.title}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {meta.subtitle}
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-8 py-7">
          <div className="grid grid-cols-3 gap-1 rounded-xl p-1 text-xs" style={{ background: "var(--bg)" }}>
            {(["advisor", "admin", "pharmacy"] as Access[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`rounded-lg px-2 py-2 font-medium transition ${
                  access === key ? "bg-[var(--primary)] text-white" : "hover:bg-[var(--primary-soft)]"
                }`}
                onClick={() => switchAccess(key)}
              >
                {ACCESS_META[key].title}
              </button>
            ))}
          </div>
          <div>
            <label className="label">اسم المستخدم</label>
            <input className="input" type="text" autoComplete="username" dir="ltr" {...register("email", { required: true })} />
          </div>
          <div>
            <label className="label">كلمة المرور</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              {...register("password", { required: true })}
            />
          </div>
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <button className="btn-primary w-full" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? "جاري الدخول…" : "تسجيل الدخول"}
          </button>
          <Link
            href="/diagnostic"
            className="btn-secondary flex w-full items-center justify-center gap-2"
          >
            <Camera size={16} />
            صفحة التشخيص للعميلة
          </Link>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
