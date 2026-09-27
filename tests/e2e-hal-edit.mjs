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

const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
const budi = await p.employee.findUnique({ where: { employeeCode: "EMP-002" }, select: { id: true } });

const admin = await login("super@kantor.id");
const kari = await login("budi@kantor.id");
const andi = await login("andi@kantor.id"); // SUPERVISOR

async function hal(cookie, url) {
  const r = await fetch(BASE + url, { headers: { Cookie: cookie }, redirect: "manual" });
  return { status: r.status, html: await r.text() };
}

console.log("\n-- /karyawan/[id]/edit --");
let x = await hal(admin, "/karyawan/" + budi.id + "/edit");
cek("admin boleh edit 200", x.status === 200 && !x.html.includes("tidak memiliki akses"), "status=" + x.status);
cek("form terisi nama", x.html.includes("Budi Santoso"));
cek("link Edit tidak bocor ke karyawan", !(await hal(kari, "/karyawan")).html.includes("/edit"));

x = await hal(kari, "/karyawan/" + budi.id + "/edit");
cek("karyawan ditolak", x.html.includes("tidak memiliki akses"), "status=" + x.status);

x = await hal(andi, "/karyawan/" + budi.id + "/edit");
cek("supervisor ditolak", x.html.includes("tidak memiliki akses"), "status=" + x.status);

x = await hal(admin, "/karyawan/tidak-ada-xyz/edit");
cek("id asing 404", x.status === 404, "status=" + x.status);

console.log("\n-- daftar karyawan: kolom Aksi hanya untuk yang berhak --");
const daftarAdmin = (await hal(admin, "/karyawan")).html;
const daftarKari = (await hal(kari, "/karyawan")).html;
cek("admin lihat link Edit", daftarAdmin.includes("/karyawan/" + budi.id + "/edit"));
cek("karyawan tidak lihat link Edit", !daftarKari.includes("/karyawan/" + budi.id + "/edit"));
cek("karyawan tidak lihat tombol Tambah", !daftarKari.includes("/karyawan/tambah"));
cek("admin lihat tombol Tambah", daftarAdmin.includes("/karyawan/tambah"));

await p.$disconnect();
console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`);
process.exit(gagal ? 1 : 0);
