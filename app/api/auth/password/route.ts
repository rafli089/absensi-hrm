import { prisma } from "@/lib/db";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AppError, toResponse } from "@/lib/error";
import { hash, verify, kuat } from "@/lib/auth/hashi";
import { audit } from "@/lib/audit";
import { izinkan } from "@/lib/keamanan/rate-limit";
import { headers } from "next/headers";
import { z } from "zod";
import { Role } from "@prisma/client";

/**
 * Ganti kata sandi sendiri.
 *
 * Karyawan (EMPLOYEE) tidak langsung mengubah kata sandi: pengajuan PENDING
 * ditunggu keputusan atasan (SPV/HR/Admin) lewat /api/auth/password/requests/[id].
 * Staff (SUPERVISOR/HR/ADMIN/SUPER_ADMIN) langsung di-update — tidak butuh
 * approval karena mereka atasan, bukan karyawan biasa.
 */

const bodyGanti = z.object({
  currentPassword: z.string().min(1, "Kata sandi lama wajib diisi."),
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter."),
});

export async function POST(req: Request) {
  // PASSWORD_RESET ada di semua role (karyawan pun). Berbeda dengan
  // LEAVE_REQUEST — ini tidak perlu check employeeId.
  const auth = await requireApiPermission(PERMISSIONS.PASSWORD_RESET);
  if (auth instanceof Response) return auth;

  const parsed = bodyGanti.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const pesan =
      issue?.code === "custom"
        ? issue.message
        : "Data tidak valid.";
    return toResponse(new AppError(pesan, "FORMAT_TIDAK_VALID", 400));
  }

  const { currentPassword, newPassword } = parsed.data;

  // Anti brute-force kata sandi lama — pola sama dengan login.
  const rate = izinkan(`ganti-password:${auth.id}`, 5, 60_000);
  if (!rate.boleh) {
    return toResponse(new AppError("Terlalu banyak percobaan. Coba lagi nanti.", "RATE_LIMITED", 429));
  }

  // Verifikasi kata sandi lama dulu — sumber kebenaran dari DB, bukan session.
  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { passwordHash: true, role: true },
  });
  if (!user || !verify(currentPassword, user.passwordHash)) {
    return toResponse(new AppError("Kata sandi lama salah.", "KREDENSIAL_SALAH", 401));
  }

  // Kekuatan kata sandi baru (PRD §12).
  const lemah = kuat(newPassword);
  if (lemah.length > 0) {
    return toResponse(new AppError(lemah.join(" "), "FORMAT_TIDAK_VALID", 422));
  }

  // Staff → langsung di-update.
  if (user.role !== Role.EMPLOYEE) {
    await prisma.user.update({
      where: { id: auth.id },
      data: { passwordHash: hash(newPassword) },
    });
    await audit({
      userId: auth.id,
      action: "UPDATE",
      entityType: "user",
      entityId: auth.id,
      newValue: { field: "passwordHash" },
      ipAddress: clientIp(await headers()),
    }).catch(() => {});

    return Response.json({ ok: true, langsung: true });
  }

  // Karyawan → buat pengajuan PENDING. Hapus pengajuan PENDING lama supaya
  // tidak menumpuk; yang terbaru yang sah.
  const hashBaru = hash(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.passwordChangeRequest.deleteMany({
      where: { userId: auth.id, status: "PENDING" },
    });
    await tx.passwordChangeRequest.create({
      data: { userId: auth.id, newPasswordHash: hashBaru },
    });
  });

  await audit({
    userId: auth.id,
    action: "CREATE",
    entityType: "password_change_request",
    entityId: auth.id,
    ipAddress: clientIp(await headers()),
  }).catch(() => {});

  return Response.json({ ok: true, menunggu: true }, { status: 202 });
}
