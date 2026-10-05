import { getSessionUser, clientIp } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { headers } from "next/headers";
import { audit } from "@/lib/audit";
import { ambilLaporan, keCsv, ringkas, type FilterLaporan } from "@/lib/laporan/rekap";
import { AppError, toResponse, UnauthorizedError, ForbiddenError } from "@/lib/error";

/**
 * Export CSV rekap absensi (PRD §16).
 *
 * GET dengan query params:
 *   ?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&departemen=id&employeeId=id&status=ABSENT&format=csv
 *
 * format=csv wajib (mencegah CSRF via <img>). Content-Type
 * application/vnd.ms-excel agar Excel membukanya langsung.
 * BOM UTF-8 di kepala file supaya Excel Windows tidak rusak.
 *
 * browser print (`window.print()`) menghasilkan PDF. Server-side PDF
 * dimigrasi bila butuh (ponytail).
 */

export async function GET(req: Request) {
  // REPORT_GENERATE = semua data; TEAM_REPORT = data departemen sendiri.
  // scope(data) dipakai halaman /laporan dan route ini, jadi satu sumber.
  const user = await getSessionUser();
  if (!user) return toResponse(new UnauthorizedError());
  const supervise = can(user.role, PERMISSIONS.REPORT_GENERATE) || can(user.role, PERMISSIONS.TEAM_REPORT);
  if (!supervise) return toResponse(new ForbiddenError());
  const hanyaTim = !can(user.role, PERMISSIONS.REPORT_GENERATE);
  if (hanyaTim && !user.departmentId) return toResponse(new ForbiddenError("Akun belum terhubung ke departemen."));
  const auth = user;

  const url = new URL(req.url);
  const f: FilterLaporan = {
    dari: url.searchParams.get("dari") ?? "",
    sampai: url.searchParams.get("sampai") ?? "",
    // Supervisor: abaikan param departemen/karyawan dari URL — kunci ke tim sendiri.
    departemen: hanyaTim ? user.departmentId! : url.searchParams.get("departemen") ?? undefined,
    employeeId: hanyaTim ? undefined : url.searchParams.get("employeeId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  };

  if (!f.dari || !f.sampai) {
    return toResponse(new AppError("?dari=YYYY-MM-DD dan ?sampai=YYYY-MM-DD wajib.", "PARAM_WAJIB", 400));
  }

  const format = url.searchParams.get("format");
  if (format !== "csv") {
    return toResponse(new AppError("?format=csv wajib.", "FORMAT_WAJIB", 400));
  }

  const baris = await ambilLaporan(f);
  const ringkasan = ringkas(baris);
  const csv = keCsv(baris, ringkasan, f, `${auth.id} (${auth.role})`);

  await audit({
    userId: auth.id,
    action: "EXPORT",
    entityType: "report",
    entityId: `attendance-${f.dari}-${f.sampai}`,
    newValue: { format: "csv", filter: f, baris: baris.length },
    ipAddress: clientIp(await headers()),
  }).catch(() => {});

  // Kirim sebagai byte, bukan string: Next bisa mengubah encoding body
  // sehingga BOM UTF-8 hilang kalau dikirim mentah.
  return new Response(new TextEncoder().encode(csv), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekap-absensi-${f.dari}-${f.sampai}.csv"`,
    },
  });
}
