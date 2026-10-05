import { Role } from "@prisma/client";

/**
 * Satu-satunya sumber kebenaran permission aplikasi (PRD §5, §25.7).
 * Deviasi dari PRD §9: tabel permissions + role_permissions dibuang,
 * diganti peta ini — 5 role, jauh lebih mudah dites dan direview.
 */

export const PERMISSIONS = {
  // Absensi & data sendiri
  ATTENDANCE_CHECK_IN: "attendance:check-in",
  ATTENDANCE_HISTORY_SELF: "attendance:history:self",
  ATTENDANCE_CORRECTION_REQUEST: "attendance:correction:request",
  PAYSLIP_VIEW_SELF: "payslip:view:self",
  PROFILE_VIEW_SELF: "profile:view:self",
  LEAVE_REQUEST: "leave:request",

  // Monitoring
  ATTENDANCE_VIEW_ALL: "attendance:view:all",
  ATTENDANCE_CORRECTION_DECIDE: "attendance:correction:decide",
  TEAM_MONITORING: "team:monitoring",
  TEAM_REPORT: "team:report",
  LEAVE_VIEW_ALL: "leave:view:all",
  LEAVE_APPROVE: "leave:approve",

  // HR
  EMPLOYEE_MANAGE: "employee:manage",
  DEPARTMENT_MANAGE: "department:manage",
  POSITION_MANAGE: "position:manage",
  SHIFT_MANAGE: "shift:manage",
  PAYROLL_MANAGE: "payroll:manage",
  PAYROLL_APPROVE: "payroll:approve",
  REPORT_GENERATE: "report:generate",

  // Admin
  USER_MANAGE: "user:manage",
  ACCESS_CONTROL: "access:control",
  PASSWORD_RESET: "password:reset",
  PASSWORD_APPROVE: "password:approve",
  SECURITY_VIEW: "security:view",
  SECURITY_RESOLVE: "security:resolve",
  AUDIT_LOG_VIEW: "audit:log:view",
  SETTINGS_MANAGE: "settings:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL: Permission[] = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  EMPLOYEE: [
    PERMISSIONS.ATTENDANCE_CHECK_IN,
    PERMISSIONS.ATTENDANCE_HISTORY_SELF,
    PERMISSIONS.ATTENDANCE_CORRECTION_REQUEST,
    PERMISSIONS.PAYSLIP_VIEW_SELF,
    PERMISSIONS.PROFILE_VIEW_SELF,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.PASSWORD_RESET,
  ],
  SUPERVISOR: [
    PERMISSIONS.ATTENDANCE_CHECK_IN,
    PERMISSIONS.ATTENDANCE_HISTORY_SELF,
    PERMISSIONS.ATTENDANCE_CORRECTION_REQUEST,
    PERMISSIONS.PAYSLIP_VIEW_SELF,
    PERMISSIONS.PROFILE_VIEW_SELF,
    PERMISSIONS.ATTENDANCE_VIEW_ALL,
    PERMISSIONS.TEAM_MONITORING,
    PERMISSIONS.TEAM_REPORT,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.LEAVE_VIEW_ALL,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.PASSWORD_RESET,
    PERMISSIONS.PASSWORD_APPROVE,
  ],
  HR: [
    PERMISSIONS.ATTENDANCE_CHECK_IN,
    PERMISSIONS.ATTENDANCE_HISTORY_SELF,
    PERMISSIONS.ATTENDANCE_CORRECTION_REQUEST,
    PERMISSIONS.PAYSLIP_VIEW_SELF,
    PERMISSIONS.PROFILE_VIEW_SELF,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.LEAVE_VIEW_ALL,
    PERMISSIONS.ATTENDANCE_VIEW_ALL,
    PERMISSIONS.ATTENDANCE_CORRECTION_DECIDE,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.TEAM_MONITORING,
    PERMISSIONS.TEAM_REPORT,
    PERMISSIONS.EMPLOYEE_MANAGE,
    PERMISSIONS.DEPARTMENT_MANAGE,
    PERMISSIONS.POSITION_MANAGE,
    PERMISSIONS.SHIFT_MANAGE,
    PERMISSIONS.PAYROLL_MANAGE,
    PERMISSIONS.REPORT_GENERATE,
    PERMISSIONS.PASSWORD_RESET,
    PERMISSIONS.PASSWORD_APPROVE,
  ],
  ADMIN: [
    ...ALL.filter((p) => p !== PERMISSIONS.PAYROLL_APPROVE),
  ],
  SUPER_ADMIN: ALL,
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAny(role: Role | undefined | null, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: "Karyawan",
  SUPERVISOR: "Supervisor",
  HR: "HR",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

/** Role yang boleh masuk halaman dashboard ADMIN. */
export const STAFF_ROLES: Role[] = [Role.SUPERVISOR, Role.HR, Role.ADMIN, Role.SUPER_ADMIN];
