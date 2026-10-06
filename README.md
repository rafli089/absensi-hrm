# Absensi & HR

Aplikasi absensi karyawan + HR: check-in/out berbasis GPS, shift, payroll, slip gaji,
cuti, lembur, dan ganti kata sandi (karyawan lewat approval atasan).

Next.js 15 (App Router) · Prisma · PostgreSQL · TypeScript · Tailwind v4

## Menjalankan (dev)

```bash
cp .env.example .env          # isi SESSION_SECRET bila perlu
docker compose up -d          # postgres di localhost:5433
npm install
npx prisma migrate deploy
npm run db:seed               # akun demo, semua password: password123
npm run dev                   # http://localhost:3000
```

Prerequisite: Node 20+ dan Docker Desktop.

### Akun demo

| Role | Email | Password |
|---|---|---|
| `SUPER_ADMIN` | super@kantor.id | password123 |
| `ADMIN` | oka@kantor.id | password123 |
| `HR` | rina@kantor.id | password123 |
| `SUPERVISOR` | andi@kantor.id | password123 |
| `EMPLOYEE` | sari / budi / dewi `@kantor.id` | password123 |

`db:seed` me-reset `passwordHash` ke `password123` dan menolak jalan kalau
`NODE_ENV=production` — jangan jalankan di produksi.

## Script

| Command | Fungsi |
|---|---|
| `npm run dev` | Dev server (turbopack) |
| `npm run build` / `npm start` | Build & jalankan produksi |
| `npm test` | Unit test (`tsx --test tests/*.test.ts`) |
| `npm run test:e2e` | E2E API (butuh dev server jalan di :3000) |
| `npm run lint` | ESLint |
| `npx prisma migrate dev` | Buat migration baru saat schema berubah |
| `npm run db:seed` | Reset data demo |

## Ganti kata sandi

Halaman `/akun`.

- `SUPERVISOR` / `HR` / `ADMIN` / `SUPER_ADMIN` — langsung aktif.
- `EMPLOYEE` — masuk daftar tunggu, perlu disetujui atasan/HR/admin. Password baru
  tidak aktif sebelum disetujui.

Endpoint: `POST /api/auth/password`, `GET /api/auth/password/requests`,
`PATCH /api/auth/password/requests/[id]` (`{ keputusan, catatan? }`).

## Lainnya

- `README2.md` — design system (Apple OS aesthetic, token warna, tipografi).
- `PRD.md` — spesifikasi produk.
- `README_CI_CD.md` — pipeline.
- `middleware.ts` guard route; `lib/auth/permissions.ts` definisi permission per role.

## Batasan produksi

Rate-limit login disimpan in-memory per proses, jadi saat aplikasi dijalankan
lebih dari satu replica (atau di serverless), batas percobaan bisa dilewati
karena tiap proses punya hitungan sendiri. Pakai Redis (`REDIS_URL`) kalau
deploy > 1 instance.

Foto absensi disimpan di `public/uploads/` — folder ini tidak di-track git
(data runtime). Kalau butuh Scaling horizontal, pindahkan ke object storage
(S3 presigned) dan simpan path-nya di DB.