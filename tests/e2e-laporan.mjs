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

const admin = await login("super@kantor.id");
const sari = await login("sari@kantor.id"); // EMPLOYEE
const andi = await login("andi@kantor.id"); // SUPERVISOR

console.log("\n-- /laporan gate --");
let r = await fetch(BASE + "/laporan", { headers: { Cookie: sari }, redirect: "manual" });
let h = await r.text();
cek("karyawan ditolak", h.includes("tidak memiliki akses"), "status=" + r.status);

r = await fetch(BASE + "/laporan", { headers: { Cookie: andi }, redirect: "manual" });
h = await r.text();
cek("supervisor dapat (TEAM_REPORT)", r.status === 200 && h.includes("Laporan"), "status=" + r.status);

r = await fetch(BASE + "/laporan", { headers: { Cookie: admin }, redirect: "manual" });
h = await r.text();
cek("admin 200", r.status === 200, "status=" + r.status);
cek("form filter ada", h.includes('name="dari"') && h.includes('name="sampai"'));

console.log("\n-- CSV export --");
r = await fetch(BASE + "/api/reports/attendance?dari=2026-09-01&sampai=2026-09-30&format=csv", { headers: { Cookie: admin } });
cek("CSV 200", r.status === 200);
cek("Content-Type CSV", r.headers.get("Content-Type")?.includes("text/csv"));
// BOM harus dicek dari byte mentah: Response.text() memakai UTF-8 decode
// yang membuang BOM, jadi charCodeAt(0) selalu bukan 0xFEFF.
const buf = new Uint8Array(await r.arrayBuffer());
cek("BOM UTF-8 (EF BB BF)", buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, [...buf.slice(0, 3)].map((b) => b.toString(16)).join(" "));

r = await fetch(BASE + "/api/reports/attendance?dari=2026-09-01&sampai=2026-09-30", { headers: { Cookie: admin } });
cek("tanpa format=csv -> 400", r.status === 400);

r = await fetch(BASE + "/api/reports/attendance?dari=2026-09-01&sampai=2026-09-30&format=csv", { headers: { Cookie: sari } });
cek("karyawan CSV ditolak", r.status === 403);

// Supervisor punya TEAM_REPORT (bukan REPORT_GENERATE): boleh ekspor CSV,
// tapi data-nya dikunci ke departemennya sendiri.
r = await fetch(BASE + "/api/reports/attendance?dari=2026-09-01&sampai=2026-09-30&format=csv", { headers: { Cookie: andi } });
cek("supervisor CSV 200 (TEAM_REPORT)", r.status === 200, "status=" + r.status);

console.log("\n-- data CSV --");
const csv = await fetch(BASE + "/api/reports/attendance?dari=2026-09-01&sampai=2026-09-30&format=csv", { headers: { Cookie: admin } });
const teks = await csv.text();
const baris = teks.split("\n");
cek("ada header ringkasan", baris.some((l) => l.includes("Total catatan")));
cek("ada header tabel", baris.some((l) => l.includes("Kode,Nama,Departemen")));
cek("ada baris data", baris.length > 10);
cek("kolom alasan ditolak", baris.some((l) => l.includes("Alasan Ditolak")));

// Filter per departemen + scoping supervisor
console.log("\n-- scope & filter --");
const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
const semuaDept = await p.department.findMany({ select: { id: true, name: true } });
const andiUser = await p.user.findUnique({
  where: { email: "andi@kantor.id" },
  select: { employee: { select: { departmentId: true } } },
});
const andiDept = andiUser.employee.departmentId;
// Nama karyawan per departemen, buat cek CSV supervisor tidak bocor data tim lain.
const namaPerDept = await p.employee.findMany({ select: { fullName: true, departmentId: true } });
await p.$disconnect();

const Q = "/api/reports/attendance?dari=2026-09-01&sampai=2026-09-30&format=csv";
const eng = semuaDept.find((d) => d.name === "Engineering");

r = await fetch(BASE + Q + "&departemen=" + eng.id, { headers: { Cookie: admin } });
const csvEng = await r.text();
cek("filter departemen: 200", r.status === 200, "status=" + r.status);
cek(
  "filter departemen: hanya Engineering",
  csvEng.includes("Engineering") &&
    !namaPerDept.filter((e) => e.departmentId !== eng.id).some((e) => csvEng.includes(e.fullName)),
  "baris dari departemen lain ikut kebawa",
);

// Supervisor: param departemen diabaikan, hasil dikunci ke timnya sendiri.
r = await fetch(BASE + Q + "&departemen=" + semuaDept.find((d) => d.id !== andiDept).id, {
  headers: { Cookie: andi },
});
const csvSup = await r.text();
const bocor = namaPerDept.filter((e) => e.departmentId !== andiDept).filter((e) => csvSup.includes(e.fullName));
cek("supervisor terkunci ke tim sendiri", bocor.length === 0, "bocor: " + bocor.map((e) => e.fullName).join(", "));

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`);
process.exit(gagal ? 1 : 0);