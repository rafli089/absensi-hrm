import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { validateLocation } from "@/lib/lokasi";
import { hitungAbsensi, validasiCheckOut } from "@/lib/absensi/engine";
import { izinkan } from "@/lib/keamanan/rate-limit";
import { audit, catatKeamanan } from "@/lib/audit";
import { headers } from "next/headers";
import { todayDate } from "@/lib/utils";

const bodyCheckOut = z.object({
  photo: z.string().min(1).max(2_000_000), // dataURL JPEG dari client (~1.3MB biner)
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000),
  takenAt: z.string().datetime(),
  deviceId: z.string().optional(),
});

const JENDELA_FOTO_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.ATTENDANCE_CHECK_IN);
  if (auth instanceof Response) return auth;

  if (!auth.employeeId) {
    return Response.json({ error: "Akun Anda belum terhubung ke data karyawan." }, { status: 403 });
  }

  const rate = izinkan(`checkout:${auth.id}`, 10, 60_000);
  if (!rate.boleh) {
    await catatKeamanan({
      employeeId: auth.employeeId, userId: auth.id, eventType: "RATE_LIMIT_EXCEEDED",
      severity: "MEDIUM", ipAddress: clientIp(await headers()),
      description: `Rate limit check-out tercapai untuk ${auth.email}`,
    }).catch(() => {});
    return Response.json({ error: "Terlalu banyak percobaan. Tunggu sebentar." }, { status: 429 });
  }

  let parsed;
  try { parsed = bodyCheckOut.parse(await req.json()); }
  catch (e) {
    const pesan = e instanceof z.ZodError ? e.issues[0]?.message : "Format data tidak valid.";
    return Response.json({ error: pesan }, { status: 400 });
  }

  const ip = clientIp(await headers());
  const deviceId = parsed.deviceId ?? null;

  // --- Cegah replay ---
  if (Date.now() - new Date(parsed.takenAt).getTime() > JENDELA_FOTO_MS) {
    return Response.json({ error: "Sesi absensi sudah kedaluwarsa. Ambil foto lagi.", kode: "FOTO_KEDALUWARSA" }, { status: 400 });
  }

  // --- Aturan §25.2: check-out hanya setelah check-in ---
  const hariIni = todayDate();
  const attendance = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: auth.employeeId, date: hariIni } },
  });

  const invalid = validasiCheckOut(Boolean(attendance?.checkIn));
  if (invalid) {
    return Response.json({ error: invalid.message, kode: invalid.code }, { status: 409 });
  }
  if (attendance!.checkOut) {
    return Response.json({ error: "Anda sudah check-out hari ini." }, { status: 409 });
  }

  // --- Validasi GPS ---
  const kantor = await prisma.office.findFirst({ where: { isActive: true } });
  if (!kantor) {
    return Response.json({ error: "Kantor belum dikonfigurasi. Hubungi admin." }, { status: 500 });
  }
  const gps = validateLocation({ latitude: parsed.latitude, longitude: parsed.longitude, accuracy: parsed.accuracy }, kantor);
  if (!gps.ok) {
    await catatKeamanan({
      employeeId: auth.employeeId, userId: auth.id, eventType: "GPS_OUTSIDE_OFFICE", severity: "MEDIUM",
      ipAddress: ip, deviceId: deviceId ?? undefined,
      latitude: parsed.latitude, longitude: parsed.longitude,
      description: `Check-out ditolak: ${gps.reason}`,
    }).catch(() => {});
    return Response.json({ error: gps.reason, kode: "GPS_TIDAK_VALID" }, { status: 422 });
  }

  // --- Ambil shift & hitung status final ---
  const assignment = await prisma.employeeShift.findUnique({
    where: { employeeId_date: { employeeId: auth.employeeId, date: hariIni } },
    include: { shift: true },
  });

  const now = new Date();
  const hasil = hitungAbsensi({
    shift: assignment?.shift ? {
      startTime: assignment.shift.startTime, endTime: assignment.shift.endTime,
      breakStart: assignment.shift.breakStart, breakEnd: assignment.shift.breakEnd,
      gracePeriod: assignment.shift.gracePeriod, isOvernight: assignment.shift.isOvernight,
    } : null,
    checkIn: attendance!.checkIn, checkOut: now, gpsVerified: true,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const att = await tx.attendance.update({
      where: { id: attendance!.id },
      data: {
        checkOut: now, latitude: parsed.latitude, longitude: parsed.longitude,
        accuracy: parsed.accuracy, distanceFromOffice: gps.distance,
        status: hasil.status, lateMinutes: hasil.lateMinutes,
        earlyLeaveMinutes: hasil.earlyLeaveMinutes, workMinutes: hasil.workMinutes,
        overtimeMinutes: hasil.overtimeMinutes,
      },
    });

    await tx.attendanceEvent.create({
      data: {
        attendanceId: att.id, employeeId: auth.employeeId!, eventType: "CHECK_OUT", timestamp: now,
        latitude: parsed.latitude, longitude: parsed.longitude, accuracy: parsed.accuracy,
        deviceId, ipAddress: ip, photo: parsed.photo,
        metadata: { distance: gps.distance, workMinutes: hasil.workMinutes, photoTakenAt: parsed.takenAt },
      },
    });

    return att;
  });

  await audit({ userId: auth.id, action: "UPDATE", entityType: "attendance", entityId: updated.id, oldValue: { checkOut: null, status: attendance!.status }, newValue: { checkOut: now, status: hasil.status, workMinutes: hasil.workMinutes }, ipAddress: ip }).catch(() => {});

  return Response.json({
    ok: true,
    attendance: {
      id: updated.id, checkIn: updated.checkIn, checkOut: updated.checkOut,
      status: hasil.status, lateMinutes: hasil.lateMinutes,
      workMinutes: hasil.workMinutes, overtimeMinutes: hasil.overtimeMinutes,
    },
  });
}
