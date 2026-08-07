"use client";

import { Menu, Moon, Sun, LogOut } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/context/theme-context";
import { APP_NAME } from "@/lib/brand";

const TITLES: Record<string, string> = {
  admin: "مساحة المدير",
  advisor: "مساحة المستشارة",
  pharmacy: "مساحة الصيدلية",
};

const SUBTITLES: Record<string, string> = {
  admin: "نظرة شاملة + لوحة التحكم",
  advisor: "استمارة العميلة + رابط التشخيص",
  pharmacy: "تسجيل الطلبات",
};

const MOBILE_LINKS: Record<string, [string, string][]> = {
  admin: [
    ["/dashboard", "لوحة التحكم"],
    ["/customers", "العميلات"],
    ["/pharmacy", "الطلبات"],
    ["/trash", "سلة المحذوفات"],
  ],
  advisor: [
    ["/workspace", "استمارة العميلة"],
    ["/trash", "سلة المحذوفات"],
  ],
  pharmacy: [
    ["/pharmacy", "الطلبات"],
    ["/trash", "سلة المحذوفات"],
  ],
};

export function Topbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const links = user ? MOBILE_LINKS[user.role] || [] : [];
  const showMenu = !!user && (user.role === "admin" || user.role === "advisor" || user.role === "pharmacy");

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur md:px-6"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in srgb, var(--bg-elevated) 88%, transparent)",
      }}
    >
      <div className="flex items-center gap-3">
        {showMenu ? (
          <button className="btn-secondary lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="القائمة">
            <Menu size={18} />
          </button>
        ) : null}
        <div>
          <p className="text-sm font-semibold">{user ? TITLES[user.role] || APP_NAME : APP_NAME}</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {user ? SUBTITLES[user.role] || "" : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-secondary" onClick={toggleTheme} aria-label="تبديل المظهر">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="btn-secondary" onClick={logout}>
          <LogOut size={16} />
          <span className="hidden sm:inline">تسجيل الخروج</span>
        </button>
      </div>

      {open && showMenu && (
        <div
          className="absolute right-3 top-16 w-56 rounded-2xl border p-2 shadow-soft lg:hidden"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="block rounded-xl px-3 py-2 text-sm hover:bg-[var(--primary-soft)]"
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
