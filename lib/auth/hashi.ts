import { hashSync, compareSync } from "bcryptjs";

const KOSTA = 10; // bcrypt cost — 10 cukup untuk MVP, naikkan ke 12+ untuk produksi dengan beban >500 user

export function hash(password: string): string {
  return hashSync(password, KOSTA);
}

export function verify(password: string, hashDb: string): boolean {
  if (!hashDb) return false;
  try {
    return compareSync(password, hashDb);
  } catch {
    return false;
  }
}

/** Validasi kekuatan password (PRD §12: keamanan). */
export function kuat(password: string): string[] {
  const err: string[] = [];
  if (password.length < 8) err.push("Minimal 8 karakter.");
  if (!/[a-z]/.test(password)) err.push("Harus ada huruf kecil.");
  if (!/[A-Z]/.test(password)) err.push("Harus ada huruf besar.");
  if (!/\d/.test(password)) err.push("Harus ada angka.");
  return err;
}
