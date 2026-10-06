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

/** Jumlah catatan dari header halaman.
 *  React menyisipkan `<!-- -->` di antara nilai interpolasi dan teks
 *  ("0<!-- --> catatan"), jadi spasi saja tidak cukup. */
const hitung = (html) => {
  const m = html.match(/([\d.]+)(?:<!--\s*-->)?\s+catatan/);
  return m ? m[1] : "?";
};

const admin = await login("super@kantor.id");
const sari = await login("sari@kantor.id"); // EMPLOYEE

const buka = (qs, cookie) => fetch(BASE + "/absensi/riwayat" + qs, { headers: { Cookie: cookie }, redirect: "manual" });

console.log("\n-- form filter (PRD §6.10: date, employee, department, shift, status, location) --");
let r = await buka("", admin);
let h = await r.text();
cek("admin 200", r.status === 200, "status=" + r.status);
for (const f of ["dari", "sampai", "status", "employeeId", "departemen", "shiftId", "officeId"]) {
  cek(`filter ${f} ada`, h.includes(`name="${f}"`));
}

console.log("\n-- karyawan hanya punya filter miliknya sendiri --");
r = await buka("", sari);
h = await r.text();
cek("karyawan 200", r.status === 200, "status=" + r.status);
cek("karyawan punya filter tanggal", h.includes('name="dari"') && h.includes('name="sampai"'));
cek("karyawan punya filter status", h.includes('name="status"'));
cek("karyawan TIDAK punya filter karyawan", !h.includes('name="employeeId"'));
cek("karyawan TIDAK punya filter departemen", !h.includes('name="departemen"'));
cek("karyawan TIDAK punya filter shift", !h.includes('name="shiftId"'));
cek("karyawan TIDAK punya filter kantor", !h.includes('name="officeId"'));

console.log("\n-- employeeId di URL tidak membuka data orang lain --");
// Di mana clause, pengguna tanpa ATTENDANCE_VIEW_ALL selalu dipaksa ke
// employeeId miliknya sendiri, sehingga parameter URL diabaikan total.
// Kalau tidak, ?employeeId=<orang lain> akan membuka akses berbahaya.
const tanpa = await buka("", sari);
const ht = await tanpa.text();
const dengan = await buka("?employeeId=ck00000000000000000000000", sari);
const hd = await dengan.text();
cek("karyawan + employeeId asing tetap 200", dengan.status === 200, "status=" + dengan.status);
cek("jumlah catatan TIDAK berubah", hitung(ht) === hitung(hd), `tanpa=${hitung(ht)} dengan=${hitung(hd)}`);

console.log("\n-- input tidak dipercaya tidak boleh 500 --");
for (const q of [
  "?dari=abc&sampai=abc",
  "?dari=2026-02-31&sampai=2026-02-31",
  "?dari=2026-09-27%27%20OR%20%271%27%3D%271&sampai=2026-09-27",
  "?dari=&sampai=",
  "?status=BUKAN_STATUS",
  "?halaman=-1",
  "?halaman=abc",
  "?halaman=99999",
]) {
  r = await buka(q, admin);
  cek(`${q} → bukan 500`, r.status < 400, "status=" + r.status);
}

console.log("\n-- rentang tanggal benar-benar menyaring --");
// Data absensi tidak mungkin ada pada tahun 2000. Kalau filter tanggal tidak
// bekerja, jumlahnya akan sama dengan rentang luas 2020-2030.
const r2000 = await buka("?dari=2000-01-01&sampai=2000-12-31", admin);
const h2000 = await r2000.text();
const rLebar = await buka("?dari=2020-01-01&sampai=2030-12-31", admin);
const hLebar = await rLebar.text();
cek("rentang tahun 2000 lebih kecil daripada 2020-2030", hitung(h2000) !== hitung(hLebar),
  `2000=${hitung(h2000)} luas=${hitung(hLebar)}`);

console.log("\n-- pagination mempertahankan filter --");
r = await buka("?dari=2020-01-01&sampai=2030-12-31&status=PRESENT&halaman=1", admin);
h = await r.text();
cek("qs membawa dari, sampai, status",
  h.includes("dari=2020-01-01") && h.includes("sampai=2030-12-31") && h.includes("status=PRESENT"),
  "link pagination hilang filter");

console.log("\n=== " + lulus + " lulus, " + gagal + " gagal ===");
process.exit(gagal ? 1 : 0);
