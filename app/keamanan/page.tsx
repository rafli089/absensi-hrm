import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";

export const metadata = { title: "Keamanan" };

export default async function KeamananPage() {
  const user = await requireUser();
  if (!can(user.role, PERMISSIONS.SECURITY_VIEW)) {
    return (
      <AppShell user={user} maxWidth="max-w-[1100px]">
        <p className="text-sm text-[var(--ink-2)]">Anda tidak memiliki akses ke halaman ini.</p>
      </AppShell>
    );
  }

  const events = await prisma.securityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      employee: { select: { fullName: true, employeeCode: true } },
    },
  });

  const belum = events.filter((e) => !e.resolvedAt).length;

  return (
    <AppShell user={user} maxWidth="max-w-[1100px]" className="space-y-6">
      <header>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Keamanan</h1>
        <p className="text-[15px] text-[var(--ink-2)]">
          {belum > 0 ? `${belum} peristiwa belum ditangani` : "Tidak ada peristiwa yang belum ditangani"}
        </p>
      </header>

      <Card>
        <CardContent className="pt-5">
          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <ShieldAlert className="size-10 text-[var(--ink-2)]/40" aria-hidden />
              <p className="text-[13px] text-[var(--ink-2)]">Belum ada peristiwa keamanan.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Keparahan</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap font-mono">
                      {new Date(e.createdAt).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[12px]">{e.eventType}</TableCell>
                    <TableCell>
                      <Badge tone={e.severity === "CRITICAL" ? "danger" : e.severity === "HIGH" ? "danger" : e.severity === "MEDIUM" ? "warning" : "neutral"}>
                        {e.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {e.employee ? (
                        <>
                          <span className="font-medium">{e.employee.employeeCode}</span>{" "}
                          <span className="text-[var(--ink-2)]">{e.employee.fullName}</span>
                        </>
                      ) : (
                        <span className="text-[var(--ink-2)]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-[var(--ink-2)]" title={e.description}>
                      {e.description}
                    </TableCell>
                    <TableCell>
                      <Badge tone={e.resolvedAt ? "success" : "warning"}>
                        {e.resolvedAt ? "Selesai" : "Terbuka"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
