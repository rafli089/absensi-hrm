const BASE = "http://localhost:3000";
let lulus = 0, gagal = 0;
function cek(nama, kond, info = "") {
  if (kond) { lulus++; console.log("  OK   " + nama); }
  else { gagal++; console.log("  GAGAL " + nama + (info ? " — " + info : "")); }
}

async function login(email) {
  const r = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "email=" + encodeURIComponent(email) + "&password=password123",
    redirect: "manual",
  });
  return r.headers.getSetCookie()?.[0]?.split(";")[0] ?? "";
}

async function api(cookie, method, url, data) {
  return fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
const admin = await login("super@kantor.id");
const kari = await login("budi@kantor.id");

const kariDb = await p.employee.findUnique({ where: { employeeCode: "EMP-002" }, select: { id: true } });
const shift = await p.shift.findFirst({ where: { name: "Shift Pagi" }, select: { id: true, name: true } });
const shiftMalam = await p.shift.findFirst({ where: { name: "Shift Malam" }, select: { id: true, name: true } });

const tgl = "2026-12-25"; // tanggal jauh, tidak bentrok dengan data lain

console.log("\n-- permission gate --");
let r = await api(kari, "POST", "/api/employee-shift", { employeeId: kariDb.id, shiftId: shift.id, date: tgl });
cek("karyawan tidak boleh assign", r.status === 403, "status=" + r.status);
r = await api(kari, "GET", "/api/employee-shift?date=" + tgl);
cek("karyawan tidak boleh baca assign", r.status === 403, "status=" + r.status);

console.log("\n-- validasi --");
r = await api(admin, "GET", "/api/employee-shift");
cek("GET tanpa ?date ditolak", r.status === 400, "status=" + r.status);
r = await api(admin, "POST", "/api/employee-shift", { employeeId: kariDb.id, shiftId: shift.id, date: "bukan-tanggal" });
cek("tanggal rusak ditolak", r.status === 400, "status=" + r.status);
r = await api(admin, "POST", "/api/employee-shift", { employeeId: "tidak-ada", shiftId: shift.id, date: tgl });
cek("employee asing ditolak", r.status === 400, "status=" + r.status);
r = await api(admin, "POST", "/api/employee-shift", { employeeId: kariDb.id, shiftId: "tidak-ada", date: tgl });
cek("shift asing ditolak", r.status === 400, "status=" + r.status);

console.log("\n-- assign --");
r = await api(admin, "POST", "/api/employee-shift", { employeeId: kariDb.id, shiftId: shift.id, date: tgl });
let dibuat = await r.json();
cek("assign dibuat", r.status === 201 && dibuat.assign?.id, JSON.stringify(dibuat).slice(0, 150));

r = await api(admin, "POST", "/api/employee-shift", { employeeId: kariDb.id, shiftId: shiftMalam.id, date: tgl });
cek("re-assign overwrite (upsert)", r.status === 201, "status=" + r.status);
const baris = await p.employeeShift.findMany({ where: { employeeId: kariDb.id, date: new Date(tgl + "T00:00:00.000Z") } });
cek("tidak duplikat di DB", baris.length === 1, "jumlah=" + baris.length);
cek("shift ter-update ke Malam", baris[0]?.shiftId === shiftMalam.id);
// Upsert yang UPDATE mempertahankan id baris, tidak membuat yang baru.
cek("id baris tetap sama", baris[0]?.id === dibuat.assign.id, `${dibuat.assign.id} vs ${baris[0]?.id}`);

console.log("\n-- list per tanggal --");
r = await api(admin, "GET", "/api/employee-shift?date=" + tgl);
const list = await r.json();
cek("list 200", r.status === 200);
cek("1 hasil", list.assign?.length === 1, "jumlah=" + list.assign?.length);
cek("bukan hari ini -> kosong", (await (await api(admin, "GET", "/api/employee-shift?date=2020-01-01")).json()).assign.length === 0);

console.log("\n-- delete --");
r = await api(admin, "DELETE", "/api/employee-shift?id=" + dibuat.assign.id);
cek("hapus assign", r.status === 200);
cek("habis", (await p.employeeShift.findMany({ where: { employeeId: kariDb.id, date: new Date(tgl + "T00:00:00.000Z") } })).length === 0);

r = await api(admin, "DELETE", "/api/employee-shift?id=tidak-ada");
cek("hapus id asing 404", r.status === 404, "status=" + r.status);

r = await api(admin, "DELETE", "/api/employee-shift");
cek("hapus tanpa id 400", r.status === 400);

await p.$disconnect();
console.log("\n=== " + lulus + " lulus, " + gagal + " gagal ===");
process.exit(gagal ? 1 : 0);
