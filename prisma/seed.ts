import { PrismaClient, Role, EmploymentStatus, ComponentType, CalculationMethod } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

/** Seed data: satu kantor, 5 role, shift, komponen gaji, karyawan demo.
 *  Jalankan: `npm run db:seed`. Idempoten — pakai upsert, aman dijalankan berkali-kali. */
async function main() {
  const hash = (p: string) => hashSync(p, 10);

  await prisma.office.upsert({
    where: { id: "kantor-pusat" },
    update: {},
    create: {
      id: "kantor-pusat",
      name: "Kantor Pusat",
      address: "Jl. Sudirman No. 1, Jakarta Selatan",
      latitude: -6.2088,
      longitude: 106.8456,
      radius: 150, // meter
      isActive: true,
    },
  });

  const depEng = await prisma.department.upsert({
    where: { name: "Engineering" },
    update: {},
    create: { name: "Engineering", description: "Pengembangan produk" },
  });

  const depHr = await prisma.department.upsert({
    where: { name: "Human Resources" },
    update: {},
    create: { name: "Human Resources", description: "SDM & kesejahteraan karyawan" },
  });

  const posDev = await prisma.position.upsert({
    where: { name_departmentId: { name: "Software Engineer", departmentId: depEng.id } },
    update: {},
    create: { name: "Software Engineer", departmentId: depEng.id },
  });

  const posHr = await prisma.position.upsert({
    where: { name_departmentId: { name: "HR Manager", departmentId: depHr.id } },
    update: {},
    create: { name: "HR Manager", departmentId: depHr.id },
  });

  const shiftPagi = await prisma.shift.upsert({
    where: { name: "Shift Pagi" },
    update: {},
    create: {
      name: "Shift Pagi",
      type: "FIXED",
      startTime: "09:00",
      endTime: "18:00",
      breakStart: "12:00",
      breakEnd: "13:00",
      gracePeriod: 10, // PRD §6.7: shift 09:00, grace 10 menit
    },
  });

  await prisma.shift.upsert({
    where: { name: "Shift Malam" },
    update: {},
    create: {
      name: "Shift Malam",
      type: "OVERNIGHT",
      startTime: "22:00",
      endTime: "07:00",
      gracePeriod: 15,
      isOvernight: true,
    },
  });

  type Akun = {
    code: string;
    nama: string;
    email: string;
    username: string;
    role: Role;
    dep: string;
    pos: string;
    gaji: number;
  };

  const akun: Akun[] = [
    { code: "EMP-001", nama: "Sari Wijaya", email: "sari@kantor.id", username: "sari", role: Role.EMPLOYEE, dep: depEng.id, pos: posDev.id, gaji: 12_000_000 },
    { code: "EMP-002", nama: "Budi Santoso", email: "budi@kantor.id", username: "budi", role: Role.EMPLOYEE, dep: depEng.id, pos: posDev.id, gaji: 15_000_000 },
    { code: "EMP-003", nama: "Dewi Lestari", email: "dewi@kantor.id", username: "dewi", role: Role.EMPLOYEE, dep: depHr.id, pos: posHr.id, gaji: 14_000_000 },
    { code: "EMP-004", nama: "Andi Pratama", email: "andi@kantor.id", username: "andi", role: Role.SUPERVISOR, dep: depEng.id, pos: posDev.id, gaji: 18_000_000 },
    { code: "EMP-005", nama: "Rina Kartika", email: "rina@kantor.id", username: "rina", role: Role.HR, dep: depHr.id, pos: posHr.id, gaji: 16_000_000 },
    { code: "EMP-006", nama: "Oka Saputra", email: "oka@kantor.id", username: "oka", role: Role.ADMIN, dep: depEng.id, pos: posDev.id, gaji: 17_000_000 },
    { code: "EMP-007", nama: "Sistem Super", email: "super@kantor.id", username: "super", role: Role.SUPER_ADMIN, dep: depEng.id, pos: posDev.id, gaji: 25_000_000 },
  ];

  for (const a of akun) {
    const emp = await prisma.employee.upsert({
      where: { employeeCode: a.code },
      update: { fullName: a.nama, email: a.email, departmentId: a.dep, positionId: a.pos },
      create: {
        employeeCode: a.code,
        fullName: a.nama,
        email: a.email,
        departmentId: a.dep,
        positionId: a.pos,
        employmentStatus: EmploymentStatus.PERMANENT,
        joinDate: new Date("2024-01-15"),
      },
    });

    await prisma.user.upsert({
      where: { email: a.email },
      update: { role: a.role },
      create: {
        email: a.email,
        username: a.username,
        passwordHash: hash("password123"),
        role: a.role,
        employeeId: emp.id,
      },
    });

    await prisma.salaryStructure.upsert({
      where: { id: `${emp.id}-gaji-awal` },
      update: {},
      create: {
        id: `${emp.id}-gaji-awal`,
        employeeId: emp.id,
        basicSalary: a.gaji,
        effectiveFrom: new Date("2024-01-15"),
      },
    });

    await prisma.employeeShift.upsert({
      where: { employeeId_date: { employeeId: emp.id, date: new Date(new Date().setHours(0, 0, 0, 0)) } },
      update: {},
      create: { employeeId: emp.id, shiftId: shiftPagi.id, date: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
  }

  const komponen = [
    { name: "Tunjangan Transport", type: ComponentType.ALLOWANCE, method: CalculationMethod.FIXED, amount: 800000, deduction: false },
    { name: "Tunjangan Makan", type: ComponentType.ALLOWANCE, method: CalculationMethod.FIXED, amount: 500000, deduction: false },
    { name: "Bonus Kinerja", type: ComponentType.BONUS, method: CalculationMethod.FIXED, amount: 0, deduction: false },
    { name: "Potongan Terlambat", type: ComponentType.DEDUCTION, method: CalculationMethod.FIXED, amount: 0, deduction: true },
    { name: "Potongan Ketidakhadiran", type: ComponentType.DEDUCTION, method: CalculationMethod.FIXED, amount: 0, deduction: true },
    { name: "BPJS Kesehatan", type: ComponentType.BPJS, method: CalculationMethod.PERCENT_OF_BASIC, amount: 1, percentValue: 1, deduction: true },
    { name: "BPJS Ketenagakerjaan", type: ComponentType.BPJS, method: CalculationMethod.PERCENT_OF_BASIC, amount: 2, percentValue: 2, deduction: true },
    { name: "Pajak Penghasilan", type: ComponentType.TAX, method: CalculationMethod.FIXED, amount: 0, deduction: true },
  ];

  for (const c of komponen) {
    await prisma.salaryComponent.upsert({
      where: { id: c.name.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: {
        id: c.name.toLowerCase().replace(/\s+/g, "-"),
        name: c.name,
        type: c.type,
        calculationMethod: c.method,
        amount: c.amount,
        percentValue: c.percentValue ?? null,
        isDeduction: c.deduction,
        status: "ACTIVE",
      },
    });
  }

  console.log("Seed selesai.");
  console.log("Login (semua password: password123):");
  for (const a of akun) console.log(`  ${a.role.padEnd(13)} ${a.username.padEnd(8)} ${a.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
