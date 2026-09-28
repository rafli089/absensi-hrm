import { prisma } from "@/lib/db";
import { ConflictError, toResponse } from "@/lib/error";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { headers } from "next/headers";
import { audit } from "@/lib/audit";
import { parseKaryawan, pesanBentrok } from "@/lib/employee/validasi";

/**
 * Onboarding karyawan (PRD §11.1).
 * POST → buat data karyawan
 *
 * ponytail: buat saja, akun login terpisah. Akun User dibuat lewat
 * seed/admin. Kalau perlu "kirim link aktivasi", tambahkan endpoint
 * `/api/employee/[id]/aktivasi` yang emit token sekali pakai.
 */

export async function POST(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.EMPLOYEE_MANAGE);
  if (auth instanceof Response) return auth;

  const parsed = await parseKaryawan(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });

  try {
    const karyawan = await prisma.employee.create({ data: parsed.data });
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
    const bentrok = pesanBentrok(e);
    if (bentrok) return toResponse(new ConflictError("Karyawan", bentrok));
    return toResponse(e);
  }
}
