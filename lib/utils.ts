import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export const formatRupiah = (n: number | string) => rupiah.format(Number(n));

export const formatTanggal = (d: Date | string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

export const formatTanggalPanjang = (d: Date | string) =>
  new Date(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const formatJam = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—";

export function formatMenit(m: number): string {
  if (m <= 0) return "0m";
  const j = Math.floor(m / 60);
  const s = m % 60;
  return s ? `${j}j ${s}m` : `${j}j`;
}

export const inisial = (nama: string) =>
  nama
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** "09:00" -> "09.00" */
export const jamSingkat = (t: string) => t.replace(":", ".");

/**
 * Ambil tanggal hari ini (kalender kantor, WIB) sebagai UTC-midnight,
 * untuk kolom `@db.Date`.
 *
 * `new Date(y,m,d,0,0,0)` memakai waktu lokal, tapi diwakili sebagai UTC
 * — jadi di UTC+7 toISOString() mundur sehari, dan `@db.Date` menyimpan
 * tanggal *sebelum*. Ini bug nyata antara 00:00–07:00 WIB: check-in jam
 * 01 pagi tercatat sebagai hari sebelumnya.
 *
 * Perbaikan: ambil bagian *tanggal* lokal, lalu jadikan midnight UTC:
 *   new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
 * Ini menghasilkan 2026-09-27T00:00Z untuk 27 Sep WIB → disimpan 2026-09-27.
 *
 * ponytail: satu timezone (lokal server = timezone kantor). Kalau server
 * jalan di UTC sementara kantor WIB, pendekatan di atas tetap benar
 * karena ia tidak pernah memanggil setHours waktu-lokal.
 * Multi-region sebenarnya membutuhkan `SET timezone` per-kantor atau
 * menyimpan IANA timezone di Office dan mengonversi sebelum banding.
 */
export function todayDate(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
