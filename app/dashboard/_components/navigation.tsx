"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, Clock3, History, Users, Calendar, Wallet, ShieldAlert, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SessionUser } from "@/lib/auth/session";
import { ROLE_LABEL, can, PERMISSIONS, type Permission } from "@/lib/auth/permissions";

type Item = { label: string; href: string; Icon: typeof LayoutDashboard; need?: Permission };

/** Hanya halaman yang benar-benar ada. Tambah link saat halamannya dibuat. */
const ITEMS: Item[] = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Absensi", href: "/absensi/hari-ini", Icon: Clock3 },
  { label: "Riwayat", href: "/absensi/riwayat", Icon: History, need: PERMISSIONS.ATTENDANCE_HISTORY_SELF },
  { label: "Karyawan", href: "/karyawan", Icon: Users, need: PERMISSIONS.EMPLOYEE_MANAGE },
  { label: "Shift", href: "/shift", Icon: Calendar, need: PERMISSIONS.SHIFT_MANAGE },
  { label: "Penggajian", href: "/penggajian", Icon: Wallet, need: PERMISSIONS.PAYSLIP_VIEW_SELF },
  { label: "Keamanan", href: "/keamanan", Icon: ShieldAlert, need: PERMISSIONS.SECURITY_VIEW },
  { label: "Pengaturan", href: "/pengaturan/kantor", Icon: Settings, need: PERMISSIONS.SETTINGS_MANAGE },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function menuFor(role: SessionUser["role"]) {
  return ITEMS.filter((i) => !i.need || can(role, i.need));
}

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname() ?? "";
  const items = menuFor(user.role);

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-4 lg:flex">
      <Link href="/dashboard" className="px-3 py-1.5 text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
        Absensi
      </Link>

      <nav className="flex-1 space-y-1">
        {items.map(({ label, href, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm transition-colors",
              isActive(pathname, href)
                ? "bg-[var(--bg)] font-medium text-[var(--ink)]"
                : "text-[var(--ink-2)] hover:bg-[var(--bg)] hover:text-[var(--ink)]",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] pt-3">
        <p className="truncate px-3 text-[13px] font-medium text-[var(--ink)]">{user.fullName}</p>
        <p className="px-3 text-[11px] text-[var(--ink-2)]">{ROLE_LABEL[user.role]}</p>
        <Keluar />
      </div>
    </aside>
  );
}

export function MobileHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname() ?? "";
  const keluar = useKeluar();
  const items = menuFor(user.role);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 lg:hidden">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-[var(--ink)]">{user.fullName}</p>
        <p className="text-[11px] text-[var(--ink-2)]">{ROLE_LABEL[user.role]}</p>
      </div>
      <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-1">
        {items.map(({ label, href, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            className={cn(
              "rounded-[10px] p-2 transition-colors",
              isActive(pathname, href) ? "bg-[var(--bg)] text-[var(--ink)]" : "text-[var(--ink-2)] hover:bg-[var(--bg)]",
            )}
          >
            <Icon className="size-5" aria-hidden />
          </Link>
        ))}
        <button type="button" onClick={keluar} aria-label="Keluar" className="rounded-[10px] p-2 text-[var(--ink-2)] hover:bg-[var(--bg)]">
          <LogOut className="size-5" aria-hidden />
        </button>
        </div>
      </nav>
    </header>
  );
}

function useKeluar() {
  const router = useRouter();
  return async function keluar() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };
}

export function Keluar() {
  const keluar = useKeluar();
  return (
    <button
      type="button"
      onClick={keluar}
      className="mt-2 flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-[var(--ink-2)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)]"
    >
      <LogOut className="size-4 shrink-0" aria-hidden />
      Keluar
    </button>
  );
}
