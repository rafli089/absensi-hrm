import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { headers } from "next/headers";
import { audit } from "@/lib/audit";

/**
 * Onboarding karyawan (PRD §11.1).
 * POST → buat data karyawan
 *
 * ponytail: buat saja, akun login terpisah. Akun User dibuat lewat
 * seed/admin. Kalau perlu "kirim link aktivasi", tambahkan endpoint
 * `/api/employee/[id]/aktivasi` yang emit token sekali pakai.
 */

const bodyKaryawan = z.object({
  employeeCode: z.string().min(1).max(20).trim(),
  fullName: z.string().min(2).max(120).trim(),
  email: z.string().email().max(120).optional().or(z.literal("")),
  nik: z.string().min(1).max(20).trim().optional().or(z.literal("")),
  phone: z.string().max(30).trim().optional().or(z.literal("")),
  departmentId: z.string().min(1).optional().or(z.literal("")),
  positionId: z.string().min(1).optional().or(z.literal("")),
  joinDate: z.string().min(1, "Tanggal masuk wajib diisi."),
  employmentStatus: z.enum(["PERMANENT", "CONTRACT", "INTERN", "FREELANCE"]).default("PERMANENT"),
  bankName: z.string().max(80).trim().optional().or(z.literal("")),
  bankAccount: z.string().max(40).trim().optional().or(z.literal("")),
  taxNumber: z.string().max(30).trim().optional().or(z.literal("")),
});

/** String kosong dari form HTML berarti "tidak diisi", bukan string kosong. */
const kosong = <T extends string>(v: T | undefined) => (v ? v : undefined);

export async function POST(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.EMPLOYEE_MANAGE);
  if (auth instanceof Response) return auth;

  let parsed;
  try {
    parsed = bodyKaryawan.parse(await req.json());
  } catch (e) {
    const pesan = e instanceof z.ZodError ? (e.issues[0]?.message ?? "Format tidak valid.") : "Format tidak valid.";
    return Response.json({ error: pesan }, { status: 400 });
  }

  const joinDate = new Date(parsed.joinDate);
  if (Number.isNaN(joinDate.getTime())) {
    return Response.json({ error: "Tanggal masuk tidak valid." }, { status: 400 });
  }

  // NIK 16 digit. Prisma hanya unik; validasi bentuk dicek di sini.
  const nik = kosong(parsed.nik?.trim());
  if (nik && !/^\d{16}$/.test(nik)) {
    return Response.json({ error: "NIK harus 16 digit angka." }, { status: 400 });
  }

  // department/position harus benar-benar ada, jangan sampai FK SetNull diam-diam.
  const departmentId = kosong(parsed.departmentId);
  const positionId = kosong(parsed.positionId);
  if (departmentId && !(await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } }))) {
    return Response.json({ error: "Departemen tidak ditemukan." }, { status: 400 });
  }
  if (positionId && !(await prisma.position.findUnique({ where: { id: positionId }, select: { id: true } }))) {
    return Response.json({ error: "Jabatan tidak ditemukan." }, { status: 400 });
  }

  try {
    const karyawan = await prisma.employee.create({
      data: {
        employeeCode: parsed.employeeCode,
        fullName: parsed.fullName,
        email: kosong(parsed.email?.trim()),
        nik,
        phone: kosong(parsed.phone?.trim()),
        departmentId,
        positionId,
        joinDate,
        employmentStatus: parsed.employmentStatus,
        bankName: kosong(parsed.bankName?.trim()),
        bankAccount: kosong(parsed.bankAccount?.trim()),
        taxNumber: kosong(parsed.taxNumber?.trim()),
      },
    });
    await audit({
      userId: auth.id,
      action: "CREATE",
      entityType: "employee",
      entityId: karyawan.id,
      newValue: { kode: karyawan.employeeCode, nama: karyawan.fullName },
      ipAddress: clientIp(await headers()),
    }).catch(() => {});

    return Response.json({ ok: true, karyawan }, { status: 201 });
  } catch (e) {
    // P2002 = unique violation. Kode karyawan, email, atau NIK bentrok.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = (e.meta?.target as string[] | string | undefined) ?? [];
      const kolom = Array.isArray(target) ? target.join(", ") : String(target);
      return Response.json({ error: `Nilai sudah dipakai (${kolom || "unik"}).` }, { status: 409 });
    }
    throw e;
  }
}
