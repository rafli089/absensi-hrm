# Catatan CI/CD

## Workflow

| File | Trigger | Isi |
|---|---|---|
| `.github/workflows/ci.yml` | push + PR ke `main` | `build` (prisma generate + `next build`), `test` (migrate deploy + seed + `npm test`) dengan service Postgres 16, `lint` |
| `.github/workflows/e2e.yml` | push ke `main` / manual | build → `next start` → curl `/api/health` → `npm run test:e2e` |

Ketiga job `ci.yml` saling dependensi: `test` butuh `build` sukses. `lint`
berdiri sendiri supaya lint error langsung kelihatan tanpa menunggu test.

## Kenapa Postgres 16 di services, bukan docker-compose

GitHub runner sudah punya Docker, tapi `services:` lebih sederhana: container
dibuat, healthcheck jalan, lalu mati otomatis. Tanpa file compose yang harus
di-maintain. Local dev tetap pakai `docker-compose.yml` yang disertakan.

## Port 5433, bukan 5432

Sesuai `.env.example` dan Docker Compose local. Jangan diubah — prisma
migration kalau salah port akan gagal diam-diam lalu test gagal di tengah.

## Kenapa `prisma migrate deploy` bukan `migrate dev`

`migrate dev` bisa menulis ulang migration kalau schema drift. Di CI tidak
perlu — pakai `deploy` yang hanya menerapkan migration yang sudah committed.

## Environment variables di CI

Disediakan langsung di `env:` workflow, bukan repo secrets, karena value-nya
dummy (bukan rahasia nyata). Kalau nanti ada deploy ke staging/production,
`SESSION_SECRET` dan `DATABASE_URL` wajib pindah ke repository secrets.

## Local

```bash
docker compose up -d postgres   # Postgres di :5433
npx prisma migrate dev
npm run db:seed
npm run build                   # jangan `npm run dev` — beda cache .next
npm test
npm run start &                 # prod server, dibutuhkan e2e
npm run test:e2e
```
