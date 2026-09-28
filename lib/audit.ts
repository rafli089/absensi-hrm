/**
 * Audit trail: pencatatan peristiwa sistem (PRD §24, §12).
 * Semua perubahan status absensi, payroll, karyawan, login dicatat di sini.
 */

import { prisma } from "@/lib/db";
import { Prisma, type AuditAction, type SecurityEventType, type Severity } from "@prisma/client";

export type AuditInput = {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress: string;
  userAgent?: string;
};

export async function audit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue !== undefined ? (input.oldValue as Prisma.InputJsonValue) : undefined,
      newValue: input.newValue !== undefined ? (input.newValue as Prisma.InputJsonValue) : undefined,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });
}

export async function catatKeamanan(params: {
  employeeId?: string;
  userId?: string;
  eventType: SecurityEventType;
  severity: Severity;
  ipAddress: string;
  deviceId?: string;
  latitude?: number;
  longitude?: number;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      employeeId: params.employeeId,
      userId: params.userId,
      eventType: params.eventType,
      severity: params.severity,
      ipAddress: params.ipAddress,
      deviceId: params.deviceId,
      latitude: params.latitude,
      longitude: params.longitude,
      description: params.description,
      metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}
