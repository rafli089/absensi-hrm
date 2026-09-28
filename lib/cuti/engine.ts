import type { LeaveType } from "@prisma/client";

/**
 * Engine cuti (PRD §6.12) — fungsi murni tanpa I/O, sama seperti
 * `lib/absensi/engine.ts`.
 *
 * Asumsi yang saya ambil sendiri karena PRD tidak menyebut angkanya.
 * Semua angka di sini adalah satu-satunya tempat yang perlu diubah
 * kalau kebijakan kantor berbeda.
 */

/** Kuota cuti tahunan. Annual saja yang memakainya. */
export const KUOTA_ANNUAL_PER_TAHUN = 12;

/**
 * Berapa hari sebelum pengajuan yang masih boleh diajukan.
 * Mencegah karyawan cuma_fill cuti mendadak lalu minta backdate.
 */
export const MAKS_HARI_KE_DEPAN = 60;

/** Kuota per jenis cuti per tahun. `null` = tidak dibatasi kuota. */
export const KUOTA_PER_TAHUN: Record<LeaveType, number | null> = {
  ANNUAL: KUOTA_ANNUAL_PER_TAHUN,
  SICK: null,
  PERSONAL: null,
  UNPAID: null,
};

export const LABEL_JENIS_CUTI: Record<LeaveType, string> = {
  ANNUAL: "Cuti Tahunan",
  SICK: "Cuti Sakit",
  PERSONAL: "Cuti Pribadi",
  UNPAID: "Cuti Tanpa Gaji",
};

export type HasilValidasi =
  | { ok: true }
  | { ok: false; field?: string; code: string; message: string };

const hariDalam = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Tanggal "YYYY-MM-DD" lokal, cocok dengan kolom `@db.Date`. */
export function tanggalDb(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Deret tanggal inklusif, dipakai untuk generate baris per hari. */
export function rentangTanggal(dari: Date, sampai: Date): Date[] {
  const hasil: Date[] = [];
  for (let t = hariDalam(dari); t <= hariDalam(sampai); t += 86_400_000) {
    hasil.push(new Date(t));
  }
  return hasil;
}

/** Jumlah hari kerja dalam rentang, skip Sabtu/Minggu. */
export function hitungHariKerja(dari: Date, sampai: Date): number {
  return rentangTanggal(dari, sampai).filter((d) => {
    const h = d.getDay();
    return h !== 0 && h !== 6;
  }).length;
}

/**
 * Validasi satu pengajuan SEBELUM menyentuh DB. Semua aturan dipindah ke
 * sini supaya bisa diuji tanpa database.
 *
 * `terpakai` = hari annual yang sudah terpakai tahun ini, di luar
 * pengajuan yang sedang divalidasi.
 */
export function validasiPengajuan(input: {
  type: LeaveType;
  dari: Date;
  sampai: Date;
  hariIni: Date;
  tanggalSudahDimiliki: ReadonlySet<number>;
  terpakai: number;
}): HasilValidasi {
  const { type, dari, sampai, hariIni, tanggalSudahDimiliki, terpakai } = input;

  if (hariDalam(sampai) < hariDalam(dari)) {
    return { ok: false, field: "sampai", code: "RENTANG_INVALID", message: "Tanggal selesai harus sama dengan atau setelah tanggal mulai." };
  }

  if (hariDalam(dari) < hariDalam(hariIni)) {
    return { ok: false, field: "dari", code: "MASA_LALU", message: "Tidak bisa mengajukan cuti untuk tanggal yang sudah lewat." };
  }

  if (hariDalam(dari) > hariDalam(hariIni) + MAKS_HARI_KE_DEPAN * 86_400_000) {
    return { ok: false, field: "dari", code: "TERLALU_JAUH", message: `Pengajuan maksimal ${MAKS_HARI_KE_DEPAN} hari ke depan.` };
  }

  const bentrok = rentangTanggal(dari, sampai).find((d) => tanggalSudahDimiliki.has(hariDalam(d)));
  if (bentrok) {
    return {
      ok: false,
      field: "dari",
      code: "TANGGAL_BENTROK",
      message: `Sudah ada pengajuan atau data absensi pada ${bentrok.toLocaleDateString("id-ID")}.`,
    };
  }

  const hariKerja = hitungHariKerja(dari, sampai);
  if (hariKerja === 0) {
    return { ok: false, field: "dari", code: "HARI_KERJA_KOSONG", message: "Rentang yang dipilih hanya berisi Sabtu atau Minggu." };
  }

  const kuota = KUOTA_PER_TAHUN[type];
  if (kuota !== null && terpakai + hariKerja > kuota) {
    return {
      ok: false,
      field: "sampai",
      code: "KUOTA_HABIS",
      message: `Kuota ${LABEL_JENIS_CUTI[type].toLowerCase()} tahun ini tersisa ${Math.max(0, kuota - terpakai)} hari.`,
    };
  }

  return { ok: true };
}

/** Sisa kuota annual setelah pengajuan tertentu. */
export function sisaKuota(terpakai: number): number {
  return Math.max(0, KUOTA_ANNUAL_PER_TAHUN - terpakai);
}
