import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { compareSync } from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession, clientIp } from "@/lib/auth/session";
import { audit, catatKeamanan } from "@/lib/audit";
import { izinkan, resetKunci } from "@/lib/keamanan/rate-limit";

/** Batas percobaan login gagal: 5 dalam 10 menit per kombinasi IP+email. */
const MAKS_GAGAL = 5;
const JENDELA_MS = 600_000;

/** Login email + password (PRD §7.1). Session via HTTP-only cookie, bukan JWT di localStorage. */
export async function POST(req: Request) {
  const h = await headers();
  const ip = clientIp(h);
  const ua = h.get("user-agent") ?? undefined;

  const fd = await req.formData().catch(() => null);
  const email = String(fd?.get("email") ?? "").trim().toLowerCase();
  const kunci = `login:${ip}:${email}`;

  // Yang dihitung hanya kegagalan. Login berhasil tidak boleh menambah
  // penghitung, kalau tidak user yang logout-login cepat ikut terkunci.
  if (!izinkan(kunci, MAKS_GAGAL, JENDELA_MS, false).boleh) {
    await catatKeamanan({
      eventType: "RATE_LIMIT_EXCEEDED",
      severity: "HIGH",
      ipAddress: ip,
      description: `Rate limit login terlampaui untuk ${email}.`,
    }).catch(() => {});
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Silakan coba lagi nanti." },
      { status: 429 },
    );
  }

  const password = String(fd?.get("password") ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email dan kata sandi wajib diisi." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: { select: { id: true, fullName: true, isActive: true } } },
  });

  const gagal = "Email atau kata sandi salah.";
  const cocok = user ? compareSync(password, user.passwordHash) : false;

  if (!user || !cocok) {
    izinkan(kunci, MAKS_GAGAL, JENDELA_MS); // catat kegagalan
    await catatKeamanan({
      eventType: "REPEATED_ATTEMPTS",
      severity: "MEDIUM",
      userId: user?.id,
      ipAddress: ip,
      description: `Login gagal untuk ${email}.`,
    }).catch(() => {});
    return NextResponse.json({ error: gagal }, { status: 401 });
  }

  // Berhasil → jangan mewarisi riwayat kegagalan. Kalau tidak, lima kali
  // salah lalu satu kali benar masih menyisakan 4 strike untuk percobaan
  // berikutnya di jendela yang sama.
  resetKunci(kunci);

  if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Akun Anda tidak aktif. Hubungi admin." }, { status: 403 });
  }

  if (user.employee && !user.employee.isActive) {
    return NextResponse.json({ error: "Status karyawan Anda tidak aktif. Hubungi HR." }, { status: 403 });
  }

  const deviceLabel = ua?.slice(0, 120);
  await createSession(user.id, { deviceLabel });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await audit({ userId: user.id, action: "LOGIN", entityType: "session", entityId: user.id, ipAddress: ip, userAgent: ua }).catch(() => {});

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, role: user.role, nama: user.employee?.fullName ?? user.email },
  });
}
