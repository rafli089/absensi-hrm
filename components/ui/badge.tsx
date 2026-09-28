import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-label font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-black/[0.06] text-[var(--ink-2)]",
        success: "bg-[var(--ok)]/15 text-[var(--ok-ink)]",
        warning: "bg-[var(--warn)]/15 text-[var(--warn-ink)]",
        danger: "bg-[var(--danger)]/15 text-[var(--danger-ink)]",
        info: "bg-[var(--info)]/15 text-[var(--info-ink)]",
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
