import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Clock } from "lucide-react";
import { UbahPassword } from "@/components/akun/ubah-password";
import { PutuskanPassword } from "@/components/akun/putuskan-password";

export const metadata = { title: "Akun" };

const STATUS_PW: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  PENDING: { label: "Menunggu", tone: "warning" },
  APPROVED: { label: "Disetujui", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "danger" },
};

export default async function AkunPage() {
  const user = await requireUser();
  const bolehPutuskan = can(user.role, PERMISSIONS.PASSWORD_APPROVE);
  const isKaryawan = !bolehPutuskan;

  // Karyawan: riwayat pengajuan sendiri + status PENDING.
  // Approver: daftar PENDING yang harus diputuskan.
  const [riwayat, pendingApprover] = await Promise.all([
    isKaryawan
      ? prisma.passwordChangeRequest.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { decidedBy: { select: { email: true } } },
        })
      : Promise.resolve([]),
    bolehPutuskan
      ? prisma.passwordChangeRequest.findMany({
          where: { status: "PENDING" },
          include: { user: { select: { email: true, username: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const adaMenunggu = riwayat.find((r) => r.status === "PENDING");

  return (
    <AppShell user={user} maxWidth="max-w-[1000px]" className="space-y-6">
      <header>
        <h1 className="text-display font-semibold tracking-[-0.02em] text-[var(--ink)]">Akun</h1>
        <p className="text-body text-[var(--ink-2)]">
          {bolehPutuskan
            ? "Ulas pengajuan kata sandi karyawan."
            : "Atur kata sandi akun Anda."}
        </p>
      </header>

      {/* Karyawan: status pengajuan yang sedang menunggu */}
      {isKaryawan && adaMenunggu && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <Clock className="size-5 shrink-0 text-[var(--warn-ink)]" aria-hidden />
            <div className="flex-1">
              <p className="text-body font-medium text-[var(--ink)]">Pengajuan menunggu persetujuan</p>
              <p className="text-caption text-[var(--ink-2)]">
                Kata sandi Anda berubah setelah disetujui atasan. Pengajuan baru akan menggantikan yang lama.
              </p>
            </div>
            <Badge tone="warning">Menunggu</Badge>
          </CardContent>
        </Card>
      )}

      {/* Form ganti password — semua role */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
          <div className="flex items-center gap-3">
            <KeyRound className="size-5 shrink-0 text-[var(--ink-2)]" aria-hidden />
            <div>
              <p className="text-body font-medium text-[var(--ink)]">Kata sandi</p>
              <p className="text-caption text-[var(--ink-2)]">
                {bolehPutuskan
                  ? "Ubah kata sandi Anda sendiri."
                  : "Pengajuan perlu disetujui atasan."}
              </p>
            </div>
          </div>
          <UbahPassword menunggu={isKaryawan} />
        </CardContent>
      </Card>

      {/* Approver: daftar PENDING */}
      {bolehPutuskan && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-3 text-h3 font-semibold text-[var(--ink)]">
              Menunggu keputusan ({pendingApprover.length})
            </h2>
            {pendingApprover.length === 0 ? (
              <p className="text-caption text-[var(--ink-2)]">Tidak ada pengajuan yang menunggu.</p>
            ) : (
              <PutuskanPassword daftar={pendingApprover} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Karyawan: riwayat pengajuan */}
      {isKaryawan && riwayat.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-3 text-h3 font-semibold text-[var(--ink)]">Riwayat pengajuan</h2>
            <ul className="divide-y divide-[var(--border)]/60">
              {riwayat.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-body text-[var(--ink)]">{new Date(r.createdAt).toLocaleString("id-ID")}</p>
                    <p className="text-label text-[var(--ink-2)]">
                      {r.decidedAt ? `Diputuskan oleh ${r.decidedBy?.email ?? "atas"}` : "Belum diputuskan"}
                    </p>
                  </div>
                  <Badge tone={STATUS_PW[r.status].tone}>{STATUS_PW[r.status].label}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
