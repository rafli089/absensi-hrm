/**
 * Rate limiting in-memory per user (PRD §10: rate limiting).
 *
 * Cukup untuk satu instance Next.js. Kalau nanti di-scale multi-instance,
 * ganti isi `hitung` dengan hitting Redis — signature-nya sama.
 */

type Jendela = { jumlah: number; resetAt: number };

const toko = new Map<string, Jendela>();

export type HasilRate = { boleh: boolean; sisa: number; resetAt: number };

/** Sliding window sederhana: izinkan `maks` permintaan per `jendelaMs`. */
export function izinkan(kunci: string, maks: number, jendelaMs: number): HasilRate {
  const sekarang = Date.now();
  const ada = toko.get(kunci);

  if (!ada || ada.resetAt <= sekarang) {
    const baru: Jendela = { jumlah: 1, resetAt: sekarang + jendelaMs };
    toko.set(kunci, baru);
    return { boleh: true, sisa: maks - 1, resetAt: baru.resetAt };
  }

  if (ada.jumlah >= maks) {
    return { boleh: false, sisa: 0, resetAt: ada.resetAt };
  }

  ada.jumlah += 1;
  return { boleh: true, sisa: maks - ada.jumlah, resetAt: ada.resetAt };
}

/** Pembersih berkala supaya Map tidak tumbuh tanpa batas di server yang hidup lama. */
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const sekarang = Date.now();
    for (const [k, v] of toko) if (v.resetAt <= sekarang) toko.delete(k);
  }, 60_000);
  // Jangan tahan proses tetap hidup hanya untuk pembersih ini.
  if (typeof timer === "object" && timer && "unref" in timer) timer.unref();
}
