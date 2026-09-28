import { prisma } from "@/lib/db";

/**
 * Liveness probe: cek DB + keluar JSON. Dipakai CI/CD (`npm run test:e2e`
 * curl /api/health sebelum run) dan daftar route publik di middleware.
 *
 * ponytail: dalam praktik liveness di K8s cukup "proses hidup" tanpa sentuh
 * DB — probe ini sekaligus readiness karena app hanya punya satu dependensi
 * (Postgres). Pisahkan kalau nanti ada Redis/queue yang ikut dicek.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "ok", ts: Date.now() });
  } catch {
    return Response.json({ status: "degraded", db: "error", ts: Date.now() }, { status: 503 });
  }
}