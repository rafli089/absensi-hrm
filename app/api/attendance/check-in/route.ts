import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { validateLocation } from "@/lib/lokasi";
import { hitungAbsensi } from "@/lib/absensi/engine";
import { izinkan } from "@/lib/keamanan/rate-limit";
import { audit, catatKeamanan } from "@/lib/audit";
import { headers } from "next/headers";
import { clientIp } from "@/lib/auth/session";
import { todayDate } from "@/lib/utils";
import { fotoAbsen } from "@/lib/absensi/foto";
import { saveFoto, deleteFoto } from "@/lib/absensi/fotoStorage";
import { kirimWebhook, webhookPayloadAttendance } from "@/lib/integrasi/kirim";

/** Validasi input check-in (PRD §10). */
const bodyCheckIn = z.object({
  photo: fotoAbsen,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000),
  takenAt: z.string().datetime(),
  deviceId: z.string().optional(),
});

/** Toleransi waktu antara foto diambil dan request (detik). Mencegah replay. */
const JENDELA_FOTO_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  // --- Auth ---
  const auth = await requireApiPermission(PERMISSIONS.ATTENDANCE_CHECK_IN);
  if (auth instanceof Response) return auth;

  if (!auth.employeeId) {
    return Response.json({ error: "Akun Anda belum terhubung ke data karyawan." }, { status: 403 });
  }

  // --- Rate limit: 10 percobaan check-in per menit per user ---
  const rate = izinkan(`checkin:${auth.id}`, 10, 60_000);
  if (!rate.boleh) {
    await catatKeamanan({
      employeeId: auth.employeeId, userId: auth.id, eventType: "RATE_LIMIT_EXCEEDED",
      severity: "MEDIUM", ipAddress: clientIp(await headers()),
      description: `Rate limit check-in tercapai untuk ${auth.email}`,
    }).catch(() => {});
    return Response.json({ error: "Terlalu banyak percobaan. Tunggu sebentar." }, { status: 429 });
  }

  let parsed;
  try { parsed = bodyCheckIn.parse(await req.json()); }
  catch (e) {
    const pesan = e instanceof z.ZodError ? e.issues[0]?.message : "Format data tidak valid.";
    return Response.json({ error: pesan }, { status: 400 });
  }

  const ip = clientIp(await headers());
  const deviceId = parsed.deviceId ?? null;

  // --- Cegah replay foto (>5 menit) ---
  if (Date.now() - new Date(parsed.takenAt).getTime() > JENDELA_FOTO_MS) {
    return Response.json({ error: "Sesi absensi sudah kedaluwarsa. Ambil foto lagi.", kode: "FOTO_KEDALUWARSA" }, { status: 400 });
  }

  // --- Aturan §25.1: satu check-in aktif per shift ---
  const hariIni = todayDate();
  const sudah = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: auth.employeeId, date: hariIni } },
  });
  if (sudah?.checkIn && !sudah.checkOut) {
    return Response.json({ error: "Anda sudah check-in hari ini. Gunakan tombol Check-out untuk absen pulang." }, { status: 409 });
  }
  if (sudah?.checkIn && sudah.checkOut) {
    return Response.json({ error: "Anda sudah absen lengkap hari ini." }, { status: 409 });
  }

  // --- Validasi GPS (PRD §6.4, §23) ---
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
      description: `Check-in ditolak: ${gps.reason}`,
      metadata: { distance: gps.distance, accuracy: gps.accuracy, radius: kantor.radius },
    }).catch(() => {});
    return Response.json({ error: gps.reason, kode: "GPS_TIDAK_VALID" }, { status: 422 });
  }

  // --- Ambil shift hari ini (PRD §25.5) ---
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
    checkIn: now, checkOut: null, gpsVerified: true,
  });

  // --- Simpan foto ke object storage, DB cuma pegang path ---
  const fotoPath = await saveFoto(parsed.photo);

  // --- Simpan (PRD §24: audit trail) ---
  let attendance;
  try {
    attendance = await prisma.$transaction(async (tx) => {
      const att = await tx.attendance.upsert({
        where: { employeeId_date: { employeeId: auth.employeeId!, date: hariIni } },
        update: { checkIn: now, photo: fotoPath, latitude: parsed.latitude, longitude: parsed.longitude, accuracy: parsed.accuracy, distanceFromOffice: gps.distance, officeId: kantor.id, shiftId: assignment?.shiftId ?? null, ipAddress: ip, deviceId, status: hasil.status, lateMinutes: hasil.lateMinutes, earlyLeaveMinutes: 0, workMinutes: 0, overtimeMinutes: 0, rejectionReason: null },
        create: { employeeId: auth.employeeId!, officeId: kantor.id, shiftId: assignment?.shiftId ?? null, date: hariIni, checkIn: now, photo: fotoPath, latitude: parsed.latitude, longitude: parsed.longitude, accuracy: parsed.accuracy, distanceFromOffice: gps.distance, ipAddress: ip, deviceId, status: hasil.status, lateMinutes: hasil.lateMinutes, workMinutes: 0, overtimeMinutes: 0 },
      });

      await tx.attendanceEvent.create({
        data: {
          attendanceId: att.id, employeeId: auth.employeeId!, eventType: "CHECK_IN", timestamp: now,
          latitude: parsed.latitude, longitude: parsed.longitude, accuracy: parsed.accuracy,
          deviceId, ipAddress: ip, photo: fotoPath,
          metadata: { distance: gps.distance, photoTakenAt: parsed.takenAt },
        },
      });

      await tx.employeeLocation.create({
        data: { employeeId: auth.employeeId!, latitude: parsed.latitude, longitude: parsed.longitude, accuracy: parsed.accuracy, capturedAt: now },
      });

      return att;
    });
  } catch (e) {
    // DB gagal → jangan sampai file foto jadi yatim di disk.
    await deleteFoto(fotoPath);
    throw e;
  }

  await audit({ userId: auth.id, action: "CREATE", entityType: "attendance", entityId: attendance.id, newValue: { checkIn: now, status: hasil.status, distance: gps.distance }, ipAddress: ip }).catch(() => {});
  const payload = webhookPayloadAttendance({ id: attendance.id, employeeId: auth.employeeId ?? "", date: new Date(hariIni), status: hasil.status, checkIn: now, checkOut: null });
  kirimWebhook("attendance.created", payload);

  return Response.json({ ok: true, attendance: { id: attendance.id, checkIn: attendance.checkIn, status: hasil.status, lateMinutes: hasil.lateMinutes, jarak: gps.distance } });
}
