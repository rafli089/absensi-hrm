/**
 * E2E: set kantor → check-in → cek-out.
 * Foto memakai JPEG 1x1 supaya deterministik dan ringan.
 * Jalankan: node tests/e2e-absen.mjs
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = "budi@kantor.id";
const PW = "password123";

const FOTO =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

let ok = 0;
let fail = 0;

function cek(nama, lulus, detail = "") {
  if (lulus) { ok++; console.log(`  OK   ${nama}`); }
  else { fail++; console.log(`  GAGAL ${nama} ${detail}`); }
}

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: `email=${encodeURIComponent(EMAIL)}&password=${PW}`,
  redirect: "manual",
});
const cookie = login.headers.getSetCookie()?.[0]?.split(";")[0] ?? "";
const H = { Cookie: cookie, "Content-Type": "application/json" };

const loginAdmin = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: "email=super%40kantor.id&password=" + PW,
  redirect: "manual",
});
const cookieAdmin = loginAdmin.headers.getSetCookie()?.[0]?.split(";")[0] ?? "";
const HA = { Cookie: cookieAdmin, "Content-Type": "application/json" };

console.log(`\nlogin ${EMAIL}: ${login.status}`);
cek("login karyawan", login.status === 200 && cookie !== "");
cek("login admin", loginAdmin.status === 200 && cookieAdmin !== "");

console.log("\n-- set kantor (radius 200m) --");
const KANTOR = { name: "Kantor Test", address: "Test", latitude: -6.175392, longitude: 106.827153, radius: 200 };
const setKantor = await fetch(`${BASE}/api/settings/kantor`, { method: "PUT", headers: HA, body: JSON.stringify(KANTOR) });
cek("simpan lokasi kantor", setKantor.ok, `(status ${setKantor.status})`);

const KANTOR_ARGS = (takenAt) => ({
  photo: FOTO,
  latitude: KANTOR.latitude,
  longitude: KANTOR.longitude,
  accuracy: 15,
  deviceId: "e2e-test",
  takenAt,
});

// Reset data hari ini dulu (API pakai todayDate() server)
const hariIni = new Date();
hariIni.setHours(0, 0, 0, 0);

// takenAt = waktu sekarang: hanya untuk cegah replay, jam absensi dari server
const now = new Date().toISOString();

const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
await p.attendance.deleteMany({ where: { date: { gte: hariIni } } });
await p.attendanceEvent.deleteMany({ where: { timestamp: { gte: hariIni } } });
await p.$disconnect();
console.log(`\nreset data tanggal ${hariIni.toISOString().slice(0, 10)}`);

console.log("\n-- check-in --");
const ci = await fetch(`${BASE}/api/attendance/check-in`, { method: "POST", headers: H, body: JSON.stringify(KANTOR_ARGS(now)) });
const ciBody = await ci.json();
cek("check-in diterima", ci.ok, `-> ${JSON.stringify(ciBody).slice(0, 160)}`);
if (ci.ok) console.log(`       status=${ciBody.attendance.status} late=${ciBody.attendance.lateMinutes} jarak=${ciBody.attendance.jarak}m`);

console.log("\n-- check-in kedua (harus ditolak §25.1) --");
const ci2 = await fetch(`${BASE}/api/attendance/check-in`, { method: "POST", headers: H, body: JSON.stringify(KANTOR_ARGS(now)) });
cek("check-in kedua ditolak", ci2.status === 409, `(status ${ci2.status})`);

console.log("\n-- foto basi ditolak (>5 menit) --");
const ci3 = await fetch(`${BASE}/api/attendance/check-out`, {
  method: "POST",
  headers: H,
  body: JSON.stringify(KANTOR_ARGS(new Date(Date.now() - 6 * 60 * 1000).toISOString())),
});
cek("foto kedaluwarsa ditolak", ci3.status === 400, `(status ${ci3.status})`);

console.log("\n-- GPS di luar radius ditolak --");
const co = await fetch(`${BASE}/api/attendance/check-out`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ ...KANTOR_ARGS(now), latitude: -6.9, longitude: 106.8 }),
});
cek("GPS luar radius ditolak", co.status === 422, `(status ${co.status})`);

console.log("\n-- GPS akurasi kasar ditolak --");
const co2 = await fetch(`${BASE}/api/attendance/check-out`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ ...KANTOR_ARGS(now), accuracy: 500 }),
});
cek("GPS akurasi kasar ditolak", co2.status === 422, `(status ${co2.status})`);

console.log("\n-- foto kosong ditolak --");
const co3 = await fetch(`${BASE}/api/attendance/check-out`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ ...KANTOR_ARGS(now), photo: "" }),
});
cek("foto kosong ditolak", co3.status === 400, `(status ${co3.status})`);

console.log("\n-- check-out berhasil --");
const co4 = await fetch(`${BASE}/api/attendance/check-out`, { method: "POST", headers: H, body: JSON.stringify(KANTOR_ARGS(now)) });
const co4Body = await co4.json();
cek("check-out diterima", co4.ok, `-> ${JSON.stringify(co4Body).slice(0, 160)}`);

console.log(`\n=== ${ok} lulus, ${fail} gagal ===\n`);
process.exit(fail > 0 ? 1 : 0);