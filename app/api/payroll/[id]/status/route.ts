import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { headers } from "next/headers";
import { audit } from "@/lib/audit";
import { izinUntuk, LANJUT } from "@/lib/payroll/status";
import { kirimWebhook } from "@/lib/integrasi/kirim";

/**
 * PATCH /api/payroll/[id]/status
 * body: { status: "REVIEWED" | "APPROVED" | "PAID" | "LOCKED" | "DRAFT", reason?: string }
 *
 * Menutup siklus PRD §6.14 supaya payroll tidak cuma bisa dihitung. Endpoint
 * kalkulasi menolak payroll REVIEWED ke atas, jadi tanpa endpoint ini tidak
 * ada jalan untuk mengunci periode dari aplikasi.
 *
 * Aturan transisi dan izin tinggal di `lib/payroll/status.ts` — dipakai
 * bersama halaman /penggajian supaya tombol UI dan validasi server tidak
 * bisa berbeda pendapat.
 *
 * Kembali ke DRAFT butuh `reason` — ini membuka kunci angka yang sudah
 * disetujui, jadi alasan wajib masuk audit log.
 */

const TARGET = ["REVIEWED", "APPROVED", "PAID", "LOCKED", "DRAFT"] as const;

const body = z.object({ status: z.enum(TARGET), reason: z.string().trim().min(1).optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch (e) {
    const pesan = e instanceof z.ZodError ? (e.issues[0]?.message ?? "Format tidak valid.") : "Format tidak valid.";
    return Response.json({ error: pesan }, { status: 400 });
  }

  const auth = await requireApiPermission(izinUntuk(parsed.status));
  if (auth instanceof Response) return auth;

  if (parsed.status === "DRAFT" && !parsed.reason) {
    return Response.json({ error: "Transisi ke DRAFT wajib menyertakan alasan." }, { status: 400 });
  }

  const payroll = await prisma.payroll.findUnique({
    where: { id },
    select: { id: true, status: true, employeeId: true, periodStart: true, periodEnd: true, netSalary: true },
  });
  if (!payroll) return Response.json({ error: "Payroll tidak ditemukan." }, { status: 404 });

  if (!LANJUT[payroll.status]?.includes(parsed.status)) {
    return Response.json(
      { error: `Payroll berstatus ${payroll.status} tidak bisa berubah menjadi ${parsed.status}.` },
      { status: 409 },
    );
  }

  const data: Record<string, unknown> = { status: parsed.status };
  if (parsed.status === "APPROVED") {
    data.approvedById = auth.id;
    data.approvedAt = new Date();
  }
  if (parsed.status === "DRAFT") {
    // Alasan jadi catatan permanen: inilah angka yang sudah disetujui tadi
    // dibuka kembali.
    data.notes = `${payroll.status} → DRAFT: ${parsed.reason}`;
    data.approvedById = null;
    data.approvedAt = null;
  }

  await prisma.payroll.update({ where: { id }, data });

  await audit({
    userId: auth.id,
    action: "UPDATE",
    entityType: "payroll",
    entityId: id,
    oldValue: { status: payroll.status },
    newValue: { status: parsed.status, reason: parsed.reason ?? null },
    ipAddress: clientIp(await headers()),
  }).catch(() => {});

  if (parsed.status === "APPROVED" || parsed.status === "PAID") {
    kirimWebhook("payroll.approved", {
      payrollId: payroll.id, employeeId: payroll.employeeId,
      periodStart: payroll.periodStart, periodEnd: payroll.periodEnd,
      netSalary: payroll.netSalary.toString(), status: parsed.status,
    });
  }

  return Response.json({ ok: true, dari: payroll.status, ke: parsed.status });
}
