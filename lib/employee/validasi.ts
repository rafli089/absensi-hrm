import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Validasi & normalisasi data karyawan, dipakai bersama oleh create (POST
 * /api/employee) dan update (PUT /api/employee/[id]) supaya aturan tidak
 * bercabang dua kali.
 */

const bodyKaryawan = z.object({
  employeeCode: z.string().min(1, "Kode karyawan wajib diisi.").max(20).trim(),
  fullName: z.string().min(2, "Nama minimal 2 karakter.").max(120).trim(),
  email: z.string().email("Format email tidak valid.").max(120).optional().or(z.literal("")),
  nik: z.string().max(20).trim().optional().or(z.literal("")),
  phone: z.string().max(30).trim().optional().or(z.literal("")),
  departmentId: z.string().max(60).optional().or(z.literal("")),
  positionId: z.string().max(60).optional().or(z.literal("")),
  joinDate: z.string().min(1, "Tanggal masuk wajib diisi."),
  employmentStatus: z.enum(["PERMANENT", "CONTRACT", "INTERN", "FREELANCE"]),
  employmentEndDate: z.string().optional().or(z.literal("")),
  bankName: z.string().max(80).trim().optional().or(z.literal("")),
  bankAccount: z.string().max(40).trim().optional().or(z.literal("")),
  taxNumber: z.string().max(30).trim().optional().or(z.literal("")),
});

export type DataKaryawan = z.infer<typeof bodyKaryawan>;

/** String kosong dari form HTML berarti "tidak diisi", bukan string kosong. */
const kosong = <T extends string>(v: T | undefined) => (v ? v : undefined);

export type HasilParse =
  | { ok: true; data: Omit<DataKaryawan, "joinDate" | "employmentEndDate"> & { joinDate: Date; resignDate: Date | null } }
  | { ok: false; error: string; status: number };

/**
 * Parse body + cek rujukan FK. FK dicek manual karena `onDelete: SetNull`
 * akan menelan id yang salah diam-diam.
 */
export async function parseKaryawan(body: unknown): Promise<HasilParse> {
  let parsed: DataKaryawan;
  try {
    parsed = bodyKaryawan.parse(body);
  } catch (e) {
    const pesan = e instanceof z.ZodError ? (e.issues[0]?.message ?? "Format tidak valid.") : "Format tidak valid.";
    return { ok: false, error: pesan, status: 400 };
  }

  // Kolom @db.Date menyimpan bagian tanggal UTC. new Date("YYYY-MM-DD") sudah
  // UTC midnight, jadi JANGAN panggil setHours (lokal) — di UTC+7 itu mundur
  // satu hari.
  const joinDate = new Date(parsed.joinDate + "T00:00:00.000Z");
  if (Number.isNaN(joinDate.getTime())) return { ok: false, error: "Tanggal masuk tidak valid.", status: 400 };

  let resignDate: Date | null = null;
  if (parsed.employmentEndDate) {
    resignDate = new Date(parsed.employmentEndDate + "T00:00:00.000Z");
    if (Number.isNaN(resignDate.getTime())) return { ok: false, error: "Tanggal berhenti tidak valid.", status: 400 };
    if (resignDate < joinDate) return { ok: false, error: "Tanggal berhenti tidak boleh sebelum tanggal masuk.", status: 400 };
  }

  const nik = kosong(parsed.nik);
  if (nik && !/^\d{16}$/.test(nik)) {
    return { ok: false, error: "NIK harus 16 digit angka.", status: 400 };
  }

  const departmentId = kosong(parsed.departmentId);
  const positionId = kosong(parsed.positionId);
  if (departmentId && !(await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } }))) {
    return { ok: false, error: "Departemen tidak ditemukan.", status: 400 };
  }
  if (positionId && !(await prisma.position.findUnique({ where: { id: positionId }, select: { id: true } }))) {
    return { ok: false, error: "Jabatan tidak ditemukan.", status: 400 };
  }

  return {
    ok: true,
    data: {
      employeeCode: parsed.employeeCode,
      fullName: parsed.fullName,
      email: kosong(parsed.email),
      nik,
      phone: kosong(parsed.phone),
      departmentId,
      positionId,
      joinDate,
      resignDate,
      employmentStatus: parsed.employmentStatus,
      bankName: kosong(parsed.bankName),
      bankAccount: kosong(parsed.bankAccount),
      taxNumber: kosong(parsed.taxNumber),
    },
  };
}

/** Pesan 409 untuk unique violation. */
export function pesanBentrok(e: unknown): string | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = (e.meta?.target as string[] | string | undefined) ?? [];
    const kolom = Array.isArray(target) ? target.join(", ") : String(target);
    return `Nilai sudah dipakai (${kolom || "unik"}).`;
  }
  return null;
}
