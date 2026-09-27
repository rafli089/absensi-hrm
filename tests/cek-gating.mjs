const BASE = "http://localhost:3000";

async function loginAs(email) {
  const r = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "email=" + encodeURIComponent(email) + "&password=password123",
    redirect: "manual",
  });
  return r.headers.getSetCookie()?.[0]?.split(";")[0] ?? "";
}

async function check() {
  const budi = await loginAs("budi@kantor.id");
  console.log("=== Budi (EMPLOYEE) ===");
  for (const p of ["/karyawan", "/shift", "/penggajian", "/keamanan", "/dashboard"]) {
    const res = await fetch(BASE + p, { headers: { Cookie: budi }, redirect: "manual" });
    const h = await res.text();
    const deny = h.includes("tidak memiliki akses");
    const linkKar = h.includes('href="/karyawan"');
    const linkKeam = h.includes('href="/keamanan"');
    console.log(p.padEnd(14), res.status, deny ? "DITOLAK" : "ok", p === "/dashboard" ? ("navKar:" + (linkKar ? "BOCOR" : "aman") + " navKeam:" + (linkKeam ? "BOCOR" : "aman")) : "");
  }

  const superAdm = await loginAs("super@kantor.id");
  console.log("\n=== Super Admin ===");
  for (const p of ["/karyawan", "/shift", "/penggajian", "/keamanan", "/dashboard"]) {
    const res = await fetch(BASE + p, { headers: { Cookie: superAdm }, redirect: "manual" });
    const h = await res.text();
    const linkKar = h.includes('href="/karyawan"');
    const linkKeam = h.includes('href="/keamanan"');
    console.log(p.padEnd(14), res.status, "navKar:" + (linkKar ? "ada" : "-") + " navKeam:" + (linkKeam ? "ada" : "-"));
  }
}

check();