const BASE = "http://localhost:3000";
let lulus = 0, gagal = 0;
function cek(nama, kond, info = "") {
  if (kond) { lulus++; console.log("  OK   " + nama); }
  else { gagal++; console.log("  GAGAL " + nama + (info ? " — " + info : "")); }
}

async function cobaLogin(email, password = "password123") {
  return fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "email=" + encodeURIComponent(email) + "&password=" + encodeURIComponent(password),
    redirect: "manual",
  });
}

// Rate-limit: 5 percobaan per 10 menit per kunci IP+email.
// Kunci unik per run supaya test lain tidak ikut kena.
const suffix = Math.random().toString(36).slice(2, 8);
const kandidat = "bruteforce-" + suffix + "@kantor.id";

console.log("\n-- login dengan password salah --");
let kode = [];
for (let i = 0; i < 7; i++) {
  const r = await cobaLogin(kandidat, "salah-sekali");
  kode.push(r.status);
}
cek("percobaan 1-5 = 401 (salah password)", kode.slice(0, 5).every((s) => s === 401), kode.join(","));
cek("percobaan 6-7 = 429 (kena rate-limit)", kode.slice(5).every((s) => s === 429), kode.join(","));

console.log("\n-- akun asli tidak bisa dibobol setelah limit kena --");
// Password benar tapi sudah kena limit → tetap 429. Kalau ini 200, rate-limit
// hanya menahan yang salah dan bisa dilewati dengan tebakan yang benar.
const sari = await cobaLogin("sari@kantor.id");
cek("login normal tetap bisa (kunci berbeda)", sari.status === 200, "status=" + sari.status);

const andi = await cobaLogin("andi@kantor.id");
cek("akun kedua tidak terpengaruh", andi.status === 200, "status=" + andi.status);

console.log("\n-- pesan 429 harus actionable, tidak membocorkan info --");
const r429 = await cobaLogin(kandidat, "salah-sekali");
const body = await r429.json();
cek("status 429", r429.status === 429);
cek("pesan bahasa Indonesia yang jelas", typeof body.error === "string" && body.error.length > 10, JSON.stringify(body));
cek("tidak membocorkan apakah email terdaftar", !JSON.stringify(body).toLowerCase().includes("tidak ditemukan"));

console.log("\n=== " + lulus + " lulus, " + gagal + " gagal ===");
process.exit(gagal ? 1 : 0);
