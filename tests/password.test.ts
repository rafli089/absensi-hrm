import { test } from "node:test";
import assert from "node:assert/strict";
import { hash, verify, kuat } from "../lib/auth/hashi.ts";
import { can, PERMISSIONS } from "../lib/auth/permissions.ts";
import { Role } from "@prisma/client";

// --- Hash & verify round-trip ---

test("hash + verify: password benar cocok, yang salah tidak", () => {
  const h = hash("Abc12345");
  assert.ok(verify("Abc12345", h));
  assert.ok(!verify("salah123", h));
});

test("verify: hash kosong → false, tidak throw", () => {
  assert.ok(!verify("apapun", ""));
});

// --- Validasi kekuatan (PRD §12) ---

test("kuat: password lemah mengembalikan semua error yang relevan", () => {
  const err = kuat("abc");
  assert.ok(err.some((e) => e.includes("8 karakter")));
  assert.ok(err.some((e) => e.includes("besar")));
  assert.ok(err.some((e) => e.includes("angka")));
});

test("kuat: password kuat mengembalikan array kosong", () => {
  assert.deepEqual(kuat("Abcdef12"), []);
});

// --- Permission password per role ---

test("PASSWORD_RESET: semua role punya (termasuk EMPLOYEE)", () => {
  for (const role of Object.values(Role)) {
    assert.ok(can(role, PERMISSIONS.PASSWORD_RESET), `${role} harus punya PASSWORD_RESET`);
  }
});

test("PASSWORD_APPROVE: hanya SPV/HR/ADMIN/SUPER_ADMIN", () => {
  assert.ok(!can(Role.EMPLOYEE, PERMISSIONS.PASSWORD_APPROVE));
  assert.ok(can(Role.SUPERVISOR, PERMISSIONS.PASSWORD_APPROVE));
  assert.ok(can(Role.HR, PERMISSIONS.PASSWORD_APPROVE));
  assert.ok(can(Role.ADMIN, PERMISSIONS.PASSWORD_APPROVE));
  assert.ok(can(Role.SUPER_ADMIN, PERMISSIONS.PASSWORD_APPROVE));
});
