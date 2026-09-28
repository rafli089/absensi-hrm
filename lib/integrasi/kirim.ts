import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * Kirim webhook ke URL yang dikonfigurasi via `/api/integrasi`.
 * Fire-and-forget: tidak block request utama, error tidak dilempar.
 *
 * Retry: 3 percobaan dengan backoff [0, 1s, 3s]. 4xx = salah konfigurasi
 * di sisi penerima, retry tak akan menolong — serah. 5xx/network = mungkin
 * transient, coba lagi. Setelah 3x gagal, log `warn` (pesan + event, tanpa
 * URL payload) supaya terlihat di observability, bukan hilang diam-diam.
 *
 * Adapter: URL `hooks.slack.com` (Slack incoming webhook) menyimpan payload
 * dengan formatnya sendiri `{text}` — bukan `{event, data}` generik. Host
 * lain (n8n/Zapier/Make/WA gateway) menerima format generik.
 *
 * ponytail: retry bisa menduplikasi notifikasi saat penerima sudah menerima
 * tapi response hilang di jalan. Aman untuk notifikasi (Slack/user), tapi
 * kalau webhook dipakai untuk aksi yang harus exactly-once (transaksi),
 * migrasi ke antrean BullMQ/pg-boss (skill §8) dulu.
 */

const PERCOBAAN = 3;
const BACKOFF_MS = [0, 1_000, 3_000];
const TIMEOUT_MS = 5_000;

/** Label Indonesia per event untuk Slack. */
const LABEL: Record<string, string> = {
  "attendance.created": "Absensi masuk",
  "leave.decided": "Cuti diputuskan",
  "payroll.approved": "Payroll disetujui",
};

/** Format nilai payload jadi teks ringkas untuk Slack. */
function fmt(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "-";
  if (nilai instanceof Date) return nilai.toISOString();
  if (typeof nilai === "object") return JSON.stringify(nilai);
  return String(nilai);
}

/** Slack incoming webhook cuma menerima `{text}` — bukan body generik. */
export function bodySlack(event: string, payload: Record<string, unknown>): { text: string } {
  const label = LABEL[event] ?? event;
  const baris = Object.entries(payload)
    .map(([k, v]) => `• ${k}: ${fmt(v)}`)
    .join("\n");
  return { text: `*${label}*\n${baris}` };
}

export function bodyGenerik(event: string, payload: Record<string, unknown>) {
  return { event, timestamp: new Date().toISOString(), data: payload };
}

export function isSlack(url: string): boolean {
  try {
    return new URL(url).hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}

/** Satu percobaan fetch. Return `Response | null` (null = network/timeout). */
async function coba(url: string, body: unknown): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "absensi-webhook/1.0" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

export async function kirimWebhook(event: string, payload: Record<string, unknown>) {
  const setting = await prisma.appSetting.findUnique({ where: { key: `integrasi/${event}` } });
  const url = (setting?.value as { url?: string })?.url;
  if (!url) return; // tidak dipasang

  const body = isSlack(url) ? bodySlack(event, payload) : bodyGenerik(event, payload);

  for (let i = 0; i < PERCOBAAN; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, BACKOFF_MS[i] ?? BACKOFF_MS.at(-1)!));
    const res = await coba(url, body);

    if (res?.ok) return;
    // 4xx: salah format/tolak permanen — retry tidak menolong.
    if (res && res.status >= 400 && res.status < 500) {
      log.warn("webhook_ditolak_penerima", { event, status: res.status });
      return;
    }
    // 5xx / null = transient, lanjut iterasi retry.
  }

  log.warn("webhook_gagal", { event, percobaan: PERCOBAAN });
}

/** Helper event yang dipakai di route handler. */
export function webhookPayloadAttendance(a: { id: string; employeeId: string; date: Date; status: string; checkIn?: Date | null; checkOut?: Date | null }) {
  return { attendanceId: a.id, employeeId: a.employeeId, date: a.date, status: a.status, checkIn: a.checkIn?.toISOString() ?? null, checkOut: a.checkOut?.toISOString() ?? null };
}

export function webhookPayloadLeave(l: { id: string; employeeId: string; date: Date; type: string; status: string; approvedById?: string | null }) {
  return { leaveId: l.id, employeeId: l.employeeId, date: l.date, type: l.type, status: l.status, approvedById: l.approvedById ?? null };
}