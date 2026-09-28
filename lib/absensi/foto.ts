import { z } from "zod";

/**
 * Skema Zod untuk foto absensi (data URL JPEG/WebP dari kamera).
 * Hanya prefix MIME yang diizinkan + karakter base64 — payload selain
 * gambar (mis. text/html) langsung ditolak di boundary.
 *
 * Data URL masuk dari browser, disimpan terpisah lewat `fotoStorage`.
 * Kolom DB cuma berisi path relatif.
 */
export const fotoAbsen = z
  .string()
  .min(1)
  .max(2_000_000)
  .regex(
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/,
    "Format foto tidak valid (harus data URL gambar base64).",
  );

/**
 * Kolom `photo` berisi dua kemungkinan format:
 * - data URL base64  → baris lama sebelum `fotoStorage` dipakai
 * - path relatif     → hasil `saveFoto`, mis. "2026/09/28/uuid.jpg"
 *
 * Satu fungsi untuk dua-duanya supaya data lama tidak perlu migrasi.
 * Migrasi baris lama baru perlu kalau base64 ini mulai memberatkan
 * backup atau replica.
 */
export function urlFoto(photo: string | null | undefined): string | null {
  if (!photo) return null;
  return photo.startsWith("data:") ? photo : `/uploads/${photo}`;
}
