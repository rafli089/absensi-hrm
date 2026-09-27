import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { hitungAbsensi, toMinutes, atTime, validasiCheckOut } from "../lib/absensi/engine";
import { todayDate } from "../lib/utils";

/** Shift 09:00-18:00, break 12:00-13:00, grace 10 menit — persis contoh PRD §6.7. */
const SHIFT = {
  startTime: "09:00",
  endTime: "18:00",
  breakStart: "12:00",
  breakEnd: "13:00",
  gracePeriod: 10,
  isOvernight: false,
};

const pada = (jam: string) => {
  const d = new Date();
  d.setHours(Number(jam.slice(0, 2)), Number(jam.slice(3, 5)), 0, 0);
  return d;
};

const dasar = {
  shift: SHIFT,
  checkOut: null,
  gpsVerified: true,
};

describe("helper waktu", () => {
  test("toMinutes", () => {
    assert.equal(toMinutes("09:00"), 540);
    assert.equal(toMinutes("18:30"), 1110);
  });

  test("atTime memakai tanggal yang diberikan", () => {
    const base = new Date("2024-06-03T23:00:00");
    const d = atTime(base, "09:00");
    assert.equal(d.getHours(), 9);
    assert.equal(d.getMinutes(), 0);
    assert.equal(d.getDate(), 3); // tanggal tetap sama, hanya jam yang diubah
  });
});

describe("PRD §6.7 — grace period", () => {
  test("check-in tepat 09:00 = PRESENT (dengan check-out)", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("09:00"), checkOut: pada("18:00") });
    assert.equal(r.status, "PRESENT");
    assert.equal(r.lateMinutes, 0);
  });

  test("check-in 09:07 masih PRESENT (dalam grace)", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("09:07"), checkOut: pada("18:00") });
    assert.equal(r.status, "PRESENT");
    assert.equal(r.lateMinutes, 0);
  });

  test("check-in 09:15 = LATE, 5 menit dari batas grace", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("09:15"), checkOut: pada("18:00") });
    assert.equal(r.status, "LATE");
    assert.equal(r.lateMinutes, 5);
  });

  test("check-in tepat di akhir grace 09:10 masih PRESENT", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("09:10"), checkOut: pada("18:00") });
    assert.equal(r.status, "PRESENT");
  });

  test("check-in 09:11 = LATE 1 menit", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("09:11"), checkOut: pada("18:00") });
    assert.equal(r.lateMinutes, 1);
  });
});

describe("PRD §25 — aturan bisnis", () => {
  test("§25.1 tanpa check-out = INCOMPLETE (duplikat dicegah route, bukan engine)", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("08:50") });
    assert.equal(r.status, "INCOMPLETE"); // check-in ada tapi belum check-out
  });

  test("§25.2 check-out tanpa check-in ditolak", () => {
    const e = validasiCheckOut(false);
    assert.ok(e);
    assert.equal(e!.code, "WAJIB_CHECK_IN_DULU");
  });

  test("check-out setelah check-in lolos validasi", () => {
    assert.equal(validasiCheckOut(true), null);
  });

  test("§25.3 GPS di luar radius = REJECTED", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("09:00"), gpsVerified: false });
    assert.equal(r.status, "REJECTED");
  });

  test("GPS gagal + check-in sebelum shift tetap REJECTED, bukan PRESENT", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("08:00"), gpsVerified: false });
    assert.equal(r.status, "REJECTED");
  });
});

describe("durasi kerja", () => {
  test("break 12:00-13:00 dipotong dari total kerja", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("09:00"), checkOut: pada("18:00") });
    // 9 jam_interval, break 1 jam = 8 jam = 480 menit
    assert.equal(r.workMinutes, 480);
    assert.equal(r.status, "PRESENT");
  });

  test("pulang sebelum break tidak memotong apa pun", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("09:00"), checkOut: pada("11:00") });
    assert.equal(r.workMinutes, 120);
  });

  test("pulang 17:30 dari shift 18:00 = EARLY_LEAVE 30 menit", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("09:00"), checkOut: pada("17:30") });
    assert.equal(r.status, "EARLY_LEAVE");
    assert.equal(r.earlyLeaveMinutes, 30);
  });

  test("terlambat + pulang awal: status menang ke EARLY_LEAVE", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("09:30"), checkOut: pada("17:00") });
    assert.equal(r.status, "EARLY_LEAVE");
    assert.equal(r.lateMinutes, 20);
    assert.equal(r.earlyLeaveMinutes, 60);
  });

  test("tanpa check-out = INCOMPLETE", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: pada("09:00") });
    assert.equal(r.status, "INCOMPLETE");
    assert.equal(r.workMinutes, 0);
  });

  test("tanpa check-in = INCOMPLETE", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: null });
    assert.equal(r.status, "INCOMPLETE");
  });
});

describe("edge case", () => {
  test("tanpa shift: hadir, tidak ada hitungan telat", () => {
    const r = hitungAbsensi({ ...dasar, shift: null, checkIn: pada("14:00"), checkOut: pada("20:00") });
    assert.equal(r.status, "PRESENT");
    assert.equal(r.lateMinutes, 0);
    assert.equal(r.workMinutes, 360);
  });

  test("shift malam: check-in 22:00, check-out 07:00 keesokan = 9 jam", () => {
    const malam = { startTime: "22:00", endTime: "07:00", breakStart: null, breakEnd: null, gracePeriod: 15, isOvernight: true };
    const inMalam = pada("22:00");
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(7, 0, 0, 0);
    const r = hitungAbsensi({ ...dasar, shift: malam, checkIn: inMalam, checkOut: d });
    assert.equal(r.workMinutes, 540);
    assert.equal(r.status, "PRESENT");
  });

  test("overtime dihitung hanya setelah shift berakhir", () => {
    const r = hitungAbsensi({
      ...dasar,
      checkIn: pada("09:00"),
      checkOut: pada("21:00"),
      overtimeStart: pada("18:00"),
      overtimeEnd: pada("21:00"),
    });
    assert.equal(r.overtimeMinutes, 180);
  });

  test("overtime sebelum shift berakhir diabaikan", () => {
    const r = hitungAbsensi({
      ...dasar,
      checkIn: pada("09:00"),
      checkOut: pada("18:00"),
      overtimeStart: pada("17:00"),
      overtimeEnd: pada("18:00"),
    });
    assert.equal(r.overtimeMinutes, 0);
  });

  test("presetStatus (cuti/sakit dari modul lain) menang atas perhitungan", () => {
    const r = hitungAbsensi({ ...dasar, checkIn: null, presetStatus: "LEAVE" });
    assert.equal(r.status, "LEAVE");
    assert.equal(r.workMinutes, 0);
  });
});

describe("todayDate(): kalender lokal, disimpan sebagai tanggal UTC", () => {
  // `attendance.date` adalah `@db.Date`, jadi Prisma menyimpan bagian tanggal
  // UTC. Kalau nilainya midnight waktu-lokal, di UTC+7 check-in pagi buta
  // (00:00-07:00) tercatat sebagai HARI SEBELUMNYA. Bug nyata: karyawan yang
  // absen jam 1 pagi tidak muncul di laporan hari itu.
  test("tanggal UTC hasil todayDate() = tanggal kalender lokal", () => {
    const d = todayDate();
    const sekarang = new Date();
    assert.equal(d.toISOString().slice(0, 10), `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}-${String(sekarang.getDate()).padStart(2, "0")}`);
  });

  test("hasilnya tepat UTC midnight, supaya tidak ikut geser saat disimpan", () => {
    const d = todayDate();
    assert.equal(d.toISOString(), `${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
  });
});
