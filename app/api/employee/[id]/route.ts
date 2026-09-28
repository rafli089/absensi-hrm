import { ConflictError, NotFoundError, toResponse } from "@/lib/error";
import { prisma } from "@/lib/db";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { headers } from "next/headers";
import { audit } from "@/lib/audit";
import { parseKaryawan, pesanBentrok } from "@/lib/employee/validasi";

/**
 * Detail karyawan (PRD §11.1).
 * GET   → satu karyawan
 * PUT   → ubah data
 * DELETE → nonaktifkan (soft delete)
 *
 * DELETE sengaja tidak hard delete: attendance, payroll, payslip sudah
 * mereujuk ke employee. `isActive: false` mencegah karyawan baru masuk
 * payroll tanpa menghapus riwayat. Hard delete hanya via skrip migrasi.
 */

/** Field yang ditampilkan di audit saat berubah. */
const JEJAK = ["employeeCode", "fullName", "email", "departmentId", "positionId", "employmentStatus", "isActive"] as const;

function ringkas(e: Record<string, unknown>) {
  return Object.fromEntries(JEJAK.map((k) => [k, e[k]]));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission(PERMISSIONS.EMPLOYEE_MANAGE);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const karyawan = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, role: true, status: true } },
    },
  });
  if (!karyawan) return toResponse(new NotFoundError("Karyawan", id));

  return Response.json({ ok: true, karyawan });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission(PERMISSIONS.EMPLOYEE_MANAGE);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const lama = await prisma.employee.findUnique({ where: { id } });
  if (!lama) return toResponse(new NotFoundError("Karyawan", id));

  const parsed = await parseKaryawan(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });

  try {
    const karyawan = await prisma.employee.update({ where: { id }, data: parsed.data });
    await audit({
      userId: auth.id,
      action: "UPDATE",
      entityType: "employee",
      entityId: id,
      oldValue: ringkas(lama as unknown as Record<string, unknown>),
      newValue: ringkas(karyawan as unknown as Record<string, unknown>),
      ipAddress: clientIp(await headers()),
    }).catch(() => {});

    return Response.json({ ok: true, karyawan });
  } catch (e) {
    const bentrok = pesanBentrok(e);
    if (bentrok) return toResponse(new ConflictError("Karyawan", bentrok));
    return toResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission(PERMISSIONS.EMPLOYEE_MANAGE);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const karyawan = await prisma.employee.findUnique({ where: { id }, select: { id: true, employeeCode: true, fullName: true, isActive: true } });
  if (!karyawan) return toResponse(new NotFoundError("Karyawan", id));

  if (karyawan.isActive) {
    await prisma.employee.update({
      where: { id },
      data: { isActive: false, resignDate: new Date() },
    });
    await audit({
      userId: auth.id,
      action: "DELETE",
      entityType: "employee",
      entityId: id,
      oldValue: { kode: karyawan.employeeCode, nama: karyawan.fullName, aktif: true },
      newValue: { aktif: false },
      ipAddress: clientIp(await headers()),
    }).catch(() => {});
    return Response.json({ ok: true, dinonaktifkan: true });
  }

  await prisma.employee.update({ where: { id }, data: { isActive: true, resignDate: null } });
  return Response.json({ ok: true, dinonaktifkan: false });
}
