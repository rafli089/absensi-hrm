/**
 * Validasi URL webhook integrasi (PRD §18 / integrasi eksternal).
 *
 * Dipisah dari route supaya bisa diuji tanpa DB — ini cek di trust
 * boundary: URL datang dari input user, tapi fetch-nya dilakukan dari
 * server, jadi tanpa validasi ini endpoint jadi SSRF proxy ke layanan
 * internal (localhost, metadata cloud, subnet privat).
 */

export type HasilValidasiUrl =
  | { ok: true; url: string }
  | { ok: false; kode: "URL_INVALID" | "URL_HTTP_DITOLAK" | "URL_INTERNAL_DITOLAK"; pesan: string };

/** Host privat/loopback/link-local yang tidak boleh di-fetch server. */
function hostPrivat(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "::1" || h === "127.0.0.1" || h === "0.0.0.0") return true;
  if (h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".home")) return true;
  if (h === "169.254.169.254" || h === "100.100.100.200") return true; // cloud metadata
  if (h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true; // 172.16–172.31
  if (h.startsWith("[fc") || h.startsWith("[fd")) return true; // IPv6 ULA fc00::/7
  return false;
}

export function validasiUrlWebhook(input: unknown): HasilValidasiUrl {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, kode: "URL_INVALID", pesan: "URL tidak valid." };
  }

  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return { ok: false, kode: "URL_INVALID", pesan: "URL tidak valid." };
  }

  if (u.protocol !== "https:") {
    return { ok: false, kode: "URL_HTTP_DITOLAK", pesan: "URL harus https." };
  }
  if (hostPrivat(u.hostname)) {
    return { ok: false, kode: "URL_INTERNAL_DITOLAK", pesan: "Host internal tidak diizinkan." };
  }

  return { ok: true, url: u.toString() };
}

/** Prefix key di `AppSetting` — avoid tabrakan dengan setting lain. */
export const PREFIX = "integrasi/";

/** Event yang bisa menerima webhook — tunggal sumber kebenaran. */
export const JENIS_KEJADIAN = ["attendance.created", "leave.decided", "payroll.approved"] as const;
export type JenisKejadian = (typeof JENIS_KEJADIAN)[number];