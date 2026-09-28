import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { headers } from "next/headers";
import { audit } from "@/lib/audit";
import { AppError, toResponse } from "@/lib/error";

/**
 * Assign shift ke karyawan per tanggal (PRD §14).
 *
 * POST   → assign (upsert)
 * DELETE → cabut assign
 *
 * ponytail: model saat ini per-tanggal. Dalam praktik, shift kerja berulang
 * setiap Senin-Kamis. Untuk repetitive schedule, tambahkan tabel
 * `ShiftSchedule` dengan hari dalam seminggu, lalu bulk-generate ke
 * `employee_shifts`. MVP: manual per hari.
 */

const bodyAssign = z.object({
  employeeId: z.string().min(1),
  shiftId: z.string().min(1),
  date: z.string().min(1).refine((s) => !Number.isNaN(Date.parse(s)), "Tanggal tidak valid."),
});

export async function GET(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.SHIFT_MANAGE);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  if (!dateStr) return toResponse(new AppError("Parameter ?date=YYYY-MM-DD wajib.", "PARAM_WAJIB", 400));

  const date = new Date(dateStr + "T00:00:00.000Z");
  const assign = await prisma.employeeShift.findMany({
    where: { date },
    orderBy: { createdAt: "asc" },
    include: {
      employee: { select: { id: true, employeeCode: true, fullName: true, isActive: true } },
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
  });
  return Response.json({ ok: true, assign });
}

export async function POST(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.SHIFT_MANAGE);
  if (auth instanceof Response) return auth;

  let parsed;
  try {
    parsed = bodyAssign.parse(await req.json());
  } catch (e) {
    const pesan = e instanceof z.ZodError ? (e.issues[0]?.message ?? "Format tidak valid.") : "Format tidak valid.";
    return toResponse(new AppError(pesan, "FORMAT_TIDAK_VALID", 400));
  }

  const date = new Date(parsed.date + "T00:00:00.000Z");

  const [employee, shift] = await Promise.all([
    prisma.employee.findUnique({ where: { id: parsed.employeeId }, select: { id: true, fullName: true, isActive: true } }),
    prisma.shift.findUnique({ where: { id: parsed.shiftId }, select: { id: true, name: true } }),
  ]);

  if (!employee) return toResponse(new AppError("Karyawan tidak ditemukan.", "KARYAWAN_TIDAK_ADA", 400));
  if (!employee.isActive) return toResponse(new AppError("Karyawan nonaktif.", "KARYAWAN_NONAKTIF", 400));
  if (!shift) return toResponse(new AppError("Shift tidak ditemukan.", "SHIFT_TIDAK_ADA", 400));

  const result = await prisma.employeeShift.upsert({
    where: { employeeId_date: { employeeId: parsed.employeeId, date } },
    update: { shiftId: parsed.shiftId },
    create: { employeeId: parsed.employeeId, shiftId: parsed.shiftId, date },
    include: { employee: { select: { employeeCode: true, fullName: true } }, shift: { select: { name: true } } },
  });

  await audit({
    userId: auth.id,
    action: "UPDATE",
    entityType: "employeeShift",
    entityId: result.id,
    newValue: { employee: result.employee.employeeCode, shift: result.shift.name, date: date.toISOString().slice(0, 10) },
    ipAddress: clientIp(await headers()),
  }).catch(() => {});

  return Response.json({ ok: true, assign: result }, { status: 201 });
}

export async function DELETE(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.SHIFT_MANAGE);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return toResponse(new AppError("Parameter ?id= wajib.", "PARAM_WAJIB", 400));

  const target = await prisma.employeeShift.findUnique({ where: { id } });
  if (!target) return toResponse(new AppError("Assign tidak ditemukan.", "ASSIGN_TIDAK_ADA", 404));

  await prisma.employeeShift.delete({ where: { id } });
  await audit({
    userId: auth.id,
    action: "DELETE",
    entityType: "employeeShift",
    entityId: id,
    oldValue: { employeeId: target.employeeId, shiftId: target.shiftId, date: target.date.toISOString().slice(0, 10) },
    ipAddress: clientIp(await headers()),
  }).catch(() => {});

  return Response.json({ ok: true });
}
