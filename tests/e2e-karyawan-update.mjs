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

const admin = await login("super@kantor.id");
const budi = await login("budi@kantor.id");
const stamp = Date.now().toString().slice(-8);

// --- buat karyawan uji via API ---
const payload = { employeeCode: "UP-" + stamp, fullName: "Update " + stamp, joinDate: "2026-01-15", employmentStatus: "PERMANENT" };
let r = await api(admin, "POST", "/api/employee", payload);
let dibuat = await r.json();
cek("buat karyawan uji", r.status === 201 && dibuat.karyawan?.id);
const id = dibuat.karyawan.id;

// --- permission gate ---
r = await api(budi, "PUT", "/api/employee/" + id, payload);
cek("PUT ditolak tanpa izin", r.status === 403, "status=" + r.status);
r = await api(budi, "DELETE", "/api/employee/" + id);
cek("DELETE ditolak tanpa izin", r.status === 403, "status=" + r.status);
r = await api(budi, "GET", "/api/employee/" + id);
cek("GET ditolak tanpa izin", r.status === 403, "status=" + r.status);

// --- 404 ---
const asing = "ck" + "0".repeat(23);
r = await api(admin, "PUT", "/api/employee/" + asing, payload);
cek("PUT id asing 404", r.status === 404, "status=" + r.status);
r = await api(admin, "DELETE", "/api/employee/" + asing);
cek("DELETE id asing 404", r.status === 404, "status=" + r.status);
r = await api(admin, "GET", "/api/employee/" + asing);
cek("GET id asing 404", r.status === 404, "status=" + r.status);

// --- GET detail ---
r = await api(admin, "GET", "/api/employee/" + id);
const detail = await r.json();
cek("GET detail 200", r.status === 200 && detail.karyawan?.fullName === payload.fullName);

// --- PUT update ---
const pilih = {
  ...payload,
  fullName: "Sudah Diubah " + stamp,
  phone: "081111222333",
  email: "up" + stamp + "@kantor.id",
  employmentEndDate: "2026-12-31",
};
r = await api(admin, "PUT", "/api/employee/" + id, pilih);
const diupdate = await r.json();
cek("PUT 200", r.status === 200, "status=" + r.status + " " + JSON.stringify(diupdate).slice(0, 150));
cek("nama berubah", diupdate.karyawan?.fullName === pilih.fullName);
cek("resignDate tersimpan", diupdate.karyawan?.resignDate?.startsWith("2026-12-31"), JSON.stringify(diupdate.karyawan?.resignDate));

// --- PUT bentrok ---
// ambil EMP-001 (seed) untuk bentrokkan kode
const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
const emp001 = await p.employee.findUnique({ where: { employeeCode: "EMP-001" }, select: { id: true } });
r = await api(admin, "PUT", "/api/employee/" + id, { ...pilih, employeeCode: "EMP-001" });
cek("PUT kode bentrok 409", r.status === 409, "status=" + r.status);

// --- DELETE soft delete → aktif → aktif lagi ---
r = await api(admin, "DELETE", "/api/employee/" + id);
const del = await r.json();
cek("DELETE nonaktifkan", r.status === 200 && del.dinonaktifkan === true, JSON.stringify(del));

const nonaktif = await p.employee.findUnique({ where: { id }, select: { isActive: true, resignDate: true } });
cek("isActive=false di DB", nonaktif?.isActive === false);
cek("resignDate terisi saat nonaktif", nonaktif?.resignDate !== null);

r = await api(admin, "DELETE", "/api/employee/" + id);
const re = await r.json();
cek("DELETE kedua mengaktifkan kembali", r.status === 200 && re.dinonaktifkan === false);

const aktif = await p.employee.findUnique({ where: { id }, select: { isActive: true } });
cek("isActive=true kembali", aktif?.isActive === true);

// payroll hanya baca isActive, bukan hapus riwayat
await p.employee.delete({ where: { id } });
await p.$disconnect();
console.log("  (data uji dibersihkan)");

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`);
process.exit(gagal ? 1 : 0);
