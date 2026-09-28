import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { headers } from "next/headers";
import { audit } from "@/lib/audit";
import { ambilLaporan, keCsv, ringkas, type FilterLaporan } from "@/lib/laporan/rekap";
import { AppError, toResponse } from "@/lib/error";

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
 * ponytail: export PDF belum dibuat karena tidak ada library PDF.
 * Print browser (`window.print()`) sudah menghasilkan PDF.
 * Kalau butuh PDF server-side, tambahkan `@react-pdf/renderer`
 * atau cetak ke layar lalu "Simpan sebagai PDF" browser.
 */

export async function GET(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.REPORT_GENERATE);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const f: FilterLaporan = {
    dari: url.searchParams.get("dari") ?? "",
    sampai: url.searchParams.get("sampai") ?? "",
    departemen: url.searchParams.get("departemen") ?? undefined,
    employeeId: url.searchParams.get("employeeId") ?? undefined,
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
