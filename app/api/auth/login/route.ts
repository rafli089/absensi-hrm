import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { compareSync } from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession, clientIp } from "@/lib/auth/session";
import { audit, catatKeamanan } from "@/lib/audit";

/** Login email + password (PRD §7.1). Session via HTTP-only cookie, bukan JWT di localStorage. */
export async function POST(req: Request) {
  const h = await headers();
  const ip = clientIp(h);
  const ua = h.get("user-agent") ?? undefined;

  const fd = await req.formData().catch(() => null);
  const email = String(fd?.get("email") ?? "").trim().toLowerCase();
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
    await catatKeamanan({
      eventType: "REPEATED_ATTEMPTS",
      severity: "MEDIUM",
      userId: user?.id,
      ipAddress: ip,
      description: `Login gagal untuk ${email}.`,
    }).catch(() => {});
    return NextResponse.json({ error: gagal }, { status: 401 });
  }

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
