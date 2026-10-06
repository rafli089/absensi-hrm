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
const hr = await login("rina@kantor.id"); // HR: PAYROLL_MANAGE

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
cek("semua punya netSalary > 0", data.hasil.every((h) => h.netSalary > 0), JSON.stringify(data.hasil?.slice(0, 2)));
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
await r.json();
const payrolls2 = await p.payroll.findMany({ where: { periodStart: new Date(periodStart + "T00:00:00.000Z") } });
cek("tidak duplikat saat re-run", payrolls2.length === payrolls.length, `${payrolls.length} -> ${payrolls2.length}`);

// Lock guard (PRD §6.14): payroll yang sudah disetujui/dibayar tidak boleh
// dihitung ulang. Respons tetap 200 dengan `gagal` per karyawan supaya sisa
// batch tetap jalan.
console.log("\n-- lock guard --");
const target = payrolls[0];
const kunci = async (status, harusDitolak) => {
  await p.payroll.update({ where: { id: target.id }, data: { status } });
  const sebelum = await p.payroll.findUnique({ where: { id: target.id } });
  const rr = await calc(admin, { periodStart, periodEnd, employeeIds: [target.employeeId] });
  const dd = await rr.json();
  const sesudah = await p.payroll.findUnique({ where: { id: target.id } });
  cek(
    `${status} ${harusDitolak ? "tidak ditimpa" : "boleh dihitung ulang"}`,
    harusDitolak
      ? sesudah.status === status && String(sesudah.netSalary) === String(sebelum.netSalary)
      : sesudah.status === "CALCULATED",
    `status=${sesudah.status} gagal=${dd.gagal}`,
  );
  if (harusDitolak) {
    cek(`${status}: alasan menyebut status`, dd.error?.[0]?.reason?.includes(status) === true, JSON.stringify(dd.error));
  }
};
await kunci("REVIEWED", true);
await kunci("APPROVED", true);
await kunci("PAID", true);
await kunci("LOCKED", true);
await kunci("DRAFT", false);
await kunci("CALCULATED", false);

// Satu karyawan terkunci tidak boleh menghentikan sisa batch
await p.payroll.update({ where: { id: target.id }, data: { status: "APPROVED" } });
r = await calc(admin, { periodStart, periodEnd });
const batch = await r.json();
cek("batch campur: sebagian gagal, sebagian diproses", batch.diproses > 0 && batch.gagal > 0, `diproses=${batch.diproses} gagal=${batch.gagal}`);

// Siklus status (PRD §6.14): CALCULATED → REVIEWED → APPROVED → PAID → LOCKED
console.log("\n-- siklus status --");
const setStatus = (cookie, id, body) =>
  fetch(BASE + "/api/payroll/" + id + "/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });

const siklus = payrolls[1] ?? payrolls[0];
const idS = siklus.id;
const status = async () => (await p.payroll.findUnique({ where: { id: idS } })).status;

cek("mulai CALCULATED", (await status()) === "CALCULATED");

r = await setStatus(hr, idS, { status: "REVIEWED" });
cek("HR bisa REVIEWED", r.status === 200 && (await status()) === "REVIEWED", "status=" + r.status);

r = await setStatus(hr, idS, { status: "APPROVED" });
cek("HR tidak bisa APPROVED (butuh PAYROLL_APPROVE)", r.status === 403, "status=" + r.status);
cek("status tidak berubah setelah ditolak", (await status()) === "REVIEWED");

r = await setStatus(budi, idS, { status: "APPROVED" });
cek("karyawan biasa ditolak", r.status === 403, "status=" + r.status);

r = await setStatus(admin, idS, { status: "APPROVED" });
cek("SUPER_ADMIN bisa APPROVED", r.status === 200 && (await status()) === "APPROVED", "status=" + r.status);
const disetujui = await p.payroll.findUnique({ where: { id: idS } });
cek("approvedAt terisi", disetujui.approvedAt !== null);

r = await setStatus(admin, idS, { status: "REVIEWED" });
cek("tidak bisa mundur ke REVIEWED", r.status === 409, "status=" + r.status);

r = await setStatus(admin, idS, { status: "PAID" });
cek("bisa PAID", r.status === 200 && (await status()) === "PAID", "status=" + r.status);

r = await setStatus(admin, idS, { status: "LOCKED" });
cek("bisa LOCKED", r.status === 200 && (await status()) === "LOCKED", "status=" + r.status);

console.log("\n-- reset ke DRAFT --");
r = await setStatus(admin, idS, { status: "DRAFT" });
cek("LOCKED tanpa alasan ditolak", r.status === 400, "status=" + r.status);

r = await setStatus(admin, idS, { status: "DRAFT", reason: "Gaji pokok salah, ada koreksi struktur" });
cek("LOCKED + alasan bisa reset", r.status === 200 && (await status()) === "DRAFT", "status=" + r.status);
const direset = await p.payroll.findUnique({ where: { id: idS } });
cek("approvedAt dikosongkan", direset.approvedAt === null && direset.approvedById === null);
cek("alasan tersimpan di notes", String(direset.notes ?? "").includes("Gaji pokok salah"), String(direset.notes));

console.log("\n-- payroll terkunci jadi bisa dihitung ulang --");
// Kembali ke REVIEWED dulu -> kalkulasi harus tetap menolak (guard masih berlaku)
r = await setStatus(admin, idS, { status: "REVIEWED" });
cek("kembali REVIEWED", r.status === 200, "status=" + r.status);
r = await calc(admin, { periodStart, periodEnd, employeeIds: [siklus.employeeId] });
const masihTerkunci = await r.json();
cek("REVIEWED tetap ditolak kalkulasi", (masihTerkunci.gagal ?? 0) > 0, JSON.stringify(masihTerkunci.error));
// Reset ke DRAFT -> kalkulasi boleh jalan lagi
r = await setStatus(admin, idS, { status: "DRAFT", reason: "Reset untuk uji" });
cek("reset ke DRAFT", r.status === 200, "status=" + r.status);
r = await calc(admin, { periodStart, periodEnd, employeeIds: [siklus.employeeId] });
const setelahReset = await r.json();
cek("setelah reset ke DRAFT, kalkulasi jalan lagi", (setelahReset.gagal ?? 0) === 0, JSON.stringify(setelahReset.error));

console.log("\n-- validasi --");
r = await setStatus(admin, "id-tidak-ada", { status: "PAID" });
cek("payroll tak ada -> 404", r.status === 404, "status=" + r.status);

r = await setStatus(admin, idS, { status: "NGAWUR" });
cek("status ngawur -> 400", r.status === 400, "status=" + r.status);

r = await setStatus(admin, idS, {});
cek("tanpa status -> 400", r.status === 400, "status=" + r.status);

// Bersihkan
await p.payroll.deleteMany({ where: { periodStart: new Date(periodStart + "T00:00:00.000Z") } });
await p.$disconnect();
console.log("\n  (data uji dibersihkan)");

console.log(`\n=== ${lulus} lulus, ${gagal} gagal ===`);
process.exit(gagal ? 1 : 0);
