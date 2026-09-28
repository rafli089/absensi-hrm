import { z } from "zod";

/**
 * Skema Zod untuk foto absensi (data URL JPEG/WebP dari kamera).
 * Hanya prefix MIME yang diizinkan + karakter base64 — payload selain
 * gambar (mis. text/html) langsung ditolak di boundary.
 *
 * ponytail: simpan sebagai BYTEA/file object kalau scale naik —
 * kolom text ~1.3MB/baris sekarang masih aman untuk skala kecil.
 */
export const fotoAbsen = z
  .string()
  .min(1)
  .max(2_000_000)
  .regex(
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/,
    "Format foto tidak valid (harus data URL gambar base64).",
  );
