import { prisma } from "@/lib/db";

/**
 * Kirim webhook ke URL yang dikonfigurasi via `/api/integrasi`.
 * Fire-and-forget: tidak block request utama, error tidak dilempar.
 * Payload terstruktur supaya konsisten antar event.
 */
export async function kirimWebhook(event: string, payload: Record<string, unknown>) {
  const setting = await prisma.appSetting.findUnique({ where: { key: `integrasi/${event}` } });
  const url = (setting?.value as { url?: string })?.url;
  if (!url) return; // tidak dipasang

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "absensi-webhook/1.0" },
      body: JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // gagal dikirim — diam saja. Webhook adalah best-effort, bukan kritis.
    // Monitoring di Grafana/Prometheus nanti akan tahu kalau sering gagal.
  }
}

/** Helper event yang dipakai di route handler. */
export function webhookPayloadAttendance(a: { id: string; employeeId: string; date: Date; status: string; checkIn?: Date | null; checkOut?: Date | null }) {
  return { attendanceId: a.id, employeeId: a.employeeId, date: a.date, status: a.status, checkIn: a.checkIn?.toISOString() ?? null, checkOut: a.checkOut?.toISOString() ?? null };
}

export function webhookPayloadLeave(l: { id: string; employeeId: string; date: Date; type: string; status: string; approvedById?: string | null }) {
  return { leaveId: l.id, employeeId: l.employeeId, date: l.date, type: l.type, status: l.status, approvedById: l.approvedById ?? null };
}