/**
 * Engine payroll — fungsi murni (PRD §6.13, §6.15, §25.7, §33).
 * Bukan hard-coded untuk satu perusahaan: nominal potongan & bonus datang dari
 * salary_components, sehingga tiap perusahaan punya konfigurasi sendiri.
 */

export type AttendanceSummary = {
  workDays: number;
  lateMinutes: number;
  absentDays: number;
  overtimeMinutes: number;
  leaveDays: number;
};

export type ComponentInput = {
  name: string;
  type: "ALLOWANCE" | "BONUS" | "DEDUCTION" | "TAX" | "BPJS";
  calculationMethod: "FIXED" | "PERCENT_OF_BASIC" | "PER_HOUR" | "PER_DAY";
  amount: number;
  percentValue: number | null;
  isTaxable: boolean;
  isDeduction: boolean;
};

export type HitungInput = {
  basicSalary: number;
  components: ComponentInput[];
  attendance: AttendanceSummary;
  hourlyRate: number; // basicSalary / jam kerja efektif per bulan
  dailyRate: number;
};

export type HitungResult = {
  basicSalary: number;
  totalAllowance: number;
  totalOvertime: number;
  totalBonus: number;
  totalDeduction: number;
  tax: number;
  netSalary: number;
  items: { name: string; type: string; amount: number; note?: string }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function hitungPayroll(input: HitungInput): HitungResult {
  const { basicSalary, components, attendance, hourlyRate, dailyRate } = input;

  const items: HitungResult["items"] = [];
  let totalAllowance = 0;
  let totalBonus = 0;
  let totalDeduction = 0;
  let tax = 0;

  const nilai = (c: ComponentInput): number =>
    c.calculationMethod === "PERCENT_OF_BASIC"
      ? ((c.percentValue ?? 0) / 100) * basicSalary
      : Number(c.amount);

  for (const c of components) {
    const amount = round2(nilai(c));

    // Potongan berbasis kehadiran (§6.13: late deduction, absence deduction).
    let effective = amount;
    let note: string | undefined;

    if (c.name === "Potongan Terlambat" && attendance.lateMinutes > 0) {
      effective = round2((attendance.lateMinutes / 60) * hourlyRate);
      note = `${attendance.lateMinutes} menit keterlambatan × ${round2(hourlyRate)}/jam`;
    } else if (c.name === "Potongan Ketidakhadiran" && attendance.absentDays > 0) {
      effective = round2(attendance.absentDays * dailyRate);
      note = `${attendance.absentDays} hari × ${round2(dailyRate)}/hari`;
    } else if (c.name === "Potongan Keterlambatan Bulanan" && attendance.lateMinutes === 0 && attendance.absentDays === 0) {
      continue; // komponen ada tapi kondisi tidak terpenuhi -> tidak dipotong
    }

    if (c.isDeduction) {
      totalDeduction = round2(totalDeduction + effective);
      items.push({ name: c.name, type: c.type, amount: -effective, note });
    } else if (c.type === "ALLOWANCE") {
      totalAllowance = round2(totalAllowance + effective);
      items.push({ name: c.name, type: c.type, amount: effective, note });
    } else if (c.type === "BONUS") {
      totalBonus = round2(totalBonus + effective);
      items.push({ name: c.name, type: c.type, amount: effective, note });
    } else {
      // TAX / BPJS selalu komponen potong
      totalDeduction = round2(totalDeduction + effective);
      items.push({ name: c.name, type: c.type, amount: -effective, note });
    }
  }

  // Overtime (§6.13)
  const overtimePay = round2((attendance.overtimeMinutes / 60) * hourlyRate * 1.5);
  if (attendance.overtimeMinutes > 0) {
    totalBonus = round2(totalBonus + overtimePay);
    items.push({
      name: "Lembur",
      type: "OVERTIME",
      amount: overtimePay,
      note: `${attendance.overtimeMinutes} menit × 1.5 × ${round2(hourlyRate)}/jam`,
    });
  }

  // Tax dihitung dari penghasilan kena pajak (§6.13).
  const taxableBase = round2(basicSalary + totalAllowance + totalBonus - totalDeduction);
  if (taxableBase > 0) {
    const brackets = [
      { upto: 60_000_000, rate: 0 },
      { upto: 250_000_000, rate: 0.15 },
      { upto: 500_000_000, rate: 0.25 },
      { upto: Infinity, rate: 0.3 },
    ];
    let remaining = taxableBase;
    let previous = 0;
    for (const b of brackets) {
      if (remaining <= 0) break;
      const span = b.upto - previous;
      const inBracket = Math.min(remaining, span);
      tax = round2(tax + inBracket * b.rate);
      remaining -= inBracket;
      previous = b.upto;
      if (b.rate === 0) continue;
    }
    if (tax > 0) items.push({ name: "Pajak Penghasilan", type: "TAX", amount: -tax });
  }

  const netSalary = round2(basicSalary + totalAllowance + totalBonus - totalDeduction - tax);

  return {
    basicSalary: round2(basicSalary),
    totalAllowance,
    totalOvertime: overtimePay,
    totalBonus,
    totalDeduction,
    tax,
    netSalary: netSalary < 0 ? 0 : netSalary,
    items,
  };
}

/** Jam kerja efektif per bulan untuk menghitung hourly rate. */
export const JAM_KERJA_EFEKTIF = 173; // 26 hari × ~6.65 jam
export const HARI_KERJA_EFEKTIF = 26;

export function hitungHourlyRate(basicSalary: number): number {
  return round2(basicSalary / JAM_KERJA_EFEKTIF);
}

export function hitungDailyRate(basicSalary: number): number {
  return round2(basicSalary / HARI_KERJA_EFEKTIF);
}
