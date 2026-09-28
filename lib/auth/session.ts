import "server-only";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";
import { can, type Permission } from "./permissions";

const COOKIE = "absensi_session";
const MAX_AGE = 60 * 60 * 8; // 8 jam

export type SessionUser = {
  id: string;
  sessionId: string;
  email: string;
  username: string;
  fullName: string;
  role: Role;
  employeeId: string | null;
  photoUrl: string | null;
  departmentId: string | null;
};

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET belum diset atau terlalu pendek (min. 32 karakter). Lihat .env.example");
  }
  return s;
}

export async function createSession(userId: string, meta: { deviceId?: string; deviceLabel?: string }): Promise<string> {
  secret(); // fail-fast: SESSION_SECRET harus valid sebelum bikin session
  const token = randomBytes(32).toString("hex");
  const h = await headers();
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);

  await prisma.session.create({
    data: {
      sessionToken: token,
      userId,
      deviceId: meta.deviceId,
      deviceLabel: meta.deviceLabel,
      ipAddress: clientIp(h),
      userAgent: h.get("user-agent") ?? undefined,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { sessionToken: token, status: "ACTIVE" },
      data: { status: "REVOKED" },
    });
  }
  store.delete(COOKIE);
}

/**
 * Ambil user aktif dari cookie. Return null kalau tidak login / revoked / kadaluarsa.
 * update lastActivityAt dibiarkan Prisma yang urus (tidak ditulis tiap request).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findFirst({
    where: { sessionToken: token, status: "ACTIVE", expiresAt: { gt: new Date() } },
    include: {
      user: {
        include: { employee: { select: { id: true, fullName: true, photoUrl: true, departmentId: true, isActive: true } } },
      },
    },
  });

  if (!session || session.user.status !== "ACTIVE") return null;
  if (session.user.employee && !session.user.employee.isActive) return null;

  return {
    id: session.user.id,
    sessionId: session.id,
    email: session.user.email,
    username: session.user.username,
    fullName: session.user.employee?.fullName ?? session.user.email,
    role: session.user.role,
    employeeId: session.user.employee?.id ?? null,
    photoUrl: session.user.employee?.photoUrl ?? null,
    departmentId: session.user.employee?.departmentId ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Guard halaman: wajib login + wajib punya permission. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/dashboard?access=denied");
  return user;
}

/** Guard API: return 401/403, bukan redirect (dipakai route handler). */
export async function requireApiPermission(permission: Permission): Promise<SessionUser | Response> {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  if (!can(user.role, permission)) return Response.json({ error: "Akses ditolak." }, { status: 403 });
  return user;
}

export function clientIp(h: Headers): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}
