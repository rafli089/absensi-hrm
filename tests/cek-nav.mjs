const BASE = "http://localhost:3000";

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: "email=super%40kantor.id&password=password123",
  redirect: "manual",
});
const cookie = login.headers.getSetCookie()?.[0]?.split(";")[0] ?? "";
console.log("login:", login.status, cookie ? "OK" : "NO COOKIE");

for (const path of ["/dashboard", "/absensi/hari-ini", "/absensi/riwayat", "/karyawan", "/shift", "/penggajian", "/keamanan", "/pengaturan/kantor"]) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie }, redirect: "manual" });
  const html = await res.text();
  const aside = /<aside[^>]*w-60/.test(html);
  const pengaturan = html.includes("/pengaturan/kantor");
  const mobile = /<header[^>]*lg:hidden/.test(html);
  const navRiwayat = html.includes('href="/absensi/riwayat"');
  const h1 = (html.match(/<h1[^>]*>([^<]{0,60})/) ?? [])[1] ?? "-";
  const boom = html.includes("Application error") || html.includes("Internal Server Error");
  console.log(
    `${path.padEnd(20)} ${res.status}${boom ? " ERROR!" : ""}  sb:${aside ? "Y" : "-"} mob:${mobile ? "Y" : "-"} set:${pengaturan ? "Y" : "-"} riwayat:${navRiwayat ? "Y" : "-"}  h1="${h1.trim()}"`,
  );
}
