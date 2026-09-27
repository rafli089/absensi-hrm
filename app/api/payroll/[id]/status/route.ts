import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { headers } from "next/headers";
import { audit } from "@/lib/audit";

/**
 * PATCH /api/payroll/[id]/status
 * body: { status: "REVIEWED" | "APPROVED" | "PAID" | "LOCKED" | "DRAFT", reason?: string }
 *
 * Menutup siklus PRD §6.14 supaya payroll tidak cuma bisa dihitung. Endpoint
 * kalkulasi menolak payroll REVIEWED ke atas, jadi tanpa endpoint ini tidak
 * ada jalan untuk mengunci periode dari aplikasi.
 *
 * Arah maju dibatasi urutan: DRAFT → CALCULATED → REVIEWED → APPROVED →
 * PAID → LOCKED. Keputusan tiap langkah berbeda izinnya:
 *   REVIEWED, DRAFT : PAYROLL_MANAGE (HR memeriksa, atau reset bila salah)
 *   APPROVED, PAID, LOCKED : PAYROLL_APPROVE
 *
 * Kembali ke DRAFT butuh `reason` — ini membuka kunci angka yang sudah
 * disetujui, jadi alasan wajib masuk audit log.
 */

const TARGET = ["REVIEWED", "APPROVED", "PAID", "LOCKED", "DRAFT"] as const;

/** Langkah berikutnya yang sah untuk tiap status sekarang. */
const LANJUT: Record<string, readonly string[]> = {
  DRAFT: ["REVIEWED"],
  CALCULATED: ["REVIEWED"],
  REVIEWED: ["APPROVED", "DRAFT"],
  APPROVED: ["PAID", "DRAFT"],
  PAID: ["LOCKED", "DRAFT"],
  LOCKED: ["DRAFT"],
};

/** Transisi ini menyimpan uang negara — butuh PAYROLL_APPROVE. */
const PERLU_APPROVE = new Set(["APPROVED", "PAID", "LOCKED"]);

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

  const kebutuhan = PERLU_APPROVE.has(parsed.status)
    ? PERMISSIONS.PAYROLL_APPROVE
    : PERMISSIONS.PAYROLL_MANAGE;
  const auth = await requireApiPermission(kebutuhan);
  if (auth instanceof Response) return auth;

  if (parsed.status === "DRAFT" && !parsed.reason) {
    return Response.json({ error: "Transisi ke DRAFT wajib menyertakan alasan." }, { status: 400 });
  }

  const payroll = await prisma.payroll.findUnique({
    where: { id },
    select: { id: true, status: true },
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

  return Response.json({ ok: true, dari: payroll.status, ke: parsed.status });
}
