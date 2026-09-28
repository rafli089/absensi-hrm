import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validasiUrlWebhook, PREFIX, JENIS_KEJADIAN } from "../lib/integrasi/webhook.ts";
import { urlFoto } from "../lib/absensi/foto.ts";

describe("validasiUrlWebhook", () => {
  test("https publik diterima", () => {
    const r = validasiUrlWebhook("https://hooks.slack.com/services/T00/B00/xxx");
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(r.url.startsWith("https://"));
  });

  test("non-string ditolak", () => {
    assert.equal(validasiUrlWebhook(123).ok, false);
    assert.equal(validasiUrlWebhook("").ok, false);
    assert.equal(validasiUrlWebhook("   ").ok, false);
  });

  test("URL rusak ditolak", () => {
    assert.equal(validasiUrlWebhook("not a url").ok, false);
  });

  test("http ditolak", () => {
    const r = validasiUrlWebhook("http://example.com/hook");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.kode, "URL_HTTP_DITOLAK");
  });

  test("localhost ditolak (SSRF)", () => {
    const r = validasiUrlWebhook("https://localhost:4444/hook");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.kode, "URL_INTERNAL_DITOLAK");
  });

  test("127.0.0.1 ditolak", () => {
    assert.equal(validasiUrlWebhook("https://127.0.0.1/hook").ok, false);
  });

  test("cloud metadata ditolak", () => {
    assert.equal(validasiUrlWebhook("https://169.254.169.254/latest/meta-data").ok, false);
  });

  test("subnet privat 10.x dan 192.168.x ditolak", () => {
    assert.equal(validasiUrlWebhook("https://10.0.0.5/hook").ok, false);
    assert.equal(validasiUrlWebhook("https://192.168.1.10/hook").ok, false);
  });

  test("172.16–172.31 ditolak, 172.32 diterima", () => {
    assert.equal(validasiUrlWebhook("https://172.16.0.1/hook").ok, false);
    assert.equal(validasiUrlWebhook("https://172.31.255.254/hook").ok, false);
    const publik = validasiUrlWebhook("https://172.32.0.1/hook");
    assert.equal(publik.ok, true);
  });

  test("localhost subdomain ditolak", () => {
    assert.equal(validasiUrlWebhook("https://api.localhost/hook").ok, false);
  });

  test("host .internal ditolak", () => {
    assert.equal(validasiUrlWebhook("https://payroll.internal/hook").ok, false);
  });
});

describe("PREFIX + JENIS_KEJADIAN", () => {
  test("prefix konsisten dengan key AppSetting", () => {
    assert.equal(PREFIX, "integrasi/");
    for (const e of JENIS_KEJADIAN) {
      assert.ok(e.includes("."));
    }
  });
});

describe("urlFoto", () => {
  test("base64 legacy dipakai apa adanya", () => {
    const b64 = "data:image/jpeg;base64,abc123";
    assert.equal(urlFoto(b64), b64);
  });

  test("path relatif diprefiks /uploads/", () => {
    assert.equal(urlFoto("2026/09/28/uuid.jpg"), "/uploads/2026/09/28/uuid.jpg");
  });

  test("null/undefined → null", () => {
    assert.equal(urlFoto(null), null);
    assert.equal(urlFoto(undefined), null);
    assert.equal(urlFoto(""), null);
  });
});