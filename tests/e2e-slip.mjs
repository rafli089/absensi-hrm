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

// Buat 1 payroll untuk uji
const kari = await p.employee.findFirst({ where: { employeeCode: "EMP-002" }, select: { id: true } });
const pr = await p.payroll.create({
  data: {
    employeeId: kari.id,
    periodStart: new Date("2026-08-01T00:00:00Z"),
    periodEnd: new Date("2026-08-31T00:00:00Z"),
    basicSalary: 15_000_000,
    netSalary: 15_500_000,
    totalAllowance: 1_300_000,
    totalDeduction: 800_000,
    status: "CALCULATED",
  },
});

// Buat item
await p.payrollItem.createMany({
  data: [
    { payrollId: pr.id, name: "Tunjangan Transport", amount: 800_000 },
    { payrollId: pr.id, name: "BPJS Kesehatan", amount: -150_000 },
    { payrollId: pr.id, name: "BPJS Ketenagakerjaan", amount: -300_000 },
  ],
});

const admin = await login("super@kantor.id");
const kari2 = await login("budi@kantor.id");

console.log("\n-- /penggajian/[id]/slip --");
let r = await fetch(BASE + "/penggajian/" + pr.id + "/slip", { headers: { Cookie: admin }, redirect: "manual" });
let h = await r.text();
cek("admin boleh lihat 200", r.status === 200 && !h.includes("tidak memiliki akses"), "status=" + r.status);
cek("nama Budi muncul", h.includes("Budi Santoso"));
cek("kode EMP-002 muncul", h.includes("EMP-002"));
cek("Gaji Pokok 15.000.000", h.includes("15.000.000"));
cek("Tunjangan Transport muncul", h.includes("Tunjangan Transport"));
cek("BPJS Kesehatan muncul", h.includes("BPJS Kesehatan"));
cek("Slip Gaji header", h.includes("Slip Gaji"));
cek("Tombol Cetak ada", h.includes("Cetak"));
cek("Take Home Pay ada", h.includes("Take Home Pay") || h.includes("Gaji Bersih"));

r = await fetch(BASE + "/penggajian/" + pr.id + "/slip", { headers: { Cookie: kari2 }, redirect: "manual" });
h = await r.text();
cek("karyawan EMP-002 boleh lihat slip sendiri 200", r.status === 200 && !h.includes("tidak memiliki akses"));

// Karyawan lain tidak boleh lihat
const sari = await login("sari@kantor.id");
r = await fetch(BASE + "/penggajian/" + pr.id + "/slip", { headers: { Cookie: sari }, redirect: "manual" });
h = await r.text();
cek("karyawan lain ditolak", h.includes("tidak memiliki akses"), "status=" + r.status);

// Link "Lihat" ada di daftar penggajian untuk admin
r = await fetch(BASE + "/penggajian", { headers: { Cookie: admin }, redirect: "manual" });
h = await r.text();
cek("link Lihat ke slip ada di daftar", h.includes("/penggajian/" + pr.id + "/slip"));

// Hapus data uji
await p.payrollItem.deleteMany({ where: { payrollId: pr.id } });
await p.payroll.delete({ where: { id: pr.id } });
await p.$disconnect();
console.log("  (data uji dibersihkan)");

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`);
process.exit(gagal ? 1 : 0);
