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

async function post(cookie, data) {
  return fetch(BASE + "/api/employee", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(data),
  });
}

const admin = await login("super@kantor.id");
const budi = await login("budi@kantor.id");

const stamp = Date.now().toString().slice(-8);
const valid = {
  employeeCode: "TST-" + stamp,
  fullName: "Uji Coba " + stamp,
  email: "uji" + stamp + "@kantor.id",
  joinDate: "2026-01-15",
};

console.log("\n-- karyawan biasa tidak boleh membuat --");
let r = await post(budi, valid);
cek("POST ditolak tanpa izin", r.status === 403, "status=" + r.status);

console.log("\n-- validasi --");
r = await post(admin, { ...valid, fullName: "" });
cek("nama kosong ditolak", r.status === 400);

r = await post(admin, { ...valid, joinDate: "" });
cek("tanggal masuk kosong ditolak", r.status === 400);

r = await post(admin, { ...valid, nik: "12345" });
cek("NIK bukan 16 digit ditolak", r.status === 400, "status=" + r.status);

r = await post(admin, { ...valid, email: "bukan-email" });
cek("email tidak valid ditolak", r.status === 400);

r = await post(admin, { ...valid, departmentId: "tidak-ada" });
cek("departemen asing ditolak", r.status === 400);

r = await post(admin, { ...valid, joinDate: "bukan-tanggal" });
cek("tanggal rusak ditolak", r.status === 400);

console.log("\n-- buat --");
r = await post(admin, valid);
const dibuat = await r.json();
cek("karyawan dibuat", r.status === 201 && dibuat.karyawan?.id, JSON.stringify(dibuat).slice(0, 120));
cek("kode tersimpan", dibuat.karyawan?.employeeCode === valid.employeeCode);
cek("tanggal masuk tersimpan", dibuat.karyawan?.joinDate?.startsWith("2026-01-15"), dibuat.karyawan?.joinDate);

console.log("\n-- duplikat --");
r = await post(admin, valid);
cek("kode ganda ditolak 409", r.status === 409, "status=" + r.status);

r = await post(admin, { ...valid, employeeCode: "XP-" + stamp, email: valid.email });
cek("email ganda ditolak 409", r.status === 409, "status=" + r.status);

r = await post(admin, { ...valid, employeeCode: "NP-" + stamp, email: "np" + stamp + "@kantor.id", nik: "3201234567890001" });
cek("NIK pertama boleh", r.status === 201);
r = await post(admin, { ...valid, employeeCode: "NQ-" + stamp, email: "nq" + stamp + "@kantor.id", nik: "3201234567890001" });
cek("NIK ganda ditolak 409", r.status === 409, "status=" + r.status);

console.log("\n-- field kosong jadi null, bukan string kosong --");
r = await post(admin, { ...valid, employeeCode: "KS-" + stamp, email: "", nik: "", phone: "", bankName: "" });
const kosong = await r.json();
cek("string kosong disimpan null", kosong.karyawan?.email === null && kosong.karyawan?.nik === null, JSON.stringify(kosong.karyawan?.email) + "/" + JSON.stringify(kosong.karyawan?.nik));

// bersihkan
const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
const nums = [stamp, "20" + stamp, "30" + stamp, "40" + stamp, "50" + stamp, "60" + stamp, "70" + stamp];
await p.employee.deleteMany({ where: { employeeCode: { in: nums.map((n) => "TST-" + n).concat(nums.map((n) => "XP-" + n), nums.map((n) => "NP-" + n), nums.map((n) => "NQ-" + n), nums.map((n) => "KS-" + n)) } } });
await p.$disconnect();
console.log("\n  (data uji dibersihkan)");

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`);
process.exit(gagal ? 1 : 0);
