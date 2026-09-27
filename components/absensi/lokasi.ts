"use client";

/** Helper kecil untuk Geolocation API (PRD §6.4). */

export type Posisi = { latitude: number; longitude: number; accuracy: number };

export type HasilGeolokasi =
  | { ok: true; posisi: Posisi }
  | { ok: false; alasan: string };

export async function ambilLokasi(timeoutMs = 15_000): Promise<HasilGeolokasi> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, alasan: "Perangkat Anda tidak mendukung Geolocation API." };
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, alasan: "Waktu tunggu lokasi habis. Cobalah di area dengan sinyal lebih baik." });
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({
          ok: true,
          posisi: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        });
      },
      (err) => {
        clearTimeout(timer);
        const pesan: Record<number, string> = {
          1: "Akses lokasi ditolak. Aktifkan izin lokasi di pengaturan browser.",
          2: "Lokasi Anda belum dapat diverifikasi. Pastikan GPS aktif.",
          3: "Waktu tunggu lokasi habis. Coba lagi.",
        };
        resolve({ ok: false, alasan: pesan[err.code] ?? "Gagal mendapatkan lokasi Anda." });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
