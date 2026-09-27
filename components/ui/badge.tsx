import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-[var(--border)] bg-black/[0.03] text-[var(--ink-2)]",
        success: "border-[var(--ok)]/20 bg-[var(--ok)]/10 text-[var(--ok)]",
        warning: "border-[var(--warn)]/20 bg-[var(--warn)]/10 text-[var(--warn)]",
        danger: "border-[var(--danger)]/20 bg-[var(--danger)]/10 text-[var(--danger)]",
        info: "border-[var(--info)]/20 bg-[var(--info)]/10 text-[var(--info)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Warna badge per status absensi (PRD §6.6). */
export const STATUS_ABSENSI: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  PRESENT: { label: "Hadir", tone: "success" },
  LATE: { label: "Terlambat", tone: "warning" },
  EARLY_LEAVE: { label: "Pulang Awal", tone: "warning" },
  ABSENT: { label: "Alpa", tone: "danger" },
  LEAVE: { label: "Cuti", tone: "info" },
  SICK: { label: "Sakit", tone: "info" },
  HOLIDAY: { label: "Hari Libur", tone: "neutral" },
  DAY_OFF: { label: "Libur", tone: "neutral" },
  OVERTIME: { label: "Lembur", tone: "success" },
  INCOMPLETE: { label: "Belum Lengkap", tone: "warning" },
  REJECTED: { label: "Ditolak", tone: "danger" },
};

export const STATUS_PAYROLL: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  CALCULATED: { label: "Dihitung", tone: "info" },
  REVIEWED: { label: "Ditinjau", tone: "info" },
  APPROVED: { label: "Disetujui", tone: "success" },
  PAID: { label: "Dibayar", tone: "success" },
  LOCKED: { label: "Dikunci", tone: "neutral" },
};

export const SEVERITY: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  INFO: { label: "Info", tone: "info" },
  LOW: { label: "Rendah", tone: "neutral" },
  MEDIUM: { label: "Sedang", tone: "warning" },
  HIGH: { label: "Tinggi", tone: "danger" },
  CRITICAL: { label: "Kritis", tone: "danger" },
};

export { badgeVariants };
