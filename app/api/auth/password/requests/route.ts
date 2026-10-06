import { prisma } from "@/lib/db";
import { requireApiPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";

/**
 * Daftar pengajuan ganti kata sandi.
 * GET → approver (PASSWORD_APPROVE) = semua pengajuan PENDING;
 *       karyawan (PASSWORD_RESET)  = riwayat pengajuan sendiri.
 */

/** Kolom yang boleh keluar ke klien. `newPasswordHash` sengaja tidak
 *  termasuk — hash tidak pernah dikirim ke browser, walau pun sedang
 *  menunggu approval. */
const TAMPIL = {
  id: true,
  status: true,
  decidedById: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
} as const;

export async function GET() {
  // Approver dulu — lihat semua yang PENDING (nama pemohon ikut dibagikan).
  const authAll = await requireApiPermission(PERMISSIONS.PASSWORD_APPROVE);
  if (!(authAll instanceof Response)) {
    const data = await prisma.passwordChangeRequest.findMany({
      where: { status: "PENDING" },
      select: {
        ...TAMPIL,
        user: { select: { id: true, email: true, username: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({ ok: true, data });
  }

  // Karyawan: hanya riwayat sendiri.
  const authSelf = await requireApiPermission(PERMISSIONS.PASSWORD_RESET);
  if (authSelf instanceof Response) return authSelf;

  const data = await prisma.passwordChangeRequest.findMany({
    where: { userId: authSelf.id },
    select: {
      ...TAMPIL,
      decidedBy: { select: { email: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return Response.json({ ok: true, data });
}
