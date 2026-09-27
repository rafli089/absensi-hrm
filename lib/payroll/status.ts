import type { PayrollStatus } from "@prisma/client";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

/**
 * Alur status payroll (PRD §6.14).
 *
 * Dipakai bersama oleh `PATCH /api/payroll/[id]/status` dan halaman
 * /penggajian, supaya tombol yang tampil dan transisi yang diterima server
 * tidak bisa berbeda pendapat.
 */

/** Langkah berikutnya yang sah untuk tiap status sekarang. */
export const LANJUT: Record<PayrollStatus, readonly PayrollStatus[]> = {
  DRAFT: ["REVIEWED"],
  CALCULATED: ["REVIEWED"],
  REVIEWED: ["APPROVED", "DRAFT"],
  APPROVED: ["PAID", "DRAFT"],
  PAID: ["LOCKED", "DRAFT"],
  LOCKED: ["DRAFT"],
};

/** Transisi ini mengunci angka yang sudah disetujui — butuh izin approve. */
const PERLU_APPROVE: ReadonlySet<PayrollStatus> = new Set(["APPROVED", "PAID", "LOCKED"]);

export function izinUntuk(target: PayrollStatus): Permission {
  return PERLU_APPROVE.has(target) ? PERMISSIONS.PAYROLL_APPROVE : PERMISSIONS.PAYROLL_MANAGE;
}

/** Transisi sah yang boleh dilakukan pengguna dengan permission yang diberikan. */
export function transisiTersedia(
  dari: PayrollStatus,
  punya: (p: Permission) => boolean,
): PayrollStatus[] {
  return LANJUT[dari].filter((target) => punya(izinUntuk(target)));
}

export const LABEL_STATUS: Record<PayrollStatus, string> = {
  DRAFT: "Draft",
  CALCULATED: "Dihitung",
  REVIEWED: "Ditinjau",
  APPROVED: "Disetujui",
  PAID: "Dibayar",
  LOCKED: "Dikunci",
};
