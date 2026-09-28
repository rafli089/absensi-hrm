import { test } from "node:test";
import assert from "node:assert/strict";
import { fotoAbsen } from "../lib/absensi/foto.ts";

const JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8P" +
  "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zN";

test("fotoAbsen menerima JPEG/PNG/WebP base64", () => {
  assert.ok(fotoAbsen.safeParse(JPEG).success);
  assert.ok(fotoAbsen.safeParse("data:image/png;base64,iVBORw0KGgo=").success);
  assert.ok(fotoAbsen.safeParse("data:image/webp;base64,UklGRhI=").success);
});

test("fotoAbsen menolak MIME dan payload non-gambar", () => {
  // HTML/JS yang disisipkan lewat kolom foto
  assert.ok(!fotoAbsen.safeParse("data:text/html;base64,PHNjcmlwdD4=").success);
  assert.ok(!fotoAbsen.safeParse("data:application/javascript;base64,YWxlcnQoMSk=").success);
  // SVG bisa menyimpan script — tidak diizinkan
  assert.ok(!fotoAbsen.safeParse("data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==").success);
  // Tanpa prefix data URL
  assert.ok(!fotoAbsen.safeParse("https://evil.example/x.jpg").success);
  // Base64 tak valid (karakter terlarang)
  assert.ok(!fotoAbsen.safeParse("data:image/jpeg;base64,<script>").success);
});

test("fotoAbsen menolak string kosong dan melebihi batas", () => {
  assert.ok(!fotoAbsen.safeParse("").success);
  assert.ok(!fotoAbsen.safeParse("data:image/jpeg;base64," + "A".repeat(2_000_001)).success);
});
