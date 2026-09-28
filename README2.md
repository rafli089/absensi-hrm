# Design System — Absensi HR (Apple OS Aesthetic)

## Warna — Palet Sistem Apple

| Token | Nama | Warna | Arus |
|-------|------|-------|------|
| `bg` | Background utama | \#f5f5f7 | warna Mac desktop |
| `surface` | Kartu, modal, form | \#ffffff | putih bersih |
| `ink` | Teks utama | \#1d1d1f | hampir hitam, kontras tinggi |
| `ink-2` | Teks sekunder | \#6e6e73 | Abu-abu biru Apple |
| `border` | Batas halus | \#8e8e93 | Apple separator |
| `brand` | Aksen utama | \#007aff | systemBlue Apple |
| `ok` | Sukses/status positif | \#34c759 | systemGreen Apple |
| `warn` | Peringatan | \#ff9500 | systemOrange Apple |
| `danger` | Error/danger | \#ff3b30 | systemRed Apple |
| `sidebar-active` | Sidebar item aktif | \#ebebef | sedikit lebih gelap dari bg |

### Teks di atas warna terang — kontras di bawah 4.5:1

Warna system Apple terlalu terang untuk teks 12px — buat label status, gunakan varian gelap:

- `--brand-hover`: \#0066d4 (bayangan 15% lebih gelap)
- `--ok-ink`: \#1c7c3a (text untuk badge success)
- `--warn-ink`: \#9a5b00
- `--danger-ink`: \#d1261e
- `--info-ink`: \#0059b3

## Tipografi

- **Famili**: Inter via `next/font` — alias untuk system sans-serif Apple (`ui-sans-serif`)
- **Skala utama**: 14px → 15px body (lebih besar dari default Tailwind `text-sm`)
- **Radius**: Sm 8px, Md 12px, Lg 20px, Xl 24px
- **Focus ring**: 3px ring brand, padding 2px

## Struktur Visual

### Card
Tidak ada border. Hanya `shadow-sm` (0 1px 2px rgba(0,0,0,0.05)) dan radius 16px. Ini memberi kesan kartu "mengapung" di atas latar belakang, seperti di Control Center macOS.

### Sidebar
- Translucent dengan `backdrop-blur-[20px]`
- Border kanan `rgba(0,0,0,0.08)` sebagai separator halus
- Item aktif: background \#ebebef, font medium
- Item tidak aktif: teks \#6e6e73, hover \`#f5f5f7/30%\`

### Input / Select
- Tinggi: 40px (h-10)
- Padding: 12px horizontal
- Border: 1px rgba(0,0,0,0.12) — tidak solid, memberi kesan "outlined" yang halus
- Fokus: border brand + ring 3px

### Dialog / Sheet
- Membuka dengan backdrop blur 6px
- Konten: `backdrop-saturate-150` + `color-mix(in_srgb, var(--surface) 88%, transparent)`
- Ini memberi efek "material you" yang mirip dengan sheet di iOS/macOS

## Prinsip

1. **Tidak ada border pada card** — Apple mengandalkan bayangan dan perbedaan warna latar/muka
2. **Tidak ada uppercase** — semua label pakai sentence case
3. **Warna sistem, bukan Tailwind** — menggunakan Apple System Colors sebagai referensi
4. **Material translucency** — sidebar, dialog, dan sheet pakai blur backdrop
5. **Ripple sedikit pada aktif** — scale-[0.98] pada tombol, bukan animate complex

## File utama

- `app/tokens.css` — variabel CSS utama
- `app/globals.css` — Tailwind directives + utility layer
- `components/ui/*.tsx` — komponen bawaan (Card, Button, Badge, Table, Input, Dialog, Sheet)