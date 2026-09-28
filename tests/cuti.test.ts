import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  hitungHariKerja, rentangTanggal, validasiPengajuan, sisaKuota,
  KUOTA_ANNUAL_PER_TAHUN, MAKS_HARI_KE_DEPAN, tanggalDb,
} from "../lib/cuti/engine.ts";

/** 2026-09-28 = Senin. 2026-10-03 = Sabtu, 10-04 = Minggu. */
const SENIN = new Date(2026, 8, 28);
const SABTU = new Date(2026, 9, 3);
const MINGGU = new Date(2026, 9, 4);

const kosong = new Set<number>();

describe("rentangTanggal", () => {
  test("inklusif kedua ujung", () => {
    assert.equal(rentangTanggal(SENIN, new Date(2026, 8, 30)).length, 3);
    assert.equal(rentangTanggal(SENIN, SENIN).length, 1);
  });
});

describe("hitungHariKerja", () => {
  test("skip Sabtu dan Minggu", () => {
    // Sen 28, Sel 29, Rab 30, Kam 1, Jum 2, Sab 3, Min 4 = 5 hari kerja
    assert.equal(hitungHariKerja(SENIN, MINGGU), 5);
  });

  test("rentang akhir pekan saja = 0", () => {
    assert.equal(hitungHariKerja(SABTU, MINGGU), 0);
  });
});

describe("validasiPengajuan", () => {
  const dasar = { type: "ANNUAL" as const, hariIni: SENIN, tanggalSudahDimiliki: kosong, terpakai: 0 };

  test("rentang valid lolos", () => {
    const r = validasiPengajuan({ ...dasar, dari: SENIN, sampai: new Date(2026, 8, 30) });
    assert.equal(r.ok, true);
  });

  test("sampai sebelum dari ditolak", () => {
    const r = validasiPengajuan({ ...dasar, dari: new Date(2026, 8, 30), sampai: SENIN });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "RENTANG_INVALID");
  });

  test("tanggal lampau ditolak", () => {
    const r = validasiPengajuan({ ...dasar, dari: new Date(2026, 8, 27), sampai: new Date(2026, 8, 28) });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "MASA_LALU");
  });

  test("lebih dari batas ke depan ditolak", () => {
    const jauh = new Date(SENIN.getTime() + (MAKS_HARI_KE_DEPAN + 1) * 86_400_000);
    const r = validasiPengajuan({ ...dasar, dari: jauh, sampai: jauh });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "TERLALU_JAUH");
  });

  test("tanggal sudah ada pengajuan ditolak", () => {
    const bentrok = new Set([new Date(2026, 8, 29).setHours(0, 0, 0, 0)]);
    const r = validasiPengajuan({ ...dasar, dari: SENIN, sampai: new Date(2026, 8, 30), tanggalSudahDimiliki: bentrok });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "TANGGAL_BENTROK");
  });

  test("hanya akhir pekan ditolak", () => {
    const r = validasiPengajuan({ ...dasar, dari: SABTU, sampai: MINGGU });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "HARI_KERJA_KOSONG");
  });

  test("kuota annual habis ditolak", () => {
    const r = validasiPengajuan({ ...dasar, dari: SENIN, sampai: new Date(2026, 8, 30), terpakai: 10 });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "KUOTA_HABIS");
  });

  test("cuti sakit tanpa kuota tetap lolos walau terpakai banyak", () => {
    const r = validasiPengajuan({ ...dasar, type: "SICK", dari: SENIN, sampai: new Date(2026, 8, 30), terpakai: 99 });
    assert.equal(r.ok, true);
  });
});

describe("sisaKuota", () => {
  test("tidak pernah negatif", () => {
    assert.equal(sisaKuota(KUOTA_ANNUAL_PER_TAHUN), 0);
    assert.equal(sisaKuota(99), 0);
  });
  test("sisa = kuota - terpakai", () => {
    assert.equal(sisaKuota(5), 7);
  });
});

describe("tanggalDb", () => {
  test("memotong jam", () => {
    const d = new Date(2026, 8, 28, 15, 30, 45);
    assert.equal(tanggalDb(d).getHours(), 0);
    assert.equal(tanggalDb(d).getDate(), 28);
  });
});
