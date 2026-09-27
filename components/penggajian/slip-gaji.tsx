const rupiah = (n: string | number) => "Rp " + Number(n).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const tanggalPanjang = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

const tgl = (iso: string) => iso.slice(0, 10);

export type SlipData = {
  id: string;
  periodStart: string;
  periodEnd: string;
  basicSalary: string;
  totalAllowance: string;
  totalOvertime: string;
  totalBonus: string;
  totalDeduction: string;
  tax: string;
  netSalary: string;
  workDays: number;
  lateMinutes: number;
  absentDays: number;
  status: string;
  approvedByName: string | null;
  approvedAt: string | null;
  employee: {
    id: string;
    employeeCode: string;
    fullName: string;
    department: { name: string } | null;
    position: { name: string } | null;
    bankName: string | null;
    bankAccount: string | null;
  };
  items: { id: string; name: string; amount: string; note: string | null }[];
};

import { TombolCetak } from "./tombol-cetak";

export function SlipGaji({
  payroll,
  kantor,
}: {
  payroll: SlipData;
  kantor: { name: string; address: string | null } | null;
}) {
  const e = payroll.employee;
  const [, bulan] = new Date(payroll.periodStart).toLocaleDateString("id-ID", { month: "long", year: "numeric" }).split(" ");

  return (
    <div className="min-h-screen bg-[var(--bg)] py-8 print:bg-white print:py-0">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 print:max-w-none print:px-0">
        <div className="flex justify-end print:hidden">
          <TombolCetak />
        </div>

        <article className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6 print:rounded-none print:border-0 print:bg-white print:p-0">
          <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4 print:border-[#999]">
            <div>
              <h1 className="text-[18px] font-semibold tracking-[-0.01em]">{kantor?.name ?? "Perusahaan"}</h1>
              {kantor?.address && <p className="text-[12px] text-[var(--ink-2)]">{kantor.address}</p>}
            </div>
            <div className="text-right">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-2)]">Slip Gaji</p>
              <p className="text-[12px] text-[var(--ink-2)]">Periode {bulan}</p>
              <p className="font-mono text-[11px] text-[var(--ink-2)]">
                {tgl(payroll.periodStart)} &ndash; {tgl(payroll.periodEnd)}
              </p>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-[var(--border)] py-4 text-[13px] print:border-[#999] sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase text-[var(--ink-2)]">Nama</p>
              <p className="font-medium">{e.fullName}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[var(--ink-2)]">Kode</p>
              <p className="font-mono font-medium">{e.employeeCode}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[var(--ink-2)]">Jabatan</p>
              <p className="font-medium">{e.position?.name ?? "-"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[var(--ink-2)]">Departemen</p>
              <p className="font-medium">{e.department?.name ?? "-"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[var(--ink-2)]">Hari kerja</p>
              <p className="font-medium">{payroll.workDays}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[var(--ink-2)]">Terlambat</p>
              <p className="font-medium">
                {payroll.lateMinutes} menit{payroll.absentDays > 0 ? ` · ${payroll.absentDays} alpa` : ""}
              </p>
            </div>
          </section>

          <section className="py-4">
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-2)]">
              Rincian
            </h2>
            <table className="w-full text-[13px]">
              <tbody>
                <tr className="border-b border-[var(--border)] print:border-[#ccc]">
                  <td className="py-1.5 font-medium">Gaji Pokok</td>
                  <td className="py-1.5 text-right font-mono">{rupiah(payroll.basicSalary)}</td>
                </tr>
                {payroll.items.map((it) => {
                  const n = Number(it.amount);
                  return (
                    <tr key={it.id} className="border-b border-[var(--border)] print:border-[#eee]">
                      <td className="py-1.5">
                        {it.name}
                        {it.note && <span className="block text-[11px] text-[var(--ink-2)]">{it.note}</span>}
                      </td>
                      <td className={"py-1.5 text-right font-mono " + (n < 0 ? "text-[#b42318]" : "")}>{rupiah(n)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-b border-[var(--border)] print:border-[#999]">
                  <td className="py-1.5 font-medium">Total Pendapatan</td>
                  <td className="py-1.5 text-right font-mono font-medium">
                    {rupiah(
                      Number(payroll.basicSalary) +
                        Number(payroll.totalAllowance) +
                        Number(payroll.totalOvertime) +
                        Number(payroll.totalBonus),
                    )}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)] print:border-[#999]">
                  <td className="py-1.5 font-medium">Total Potongan</td>
                  <td className="py-1.5 text-right font-mono font-medium text-[#b42318]">
                    {rupiah("-" + (Number(payroll.totalDeduction) + Number(payroll.tax)))}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-[15px] font-semibold">Gaji Bersih (Take Home Pay)</td>
                  <td className="py-2 text-right font-mono text-[15px] font-semibold">{rupiah(payroll.netSalary)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <footer className="flex items-end justify-between gap-6 border-t border-[var(--border)] pt-4 text-[12px] print:border-[#999]">
            {e.bankName || e.bankAccount ? (
              <div>
                <p className="text-[11px] uppercase text-[var(--ink-2)]">Ditransfer ke</p>
                <p className="font-medium">
                  {e.bankName ?? "-"} {e.bankAccount ?? ""}
                </p>
              </div>
            ) : (
              <div />
            )}
            <div className="text-center">
              <p className="text-[var(--ink-2)]">{kantor?.name ?? "Perusahaan"}, {tanggalPanjang(new Date().toISOString())}</p>
              {payroll.approvedByName ? (
                <>
                  <p className="mt-10 font-medium">{payroll.approvedByName}</p>
                  <p className="text-[11px] text-[var(--ink-2)]">
                    Disetujui {tanggalPanjang(payroll.approvedAt ?? new Date().toISOString())}
                  </p>
                </>
              ) : (
                <p className="mt-10 font-medium">HRD / Manager</p>
              )}
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
