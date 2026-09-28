/**
 * Typed error hierarchy (fullstack-dev §3, anti-pattern #4).
 *
 * Tiap error punya `code` (machine-readable) + `status` (HTTP) +
 * `isOperational` (true = input error, bukan bug). `onRequestError`
 * di `instrumentation.ts` meng-log semua error yang tidak tertangani.
 *
 * Gunakan di route handler:
 *   throw new NotFoundError("Karyawan", id);
 *   throw new ValidationError([{ field: "email", message: "..." }]);
 *
 * ponytail: `app.ts` Next.js sudah handle `AppError` instance secara
 * default. Kita tetap perlu `throw` di route supaya `onRequestError`
 * membawa requestId dari Next ke structured log.
 */

import { log } from "./log";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly isOperational: boolean = true,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Input tidak valid — 422. */
export class ValidationError extends AppError {
  constructor(public readonly fields: Array<{ field: string; message: string }>) {
    super("Validasi gagal", "VALIDATION_ERROR", 422);
    this.name = "ValidationError";
  }
}

/** Tidak ditemukan — 404. */
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} tidak ditemukan: ${id}`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

/** Sudah ada — 409. */
export class ConflictError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} sudah ada: ${id}`, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}

/** Tidak terautentikasi — 401. */
export class UnauthorizedError extends AppError {
  constructor(message = "Tidak terautentikasi.") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

/** Akses ditolak — 403. */
export class ForbiddenError extends AppError {
  constructor(message = "Akses ditolak.") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

/** Terlalu banyak request — 429. */
export class RateLimitError extends AppError {
  constructor(retryAfterSeconds = 60) {
    super(
      `Terlalu banyak percobaan. Coba lagi dalam ${retryAfterSeconds} detik.`,
      "RATE_LIMITED",
      429,
    );
    this.name = "RateLimitError";
  }
}

/**
 * Normalisasi error ke Response json. Supaya semua route konsisten
 * dan tidak ada yang langsung `Response.json({error})` manual.
 *
 * `AppError` (operational) pesannya aman ditampilkan — itu pesan yang
 * memang ditulis untuk dibaca user.
 *
 * Apapun selain itu adalah programming error atau kegagalan internal.
 * Pesannya TIDAK boleh keluar: `PrismaClientKnownRequestError` memuat
 * nama tabel/kolom dan potongan query, yang cukup untuk memetakan skema
 * database. Log penuhnya di `onRequestError`, kirim teks generik saja.
 */
export function toResponse(err: unknown): Response {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = { error: err.message, kode: err.code };
    if (err instanceof ValidationError) body.fields = err.fields;
    return new Response(JSON.stringify(body), { status: err.status });
  }

  // Programming error: log stack lengkap, balas generik.
  log.error("error_tidak_tertangani", {
    pesan: err instanceof Error ? err.message : String(err),
    ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
  });

  return new Response(
    JSON.stringify({ error: "Terjadi kesalahan pada server. Coba lagi.", kode: "INTERNAL_ERROR" }),
    { status: 500 },
  );
}
