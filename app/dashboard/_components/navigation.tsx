"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, Clock3, History, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SessionUser } from "@/lib/auth/session";
import { ROLE_LABEL, STAFF_ROLES } from "@/lib/auth/permissions";

/** Hanya halaman yang benar-benar ada. Tambah link saat halamannya dibuat. */
const ITEMS = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Absensi", href: "/absensi/hari-ini", Icon: Clock3 },
  { label: "Riwayat", href: "/absensi/riwayat", Icon: History },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function menuFor(staff: boolean) {
  return staff ? [...ITEMS, { label: "Pengaturan", href: "/pengaturan/kantor", Icon: Settings }] : ITEMS;
}

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname() ?? "";
  const staff = STAFF_ROLES.includes(user.role);
  const items = menuFor(staff);

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
  const staff = STAFF_ROLES.includes(user.role);
  const items = menuFor(staff);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 lg:hidden">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-[var(--ink)]">{user.fullName}</p>
        <p className="text-[11px] text-[var(--ink-2)]">{ROLE_LABEL[user.role]}</p>
      </div>
      <nav className="flex shrink-0 items-center gap-1">
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
