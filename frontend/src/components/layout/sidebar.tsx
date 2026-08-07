"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ShoppingBag, UserCog, ScrollText, Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, roles: ["admin"] },
  { href: "/customers", label: "جميع العميلات", icon: Users, roles: ["admin"] },
  { href: "/pharmacy", label: "طلبات الصيدلية", icon: ShoppingBag, roles: ["admin", "pharmacy"] },
  { href: "/advisors", label: "المستشارات", icon: UserCog, roles: ["admin"] },
  { href: "/audit", label: "سجل النشاط", icon: ScrollText, roles: ["admin"] },
  { href: "/trash", label: "سلة المحذوفات", icon: Trash2, roles: ["admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (user?.role === "advisor") return null;
  if (user?.role === "pharmacy") return null;

  return (
    <aside
      className="hidden w-64 shrink-0 border-l lg:block"
      style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
    >
      <div className="flex h-full flex-col px-4 py-6">
        <div className="mb-8 px-2">
          <p className="display text-xl leading-tight text-[var(--primary)]">
            {APP_NAME}
          </p>
          <p className="mt-1 text-xs tracking-[0.08em]" style={{ color: "var(--muted)" }}>
            الإدارة
          </p>
        </div>
        <nav className="space-y-1">
          {links
            .filter((link) => user && link.roles.includes(user.role))
            .map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "hover:bg-[var(--primary-soft)]"
                  )}
                  style={{ color: active ? "var(--primary)" : "var(--fg)" }}
                >
                  <Icon size={18} />
                  {link.label}
                </Link>
              );
            })}
        </nav>
      </div>
    </aside>
  );
}
