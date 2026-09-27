import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { hitungAbsensi, toMinutes, atTime, validasiCheckOut } from "../lib/absensi/engine";
import { todayDate } from "../lib/utils";
import { tanggal, rentangTanggal } from "../lib/laporan/rekap";
import { izinkan, resetKunci } from "../lib/keamanan/rate-limit";

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

describe("tanggal(): search param tidak boleh dipercaya", () => {
  // `dari`/`sampai` datang dari URL. Tanpa validasi, `?dari=abc` jadi
  // Invalid Date dan Prisma melempar 500, bukan 400.
  test("menerima format YYYY-MM-DD yang sah, unchanged", () => {
    assert.equal(tanggal("2026-09-27"), "2026-09-27");
    assert.equal(tanggal("2026-01-01"), "2026-01-01");
    assert.equal(tanggal("2026-12-31"), "2026-12-31");
  });

  test("menolak input kosong, bukan-string, dan format lain", () => {
    assert.equal(tanggal(undefined), undefined);
    assert.equal(tanggal(""), undefined);
    assert.equal(tanggal("abc"), undefined);
    assert.equal(tanggal("27-09-2026"), undefined);
    assert.equal(tanggal("2026/09/27"), undefined);
    assert.equal(tanggal("2026-09-27T00:00:00Z"), undefined); // tidak boleh ada jam
  });

  // `new Date("2026-02-31T00:00:00.000Z")` tidak error, dia geser ke 2 Maret.
  // Kalau lolos, filter "sampai 28 Februari" diam-diam jadi lebih dari yang
  // diminta — lebih buruk daripada ditolak.
  test("menolak tanggal yang tidak ada di kalender (2026-02-31)", () => {
    assert.equal(tanggal("2026-02-31"), undefined);
    assert.equal(tanggal("2026-13-01"), undefined);
    assert.equal(tanggal("2026-00-10"), undefined);
    assert.equal(tanggal("2026-04-31"), undefined);
  });

  test("tahun kabisat: 2024-02-29 sah, 2026-02-29 tidak", () => {
    assert.equal(tanggal("2024-02-29"), "2024-02-29");
    assert.equal(tanggal("2026-02-29"), undefined);
  });

  test("tolak injeksi SQL — hanya digit dan tanda hubung yang lolos", () => {
    assert.equal(tanggal("2026-09-27' OR '1'='1"), undefined);
    assert.equal(tanggal("2026-09-27; DROP TABLE attendance"), undefined);
    assert.equal(tanggal("'; DELETE FROM payrolls WHERE '1'='1"), undefined);
  });

  test("rentangTanggal() membungkus ke UTC midnight untuk kolom @db.Date", () => {
    const r = rentangTanggal("2026-09-01", "2026-09-30");
    assert.equal(r.gte.toISOString(), "2026-09-01T00:00:00.000Z");
    assert.equal(r.lte.toISOString(), "2026-09-30T00:00:00.000Z");
  });
});

describe("izinkan(): sliding window rate-limit login", () => {
  // Rate-limit dipakai di POST /api/auth/login untuk blokir brute-force.
  // Tanpa ini attacker bisa coba password tanpa batas — event
  // REPEATED_ATTEMPTS cuma dicatat, tidak memblokir.
  test("mengizinkan sampai batas, menolak selebihnya dalam window yang sama", () => {
    const kunci = "test-login-" + Math.random();
    for (let i = 0; i < 5; i++) {
      const r = izinkan(kunci, 5, 600_000);
      assert.equal(r.boleh, true, `percobaan ke-${i + 1} harus diizinkan`);
      assert.equal(r.sisa, 5 - i - 1);
    }
    const ditolak = izinkan(kunci, 5, 600_000);
    assert.equal(ditolak.boleh, false);
    assert.equal(ditolak.sisa, 0);
  });

  test("window baru mengizinkan lagi setelah waktu habis", async () => {
    const kunci = "test-reset-" + Math.random();
    assert.equal(izinkan(kunci, 1, 20).boleh, true);
    assert.equal(izinkan(kunci, 1, 20).boleh, false);
    // Tunggu window 20ms lewat (buffer 30ms untuk CI lambat).
    await new Promise((s) => setTimeout(s, 50));
    const r = izinkan(kunci, 1, 20);
    assert.equal(r.boleh, true);
    assert.equal(r.sisa, 0);
  });

  test("kunci berbeda tidak saling mempengaruhi (per IP+email)", () => {
    const a = "test-a-" + Math.random();
    const b = "test-b-" + Math.random();
    izinkan(a, 1, 600_000);
    assert.equal(izinkan(a, 1, 600_000).boleh, false);
    assert.equal(izinkan(b, 1, 600_000).boleh, true, "IP/email lain tidak ikut kena limit");
  });

  // Login memakai pola peek → catat kalau gagal → reset kalau berhasil.
  // Kalau peek ikut menambah, satu login saja sudah memakan jatah, dan lima
  // kali gagal lalu satu kali benar akan menyisakan strike untuk percobaan
  // berikutnya di jendela yang sama.
  test("catat:false hanya memeriksa, tidak menambah penghitung", () => {
    const k = "test-peek-" + Math.random();
    for (let i = 0; i < 10; i++) {
      assert.equal(izinkan(k, 5, 600_000, false).boleh, true, `peek ke-${i + 1} tidak boleh salah`);
    }
    // 10 peek tidak pakai jatah, jadi masih boleh.
    assert.equal(izinkan(k, 5, 600_000, false).boleh, true);
  });

  test("resetKunci() menghapus riwayat kegagalan setelah login berhasil", () => {
    const k = "test-reset-kunci-" + Math.random();
    izinkan(k, 2, 600_000); // gagal 1
    izinkan(k, 2, 600_000); // gagal 2 → sudah penuh
    assert.equal(izinkan(k, 2, 600_000, false).boleh, false, "harus terkunci sebelum reset");
    resetKunci(k);
    assert.equal(izinkan(k, 2, 600_000, false).boleh, true, "setelah login berhasil harus bisa lagi");
  });
});
