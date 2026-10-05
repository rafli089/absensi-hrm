import { prisma } from "@/lib/db";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AppError, NotFoundError, toResponse } from "@/lib/error";
import { audit } from "@/lib/audit";
import { headers } from "next/headers";
import { z } from "zod";

/**
 * Putuskan pengajuan ganti kata sandi.
 * PATCH → approve (terapkan hash baru ke User.passwordHash) / reject.
 * Hanya approver (PASSWORD_APPROVE: SPV/HR/ADMIN/SUPER_ADMIN).
 */

const bodyKeputusan = z.object({
  keputusan: z.enum(["APPROVED", "REJECTED"]),
  catatan: z.string().max(500).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission(PERMISSIONS.PASSWORD_APPROVE);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const parsed = bodyKeputusan.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return toResponse(new AppError(issue?.message ?? "Data tidak valid.", "FORMAT_TIDAK_VALID", 400));
  }

  const { keputusan, catatan } = parsed.data;

  const pengajuan = await prisma.passwordChangeRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, username: true } } },
  });
  if (!pengajuan) return toResponse(new NotFoundError("Pengajuan kata sandi", id));
  if (pengajuan.status !== "PENDING") {
    return toResponse(new AppError("Pengajuan ini sudah diputuskan.", "SUDAH_DIPUTUSKAN", 409));
  }

  // Terapkan kata sandi baru hanya saat APPROVED.
  await prisma.$transaction(async (tx) => {
    await tx.passwordChangeRequest.update({
      where: { id },
      data: {
        status: keputusan,
        decidedById: auth.id,
        decidedAt: new Date(),
        decisionNote: catatan ?? null,
      },
    });
    if (keputusan === "APPROVED") {
      await tx.user.update({
        where: { id: pengajuan.userId },
        data: { passwordHash: pengajuan.newPasswordHash },
      });
    }
  });

  await audit({
    userId: auth.id,
    action: keputusan === "APPROVED" ? "APPROVE" : "REJECT",
    entityType: "password_change_request",
    entityId: id,
    newValue: {
      pemohon: pengajuan.user.email,
      keputusan,
      catatan,
    },
    ipAddress: clientIp(await headers()),
  }).catch(() => {});

  return Response.json({ ok: true, status: keputusan, id });
}
