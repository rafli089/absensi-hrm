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

async function calc(cookie, data) {
  return fetch(BASE + "/api/payroll/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(data),
  });
}

const admin = await login("super@kantor.id");
const budi = await login("budi@kantor.id");

// Periode panjang agar ada attendance
const periodStart = "2026-09-01";
const periodEnd = "2026-09-30";

console.log("\n-- karyawan biasa tidak boleh kalkulasi --");
let r = await calc(budi, { periodStart, periodEnd });
cek("ditolak tanpa izin", r.status === 403, "status=" + r.status);

console.log("\n-- validasi periode --");
r = await calc(admin, { periodStart: "bukan-tanggal", periodEnd: periodEnd });
cek("tanggal rusak ditolak", r.status === 400);

r = await calc(admin, { periodStart: periodEnd, periodEnd: periodStart });
cek("periode terbalik ditolak", r.status === 400);

console.log("\n-- kalkulasi --");
r = await calc(admin, { periodStart, periodEnd });
const data = await r.json();
cek("200 OK", r.status === 200, JSON.stringify(data).slice(0, 200));
cek("ada karyawan diproses", data.diproses > 0, "diproses=" + data.diproses);
cek("semua punya netSalary > 0", data.hasil.every((h) => h.netSalary > 0), JSON.stringify(data.hasil?.slice(0,2)));
cek("status CALCULATED", data.hasil.every((h) => h.status === "CALCULATED"));

// Cek row tersimpan + items
const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
const payrolls = await p.payroll.findMany({
  where: { periodStart: new Date(periodStart + "T00:00:00.000Z"), periodEnd: new Date(periodEnd + "T00:00:00.000Z") },
  include: { items: true, employee: { select: { employeeCode: true, fullName: true } } },
});
console.log("\n  row payroll tersimpan:", payrolls.length);
for (const pr of payrolls.slice(0, 3)) {
  const items = pr.items.map((i) => `${i.name}=${Number(i.amount).toLocaleString("id-ID")}`).join(", ");
  console.log(`  ${pr.employee.employeeCode} ${pr.employee.fullName}: pokok=${Number(pr.basicSalary).toLocaleString("id-ID")} net=${Number(pr.netSalary).toLocaleString("id-ID")} hari=${pr.workDays}`);
  console.log(`    items: ${items}`);
}
cek("payroll + items tersimpan", payrolls.length > 0 && payrolls[0].items.length > 0);
cek("semua punya items", payrolls.every((pr) => pr.items.length > 0));

// Idempotency: jalankan ulang, tidak duplikat
r = await calc(admin, { periodStart, periodEnd });
const data2 = await r.json();
const payrolls2 = await p.payroll.findMany({ where: { periodStart: new Date(periodStart + "T00:00:00.000Z") } });
cek("tidak duplikat saat re-run", payrolls2.length === payrolls.length, `${payrolls.length} -> ${payrolls2.length}`);

// Bersihkan
await p.payroll.deleteMany({ where: { periodStart: new Date(periodStart + "T00:00:00.000Z") } });
await p.$disconnect();
console.log("\n  (data uji dibersihkan)");

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`);
process.exit(gagal ? 1 : 0);
