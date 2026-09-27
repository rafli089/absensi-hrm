import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { headers } from "next/headers";
import { audit } from "@/lib/audit";
import {
  hitungPayroll,
  hitungHourlyRate,
  hitungDailyRate,
  type ComponentInput,
  type AttendanceSummary,
} from "@/lib/payroll/hitung";

/**
 * Jalankan kalkulasi payroll untuk periode tertentu.
 * POST /api/payroll/calculate
 * body: { periodStart: "2026-01-01", periodEnd: "2026-01-31", employeeIds?: string[] }
 *
 * Alur:
 * 1. Ambil semua karyawan aktif (atau yang di-filter employeeIds)
 * 2. Untuk tiap karyawan:
 *    - Ambil salary_structure aktif di periode itu
 *    - Ambil salary_component aktif (untuk components engine)
 *    - Ringkas attendance di periode: workDays, lateMinutes, absentDays, overtimeMinutes
 *    - Jalankan hitungPayroll()
 *    - Upsert Payroll + PayrollItem
 * 3. Return summary
 *
 * Guard lock: payroll yang sudah REVIEWED/APPROVED/PAID/LOCKED tidak bisa di-
 * overwrite. Hanya DRAFT dan CALCULATED yang boleh dihitung ulang.
 */

const bodyCalc = z.object({
  periodStart: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Tanggal mulai tidak valid."),
  periodEnd: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Tanggal selesai tidak valid."),
  employeeIds: z.array(z.string().min(1)).optional(),
});

export async function POST(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.PAYROLL_MANAGE);
  if (auth instanceof Response) return auth;

  let parsed;
  try {
    parsed = bodyCalc.parse(await req.json());
  } catch (e) {
    const pesan = e instanceof z.ZodError ? (e.issues[0]?.message ?? "Format tidak valid.") : "Format tidak valid.";
    return Response.json({ error: pesan }, { status: 400 });
  }

  // Kolom @db.Date menyimpan bagian tanggal UTC. new Date("YYYY-MM-DD") sudah
  // UTC midnight, jadi JANGAN panggil setHours (lokal) — di UTC+7 itu mundur
  // satu hari. Bandingkan sebagai string YYYY-MM-DD agar bebas timezone.
  const periodStart = new Date(parsed.periodStart + "T00:00:00.000Z");
  const periodEnd = new Date(parsed.periodEnd + "T00:00:00.000Z");

  if (periodEnd < periodStart) {
    return Response.json({ error: "Periode selesai harus setelah periode mulai." }, { status: 400 });
  }

  // Komponen gaji aktif
  const components = await prisma.salaryComponent.findMany({
    where: { status: "ACTIVE" },
    select: { name: true, type: true, calculationMethod: true, amount: true, percentValue: true, isTaxable: true, isDeduction: true },
  });
  const compMap = new Map(
    components.map((c) => [
      c.name,
      {
        name: c.name,
        type: c.type,
        calculationMethod: c.calculationMethod,
        amount: Number(c.amount),
        percentValue: c.percentValue ? Number(c.percentValue) : null,
        isTaxable: c.isTaxable,
        isDeduction: c.isDeduction,
      } satisfies ComponentInput,
    ]),
  );

  // Karyawan target
  const whereEmp: Record<string, unknown> = { isActive: true };
  if (parsed.employeeIds?.length) whereEmp.id = { in: parsed.employeeIds };
  const karyawan = await prisma.employee.findMany({
    where: whereEmp,
    select: { id: true, employeeCode: true, fullName: true },
  });

  if (karyawan.length === 0) {
    return Response.json({ error: "Tidak ada karyawan yang diproses." }, { status: 400 });
  }

  // Salary structure per karyawan (aktif di periode)
  const structures = await prisma.salaryStructure.findMany({
    where: {
      employeeId: { in: karyawan.map((k) => k.id) },
      effectiveFrom: { lte: periodEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  const structByEmp = new Map<string, { basicSalary: number }>();
  for (const s of structures) {
    if (!structByEmp.has(s.employeeId)) {
      structByEmp.set(s.employeeId, { basicSalary: Number(s.basicSalary) });
    }
  }

  // Attendance di periode
  const attendance = await prisma.attendance.findMany({
    where: { employeeId: { in: karyawan.map((k) => k.id) }, date: { gte: periodStart, lte: periodEnd } },
    select: { employeeId: true, date: true, lateMinutes: true, overtimeMinutes: true, status: true, workMinutes: true },
  });

  // Ringkas per karyawan
  const summaryByEmp = new Map<string, AttendanceSummary>();
  for (const a of attendance) {
    const s = summaryByEmp.get(a.employeeId) ?? { workDays: 0, lateMinutes: 0, absentDays: 0, overtimeMinutes: 0, leaveDays: 0 };
    if (a.status === "PRESENT" || a.status === "LATE") s.workDays++;
    else if (a.status === "ABSENT") s.absentDays++;
    else if (a.status === "LEAVE") s.leaveDays++;
    s.lateMinutes += a.lateMinutes ?? 0;
    s.overtimeMinutes += a.overtimeMinutes ?? 0;
    summaryByEmp.set(a.employeeId, s);
  }

  const results: { employeeId: string; employeeCode: string; fullName: string; status: string; netSalary: number }[] = [];
  const errors: { employeeCode: string; reason: string }[] = [];

  for (const k of karyawan) {
    const struct = structByEmp.get(k.id);
    if (!struct) {
      errors.push({ employeeCode: k.employeeCode, reason: "Tidak ada struktur gaji aktif di periode." });
      continue;
    }
    const summary = summaryByEmp.get(k.id) ?? { workDays: 0, lateMinutes: 0, absentDays: 0, overtimeMinutes: 0, leaveDays: 0 };

    const hourly = hitungHourlyRate(struct.basicSalary);
    const daily = hitungDailyRate(struct.basicSalary);

    const hasil = hitungPayroll({
      basicSalary: struct.basicSalary,
      components: Array.from(compMap.values()),
      attendance: summary,
      hourlyRate: hourly,
      dailyRate: daily,
    });

    // Guard lock: payroll yang sudah REVIEWED/APPROVED/PAID/LOCKED tidak
    // boleh dihitung ulang — nilai historis yang sudah diverifikasi orang
    // harus tetap.
    const payrollLama = await prisma.payroll.findUnique({
      where: { employeeId_periodStart_periodEnd: { employeeId: k.id, periodStart, periodEnd } },
      select: { id: true, status: true },
    });

    if (payrollLama && !["DRAFT", "CALCULATED"].includes(payrollLama.status)) {
      errors.push({ employeeCode: k.employeeCode, reason: `Payroll sudah berstatus ${payrollLama.status} — tidak bisa dihitung ulang.` });
      continue;
    }

    const payrollBaru = {
      basicSalary: hasil.basicSalary,
      totalAllowance: hasil.totalAllowance,
      totalOvertime: hasil.totalOvertime,
      totalBonus: hasil.totalBonus,
      totalDeduction: hasil.totalDeduction,
      tax: hasil.tax,
      netSalary: hasil.netSalary,
      workDays: summary.workDays,
      lateMinutes: summary.lateMinutes,
      absentDays: summary.absentDays,
      status: "CALCULATED" as const,
    };

    // Upsert payroll
    const payroll = payrollLama
      ? await prisma.payroll.update({ where: { id: payrollLama.id }, data: payrollBaru })
      : await prisma.payroll.create({ data: { employeeId: k.id, periodStart, periodEnd, ...payrollBaru } });

    // Payroll items
    await prisma.payrollItem.deleteMany({ where: { payrollId: payroll.id } });
    if (hasil.items.length) {
      await prisma.payrollItem.createMany({
        data: hasil.items.map((it) => ({
          payrollId: payroll.id,
          name: it.name,
          amount: it.amount,
          note: it.note ?? null,
        })),
      });
    }

    results.push({
      employeeId: k.id,
      employeeCode: k.employeeCode,
      fullName: k.fullName,
      status: "CALCULATED",
      netSalary: hasil.netSalary,
    });
  }

  await audit({
    userId: auth.id,
    action: "CREATE",
    entityType: "payroll",
    entityId: `batch-${periodStart.toISOString().slice(0, 10)}`,
    newValue: { period: `${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`, count: results.length },
    ipAddress: clientIp(await headers()),
  }).catch(() => {});

  return Response.json({ ok: true, periodStart: periodStart.toISOString().slice(0, 10), periodEnd: periodEnd.toISOString().slice(0, 10), diproses: results.length, gagal: errors.length, hasil: results, error: errors });
}