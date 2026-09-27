import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { FormKantor } from "@/components/pengaturan/form-kantor";
import { requireUser } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/permissions";

export const metadata = { title: "Pengaturan Kantor" };

export default async function PengaturanKantorPage() {
  const user = await requireUser();

  if (!STAFF_ROLES.includes(user.role)) {
    return (
      <AppShell user={user} maxWidth="max-w-[700px]">
        <p className="text-sm text-[var(--ink-2)]">Hanya atasan/HR/admin yang boleh mengubah lokasi kantor.</p>
      </AppShell>
    );
  }

  return (
    <AppShell user={user} maxWidth="max-w-[700px]" className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Pengaturan Kantor</h1>
        <p className="text-[15px] text-[var(--ink-2)]">Koordinat &amp; radius untuk validasi GPS absensi</p>
      </header>

      <Card>
        <CardContent className="pt-5">
          <FormKantor />
        </CardContent>
      </Card>

      <div className="space-y-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--ink-2)]">
        <p className="font-medium text-[var(--ink)]">Catatan GPS</p>
        <ul className="list-inside list-disc space-y-2">
          <li>GPS harus aktif di browser/HP (izin lokasi).</li>
          <li>Akurasi GPS indoor (laptop) sering lebih dari 100m. <strong>Coba di HP atau dekat jendela.</strong></li>
          <li>Jika error &quot;Akurasi terlalu rendah&quot;: perbesar <code>GPS_MAX_ACCURACY_M</code> di <code>.env</code> atau gunakan HP.</li>
          <li>Radius default 150m — sesuaikan dengan ukuran area parkir/lobby.</li>
        </ul>
      </div>
    </AppShell>
  );
}