/**
 * Object storage abstraction (fullstack-dev §10).
 *
 * MVP: local filesystem (public/uploads). Produksi nanti ganti implementasi
 * `saveFoto`/`deleteFoto` ke S3/R2 — interface sama.
 *
 * Keuntungan:
 * - 0 dependency tambahan
 * - DB hanya simpan path relatif (~50 bytes vs 1.3MB base64)
 * - Migrasi nanti: ganti `local.ts` → `s3.ts`, import di `index.ts` sama
 *
 * Struktur file: `public/uploads/YYYY/MM/DD/{uuid}.{ext}`
 * Akses via `/uploads/...` (Next.js static file serving).
 */

import { randomUUID } from "node:crypto";
import { writeFile, mkdir, unlink, access } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(process.cwd(), "public", "uploads");

function ekstensi(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

function pathHari(ext: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const nama = `${randomUUID()}.${ext}`;
  return join(String(yyyy), String(mm), String(dd), nama);
}

/**
 * Simpan base64 data URL ke file. Return relative path dari `public/`.
 *
 * @throws {Error} kalau MIME tidak didukung / base64 rusak / disk penuh
 */
export async function saveFoto(dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if (!match) throw new Error("MIME tidak didukung: hanya JPEG/PNG/WebP");

  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, "base64");
  if (buffer.length === 0) throw new Error("File kosong");
  if (buffer.length > 2_000_000) throw new Error("File > 2MB");

  const rel = pathHari(ekstensi(mime));
  const abs = join(ROOT, rel);
  await mkdir(join(abs, ".."), { recursive: true });
  await writeFile(abs, buffer);
  return rel; // contoh: "2026/09/28/abc123.jpg"
}

/**
 * Hapus file foto. No-op kalau file tidak ada (idempotent).
 */
export async function deleteFoto(relPath: string): Promise<void> {
  if (!relPath) return;
  const abs = join(ROOT, relPath);
  try {
    await access(abs);
    await unlink(abs);
  } catch {
    // file sudah tidak ada — ok
  }
}

/**
 * Validasi file ada & readable (dipakai health check / audit).
 */
export async function existsFoto(relPath: string): Promise<boolean> {
  if (!relPath) return false;
  try {
    await access(join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}