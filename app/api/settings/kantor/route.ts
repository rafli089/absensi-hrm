import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { headers } from "next/headers";
import { clientIp } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { AppError, toResponse } from "@/lib/error";

/** 
 * Konfigurasi lokasi kantor (PRD §12, §6.4).
 * PUT → perbarui koordinat + radius
 */

const bodyKantor = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(255).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(10).max(5000),
});

export async function GET() {
  const auth = await requireApiPermission(PERMISSIONS.SETTINGS_MANAGE);
  if (auth instanceof Response) return auth;

  const kantor = await prisma.office.findFirst({ where: { isActive: true } });
  return Response.json({ kantor });
}

export async function PUT(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.SETTINGS_MANAGE);
  if (auth instanceof Response) return auth;

  let parsed;
  try {
    parsed = bodyKantor.parse(await req.json());
  } catch (e) {
    const pesan = e instanceof z.ZodError ? (e.issues[0]?.message ?? "Format tidak valid.") : "Format tidak valid.";
    return toResponse(new AppError(pesan, "FORMAT_TIDAK_VALID", 400));
  }

  const existing = await prisma.office.findFirst({ where: { isActive: true } });
  const ip = clientIp(await headers());

  const updated = existing
    ? await prisma.office.update({
        where: { id: existing.id },
        data: {
          name: parsed.name,
          address: parsed.address,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          radius: parsed.radius,
        },
      })
    : await prisma.office.create({
        data: {
          name: parsed.name,
          address: parsed.address,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          radius: parsed.radius,
          isActive: true,
        },
      });

  await audit({
    userId: auth.id,
    action: "UPDATE",
    entityType: "office",
    entityId: updated.id,
    oldValue: existing ? { lat: existing.latitude, lng: existing.longitude, radius: existing.radius } : undefined,
    newValue: { lat: parsed.latitude, lng: parsed.longitude, radius: parsed.radius },
    ipAddress: ip,
  }).catch(() => {});

  return Response.json({ ok: true, kantor: updated });
}
