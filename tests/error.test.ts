import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  toResponse,
} from "../lib/error.ts";

// --- AppError subclasses: status + code harus benar ---

test("NotFoundError punya status 404 dan kode NOT_FOUND", () => {
  const e = new NotFoundError("Karyawan", "abc");
  assert.equal(e.status, 404);
  assert.equal(e.code, "NOT_FOUND");
  assert.match(e.message, /Karyawan/);
  assert.equal(e.isOperational, true);
});

test("ConflictError punya status 409 dan kode CONFLICT", () => {
  const e = new ConflictError("Karyawan", "duplikat email");
  assert.equal(e.status, 409);
  assert.equal(e.code, "CONFLICT");
});

test("ValidationError punya status 422 dan fields terbawa", () => {
  const fields = [{ field: "email", message: "wajib" }];
  const e = new ValidationError(fields);
  assert.equal(e.status, 422);
  assert.deepEqual(e.fields, fields);
});

test("RateLimitError default retry 60 detik", () => {
  const e = new RateLimitError();
  assert.equal(e.status, 429);
  assert.match(e.message, /60 detik/);
});

test("UnauthorizedError status 401", () => {
  assert.equal(new UnauthorizedError().status, 401);
});

test("ForbiddenError status 403", () => {
  assert.equal(new ForbiddenError().status, 403);
});

// --- toResponse: AppError -> JSON body + status yang benar ---

test("toResponse mengembalikan JSON dengan kode dan message untuk AppError", async () => {
  const e = new NotFoundError("Karyawan", "xyz");
  const res = toResponse(e);
  assert.equal(res.status, 404);
  const body = JSON.parse(await res.text());
  assert.equal(body.kode, "NOT_FOUND");
  assert.match(body.error, /xyz/);
});

// --- toResponse: non-AppError -> 500 generik tanpa leak ---

test("toResponse menutupi pesan internal pada non-AppError", async () => {
  const sensasiPrisma = new Error(
    'Invalid `prisma.employee.findUnique()` invocation: column "tabelRahasia"',
  );
  const res = toResponse(sensasiPrisma);
  assert.equal(res.status, 500);
  const body = JSON.parse(await res.text());
  assert.equal(body.kode, "INTERNAL_ERROR");
  // Pesan asli tidak boleh bocor ke client
  assert.ok(!body.error.includes("prisma"));
  assert.ok(!body.error.includes("column"));
});
