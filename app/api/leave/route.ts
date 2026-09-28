import { prisma } from "@/lib/db";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { headers } from "next/headers";
import { ForbiddenError, ValidationError, toResponse } from "@/lib/error";
import {
  KUOTA_ANNUAL_PER_TAHUN, LABEL_JENIS_CUTI, sisaKuota,
  validasiPengajuan, rentangTanggal, hitungHariKerja,
} from "@/lib/cuti/engine";
import { LeaveType } from "@prisma/client";
import { z } from "zod";
import { izinkan } from "@/lib/keamanan/rate-limit";
import { catatKeamanan } from "@/lib/audit";
import { kirimWebhook, webhookPayloadLeave } from "@/lib/integrasi/kirim";

/**
 * Pengajuan cuti (PRD §6.12).
 * POST → ajukan cuti (employee)
 * GET  → daftar pengajuan (employee = sendiri, approver = semua)
 */

const bodyAjukan = z.object({
  type: z.enum(["ANNUAL", "SICK", "PERSONAL", "UNPAID"]),
  dari: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  sampai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  reason: z.string().min(3, "Alasan minimal 3 karakter").max(500),
});

export async function POST(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.LEAVE_REQUEST);
  if (auth instanceof Response) return auth;
  if (!auth.employeeId) return toResponse(new ForbiddenError("Akun Anda belum terhubung ke data karyawan."));

  const rate = izinkan(`cuti:${auth.id}`, 5, 60_000);
  if (!rate.boleh) {
    await catatKeamanan({
      employeeId: auth.employeeId, userId: auth.id,
      eventType: "RATE_LIMIT_EXCEEDED", severity: "LOW",
      ipAddress: clientIp(await headers()),
      description: `Rate limit pengajuan cuti tercapai untuk ${auth.email}`,
    }).catch(() => {});
    return toResponse(new ValidationError([{ field: "_", message: "Terlalu banyak pengajuan. Tunggu sebentar." }]));
  }

  const parsed = bodyAjukan.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return toResponse(new ValidationError([{ field: issue?.path.join(".") ?? "_", message: issue?.message ?? "Data tidak valid." }]));
  }

  const { type, dari, sampai, reason } = parsed.data;
  const tglDari = new Date(`${dari}T00:00:00`);
  const tglSampai = new Date(`${sampai}T00:00:00`);
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);

  // Hitung hari annual yang sudah terpakai tahun ini
  const yearIni = hariIni.getFullYear();
  const terpakai = await prisma.leaveRequest.aggregate({
    where: { employeeId: auth.employeeId, type: "ANNUAL", status: { in: ["APPROVED", "PENDING"] }, date: { gte: new Date(yearIni, 0, 1), lt: new Date(yearIni + 1, 0, 1) } },
    _count: { id: true },
  });

  // Tanggal yang sudah ada pengajuan atau absensi (REJECTED/CANCELLED diabaikan)
  const sudahAda = new Set<number>();
  const [leaveLama, attLama] = await Promise.all([
    prisma.leaveRequest.findMany({ where: { employeeId: auth.employeeId, status: { in: ["PENDING", "APPROVED"] }, date: { gte: tglDari, lte: tglSampai } }, select: { date: true } }),
    prisma.attendance.findMany({ where: { employeeId: auth.employeeId, date: { gte: tglDari, lte: tglSampai } }, select: { date: true } }),
  ]);
  for (const r of [...leaveLama, ...attLama]) sudahAda.add(new Date(r.date).setHours(0, 0, 0, 0));

  const validasi = validasiPengajuan({
    type: type as LeaveType, dari: tglDari, sampai: tglSampai,
    hariIni, tanggalSudahDimiliki: sudahAda, terpakai: terpakai._count.id,
  });
  if (!validasi.ok) {
    return toResponse(new ValidationError([{ field: validasi.field ?? "_", message: validasi.message }]));
  }

  const hariKerja = hitungHariKerja(tglDari, tglSampai);
  const tanggalList = rentangTanggal(tglDari, tglSampai).filter((d) => { const h = d.getDay(); return h !== 0 && h !== 6; });

  const hasil = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const d of tanggalList) {
      const row = await tx.leaveRequest.create({
        data: { employeeId: auth.employeeId!, type: type as LeaveType, date: d, reason },
      });
      created.push(row);
    }
    return created;
  });

  await audit({ userId: auth.id, action: "CREATE", entityType: "leave_request", entityId: hasil[0]?.id ?? "", newValue: { type, dari, sampai, hariKerja }, ipAddress: clientIp(await headers()) }).catch(() => {});

  return Response.json({ ok: true, jumlahHari: hariKerja, sisaKuotaAnnual: sisaKuota(terpakai._count.id), label: LABEL_JENIS_CUTI[type as LeaveType], data: hasil }, { status: 201 });
}

/** GET: employee → own data. Approver → semua. */
export async function GET(req: Request) {
  // Coba approver dulu (supervisor/HR/admin)
  const authAll = await requireApiPermission(PERMISSIONS.LEAVE_VIEW_ALL);
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | null;

  if (!(authAll instanceof Response)) {
    // Approver: semua pengajuan
    const data = await prisma.leaveRequest.findMany({
      where: statusParam ? { status: statusParam } : {},
      include: {
        employee: { select: { fullName: true, employeeCode: true, department: { select: { name: true } } } },
        approvedBy: { select: { fullName: true } },
      },
      orderBy: [{ status: "asc" }, { date: "asc" }],
    });
    return Response.json({ ok: true, data });
  }

  // Employee: hanya milik sendiri
  const authSelf = await requireApiPermission(PERMISSIONS.LEAVE_REQUEST);
  if (authSelf instanceof Response) return authSelf;
  if (!authSelf.employeeId) return toResponse(new ForbiddenError("Akun tidak terhubung ke karyawan."));

  const [data, countResult] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { employeeId: authSelf.employeeId, ...(statusParam ? { status: statusParam } : {}) },
      include: { approvedBy: { select: { fullName: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.leaveRequest.aggregate({
      where: { employeeId: authSelf.employeeId, type: "ANNUAL", status: { in: ["APPROVED", "PENDING"] }, date: { gte: new Date(new Date().getFullYear(), 0, 1), lt: new Date(new Date().getFullYear() + 1, 0, 1) } },
      _count: { id: true },
    }),
  ]);

  return Response.json({
    ok: true,
    data,
    kuota: { annual: KUOTA_ANNUAL_PER_TAHUN, terpakai: countResult._count.id, sisa: sisaKuota(countResult._count.id) },
  });
}

// ---------- APPROVE / REJECT ----------

const bodyKeputusan = z.object({
  id: z.string(),
  keputusan: z.enum(["APPROVED", "REJECTED"]),
  catatan: z.string().max(500).optional(),
});

/** PATCH: approve/reject pengajuan cuti yang PENDING. */
export async function PATCH(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.LEAVE_APPROVE);
  if (auth instanceof Response) return auth;
  if (!auth.employeeId) return toResponse(new ForbiddenError("Akun tidak terhubung ke karyawan."));

  const parsed = bodyKeputusan.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return toResponse(new ValidationError([{ field: issue?.path.join(".") ?? "_", message: issue?.message ?? "Data tidak valid." }]));
  }

  const { id, keputusan, catatan } = parsed.data;

  const existing = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: { select: { fullName: true, id: true } } } });
  if (!existing) return toResponse(new ValidationError([{ field: "id", message: "Pengajuan cuti tidak ditemukan." }]));
  if (existing.status !== "PENDING") {
    return toResponse(new ValidationError([{ field: "_", message: `Pengajuan ini sudah ${existing.status.toLowerCase()}.` }]));
  }

  // APPROVED → tulis/oversiapkan baris attendance LEAVE (PRD §6.12:
  // "attendance updated"). Hanya set status LEAVE kalau hari itu belum ada
  // check-in sungguhan (checkIn null) — jangan menimpa PRESENT yang nyata.
  // Check-in berikutnya tetap status LEAVE via presetStatus di check-in route.
  void await prisma.$transaction(async (tx) => {
    const lr = await tx.leaveRequest.update({
      where: { id },
      data: {
        status: keputusan,
        approvedById: auth.employeeId,
        decidedAt: new Date(),
        decisionNote: catatan ?? null,
      },
    });

    if (keputusan === "APPROVED") {
      const att = await tx.attendance.findUnique({
        where: { employeeId_date: { employeeId: existing.employeeId, date: existing.date } },
        select: { id: true, checkIn: true },
      });
      if (!att) {
        await tx.attendance.create({
          data: { employeeId: existing.employeeId, date: existing.date, status: "LEAVE" },
        });
      } else if (!att.checkIn) {
        await tx.attendance.update({
          where: { id: att.id },
          data: { status: "LEAVE" },
        });
      }
      // else: sudah hadir hari itu — biarkan attendance apa adanya.
    }
    return lr;
  });

  await audit({ userId: auth.id, action: keputusan === "APPROVED" ? "APPROVE" : "REJECT", entityType: "leave_request", entityId: id, newValue: { employee: existing.employee.fullName, date: existing.date, keputusan, catatan }, ipAddress: clientIp(await headers()) }).catch(() => {});

  kirimWebhook("leave.decided", webhookPayloadLeave({ id, employeeId: existing.employee.id, date: existing.date, type: existing.type, status: keputusan, approvedById: auth.employeeId }));

  return Response.json({ ok: true, status: keputusan, id });
}
