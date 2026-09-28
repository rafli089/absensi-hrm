import { prisma } from "@/lib/db";
import { requireApiPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { validasiUrlWebhook, PREFIX, JENIS_KEJADIAN } from "@/lib/integrasi/webhook";

/**
 * Integrasi eksternal yang dirancang sebagai webhook generik supaya
 * Slack, WA gateway, atau email semua bisa dicolok tanpa kunci akses di kode.
 *
 * Konsep: pengguna cukup menempelkan URL webhook (Slack incoming-webhook,
 * n8n, Zapier, Make). Server hanya POST payload JSON tipis tiap kejadian
 * domain (attendance dibuat, cuti diputuskan, payroll disetujui).
 * Tiap penyedia punya format/payload sendiri, sehingga transformasi
 * akhir tinggal diatur di sisi penyedia — bukan di kode aplikasi.
 *
 * ponytail: migrasi ke antrean (BullMQ/pg-boss) bila volume notifikasi
 * sudah > beberapa ratus/hari atau butuh retry backoff.
 */

/** GET: daftar integrasi yang aktif. */
export async function GET() {
  const auth = await requireApiPermission(PERMISSIONS.USER_MANAGE);
  if (auth instanceof Response) return auth;

  const daftar = await prisma.appSetting.findMany({
    where: { key: { startsWith: PREFIX } },
    orderBy: { key: "asc" },
  });

  return Response.json({
    ok: true,
    data: daftar.map((d) => ({ event: d.key.slice(PREFIX.length), url: (d.value as { url?: string })?.url ?? "" })),
  });
}

/**
 * PUT: pasang atau lepas webhook untuk satu event.
 * URL kosong = hapus integrasi. Host dicek supaya tidak jadi SSRF
 * ke layanan internal (localhost, metadata cloud).
 */
export async function PUT(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.USER_MANAGE);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.event !== "string" || !JENIS_KEJADIAN.includes(body.event as (typeof JENIS_KEJADIAN)[number])) {
    return Response.json({ error: "Event tidak dikenal.", kode: "EVENT_INVALID" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (url) {
    const valid = validasiUrlWebhook(url);
    if (!valid.ok) {
      return Response.json({ error: valid.pesan, kode: valid.kode }, { status: 422 });
    }
    await prisma.appSetting.upsert({
      where: { key: `${PREFIX}${body.event}` },
      update: { value: { url: valid.url }, updatedBy: auth.id },
      create: { key: `${PREFIX}${body.event}`, value: { url: valid.url }, updatedBy: auth.id },
    });
  } else {
    await prisma.appSetting.deleteMany({ where: { key: `${PREFIX}${body.event}` } });
  }

  return Response.json({ ok: true, event: body.event, terpasang: Boolean(url) });
}