"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

/** Accueil après connexion — 3 accès séparés */
const HOME: Record<string, string> = {
  admin: "/dashboard",
  advisor: "/workspace",
  pharmacy: "/pharmacy",
};

/** Pages autorisées par rôle */
const ALLOWED: Record<string, string[]> = {
  admin: ["/dashboard", "/customers", "/pharmacy", "/advisors", "/audit", "/orders", "/products", "/programs", "/trash"],
  advisor: ["/workspace", "/customers", "/trash"],
  pharmacy: ["/pharmacy", "/trash"],
};

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const allowed = ALLOWED[user.role] || [];
    const ok = allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!ok) {
      router.replace(HOME[user.role] || "/login");
    }
  }, [user, pathname, router]);

  return <>{children}</>;
}

export function homeForRole(role: string) {
  return HOME[role] || "/login";
}

export function expectedRoleForAccess(access: string): string | null {
  if (access === "admin") return "admin";
  if (access === "advisor" || access === "conseillere") return "advisor";
  if (access === "pharmacy") return "pharmacy";
  return null;
}
