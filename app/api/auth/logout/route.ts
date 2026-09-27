import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { destroySession, getSessionUser, clientIp } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

/** Logout: revoke session server-side + hapus cookie (PRD §24 mencatat logout). */
export async function POST() {
  const user = await getSessionUser();
  const h = await headers();
  const ip = clientIp(h);

  await destroySession();

  if (user) {
    await audit({
      userId: user.id,
      action: "LOGOUT",
      entityType: "session",
      entityId: user.sessionId,
      ipAddress: ip,
      userAgent: h.get("user-agent") ?? undefined,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
