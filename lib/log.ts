/**
 * Structured JSON logger (fullstack-dev §7).
 *
 * Semua output satu baris JSON ke stdout supaya bisa di-parse agregator
 * (Docker/loki/cloudwatch) tanpa grep. Kalau butuh enak dibaca saat dev,
 * `pnpm dev` atau `docker logs -f | jq .` sudah cukup.
 *
 * ponytail: belum ada request-id korelasi lintas-service. Next 15 tidak
 * memberi requestId ke `onRequestError`, jadi kalau nanti butuh satu id
 * yang sama muncul di log API dan log worker, tambahkan AsyncLocalStorage
 * di sini dan set header `x-request-id` di `middleware.ts` — jangan pakai
 * userId sebagai pengenal, bisa bocor ke log agregat yang umurnya lebih
 * panjang daripada session.
 */

type Level = "debug" | "info" | "warn" | "error";

const URUTAN: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function levelMinimum(): number {
  const raw = (process.env.LOG_LEVEL ?? "").toLowerCase() as Level;
  return URUTAN[raw] ?? (process.env.NODE_ENV === "production" ? URUTAN.info : URUTAN.debug);
}

/**
 * Kunci yang isinya rahasia/kredensial/PII besar. Nilai diganti `"[redacted]"`
 * supaya log tetap berguna (taui kuncinya ada) tapi tidak jadi breach kalau
 * log bocor ke pihak ketiga.
 */
const RAHASIA = new Set([
  "password",
  "passwordhash",
  "newpassword",
  "sessiontoken",
  "token",
  "secret",
  "authorization",
  "cookie",
  "photo",
  "photourl",
  "foto",
]);

const MAKS_DEPTH = 4;

/** Buang nilai yang tidak bisa di-serialisasi (BigInt, Error, circular). */
function aman(nilai: unknown, depth = 0): unknown {
  if (nilai === null || nilai === undefined) return nilai;
  if (typeof nilai === "bigint") return nilai.toString();
  if (nilai instanceof Error) return { name: nilai.name, message: nilai.message };
  if (depth >= MAKS_DEPTH) return "[depth]";

  if (Array.isArray(nilai)) return nilai.slice(0, 50).map((v) => aman(v, depth + 1));

  if (typeof nilai === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(nilai as Record<string, unknown>)) {
      out[k] = RAHASIA.has(k.toLowerCase()) ? "[redacted]" : aman(v, depth + 1);
    }
    return out;
  }

  return nilai;
}

function tulis(level: Level, pesan: string, fields?: Record<string, unknown>): void {
  if (URUTAN[level] < levelMinimum()) return;

  const baris = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: pesan,
    ...(fields ? (aman(fields) as Record<string, unknown>) : {}),
  });

  // error/warn ke stderr supaya mudah dipisah dari log akses.
  if (level === "error" || level === "warn") raw(true, baris);
  else raw(false, baris);
}

/**
 * Tulis ke stream asli, bukan `console.*`, supaya `docker logs -f | jq .`
 * bisa parse tiap baris tanpa prefix.
 *
 * `instrumentation.ts` ikut di-bundle untuk edge runtime, di mana
 * `process.stdout` tidak ada. Guard `globalThis.process` supaya build
 * tidak gagal; di edge kita jatuh ke console (log tetap terbaca, cuma
 * tidak ter-stdout langsung).
 */
function raw(keStderr: boolean, baris: string): void {
  const p = globalThis.process;
  const stream = keStderr ? p?.stderr : p?.stdout;
  if (stream) stream.write(`${baris}\n`);
  else if (keStderr) console.error(baris);
  else console.log(baris);
}

export const log = {
  debug: (pesan: string, fields?: Record<string, unknown>) => tulis("debug", pesan, fields),
  info: (pesan: string, fields?: Record<string, unknown>) => tulis("info", pesan, fields),
  warn: (pesan: string, fields?: Record<string, unknown>) => tulis("warn", pesan, fields),
  error: (pesan: string, fields?: Record<string, unknown>) => tulis("error", pesan, fields),
};
