# PRD — Website Absensi & HR Management

**Project Name:** Office Attendance & HR Management System
**Product Type:** Web Application
**Target User:** Perusahaan / Kantor
**Platform:** Web Desktop & Responsive Web
**Version:** 1.0.0

---

## 1. Product Overview

Website Absensi & HR Management adalah aplikasi web internal perusahaan untuk mengelola kehadiran karyawan secara terintegrasi. Sistem mencakup absensi dengan foto di lokasi, validasi lokasi GPS, manajemen kehadiran, jam kerja dan shift, payroll otomatis, slip gaji digital, dashboard analitik, monitoring aktivitas, alert keamanan, manajemen karyawan, dan laporan.

**Fokus utama:**
- **Employee Experience:** absensi cepat, jadwal, riwayat, shift, slip gaji.
- **Administrative Management:** monitoring, shift, payroll, laporan, keamanan, analytics.

---

## 2. Product Goals

- Digitalisasi absensi.
- Foto di lokasi sebagai bukti kehadiran.
- Validasi lokasi menggunakan GPS.
- Otomatisasi perhitungan kehadiran.
- Otomatisasi payroll.
- Transparansi informasi bagi karyawan.
- Monitoring management melalui dashboard.
- Mendeteksi aktivitas absensi dan login yang mencurigakan.

---

## 3. Product Principles

- Simple
- Fast
- Transparent
- Secure
- Apple/macOS-inspired without copying Apple's UI literally.
- Design quality ditentukan oleh design system, spacing, typography, warna, komponen, dan motion.

---

## 4. Target Users

- Employee
- HR / HRD
- Admin
- Manager / Supervisor
- Super Admin

---

## 5. Role & Permission

| Role | Permission |
|---|---|
| Employee | check-in/out, riwayat sendiri, jadwal, slip gaji |
| Supervisor | monitoring tim, approval, laporan tim |
| HR | employee management, attendance, shift, payroll, reports |
| Admin | user management, access control, security, configuration |
| Super Admin | full system access |

---

## 6. Core Features

### 6.1 Authentication
Login email/username, password, optional PIN, session management, logout, password reset, optional SSO.

### 6.2 Employee Registration
Employee ID, NIK, nama, email, telepon, departemen, jabatan, status employment, tanggal masuk, lokasi kerja, shift, gaji, rekening bank, dan foto profil.

### 6.3 Photo Attendance
**Flow:** buka attendance → camera permission → ambil foto → GPS validation → shift check → attendance recorded → result.

Absensi hanya butuh foto di lokasi sebagai bukti kehadiran. Tidak ada pencocokan identitas biometrik di perangkat — kamera HP jadul yang buram tidak boleh menggagalkan absensi. Identitas tetap dijamin oleh sesi login; lokasi dijamin oleh GPS.

Foto disimpan sebagai bukti pada `attendance.photo` dan `attendance_events.photo`.

### 6.4 GPS Attendance
Browser Geolocation API mengambil latitude, longitude, accuracy, timestamp, IP, dan device. Kantor memiliki latitude, longitude, dan radius. Jarak employee dibandingkan dengan lokasi kantor. Valid jika distance <= allowed radius.

### 6.5 Attendance Types
Check In, Check Out, Break Start, Break End, Overtime Start, Overtime End.

### 6.6 Attendance Status
Present, Late, Early Leave, Absent, Leave, Sick, Holiday, Day Off, Overtime, Incomplete, Rejected.

### 6.7 Attendance Rules
Admin dapat mengatur shift start/end dan grace period. Contoh: shift 09:00, grace 10 menit; check-in 09:07 tetap Present, 09:15 menjadi Late.

### 6.8 Shift Management
Shift Fixed, Rotating, Flexible, Overnight. Dapat memiliki start, end, break, dan grace period.

### 6.9 Shift Assignment
Shift dapat di-assign berdasarkan employee, department, position, team, dan tanggal.

### 6.10 Attendance Management
Tabel employee, date, check-in, check-out, shift, status, location. Filter berdasarkan date, employee, department, shift, status, dan location.

### 6.11 Attendance Correction
Employee dapat mengajukan koreksi seperti lupa check-out. HR dapat approve/reject. Semua perubahan dicatat di audit log.

### 6.12 Leave Management
Annual leave, sick leave, personal leave, permission, dan jenis lain.
**Flow:** employee submit → supervisor approval → HR → attendance updated.

### 6.13 Payroll
Komponen:
```
basic salary + allowance + overtime + bonus
- late deduction - absence deduction - other deduction
- tax/BPJS/configured deductions
= net salary
```

### 6.14 Payroll Period
Period memiliki start/end date dan payment date.
Status: Draft, Calculated, Reviewed, Approved, Paid, Locked.

### 6.15 Payroll Calculation
Mengambil data attendance, shift, overtime, leave, salary, allowance, deduction, lalu melakukan kalkulasi otomatis.

### 6.16 Digital Payslip
Menampilkan company, employee, ID, position, department, period, basic salary, allowance, overtime, bonus, deduction, tax, dan net salary.
Action: View, Download PDF, Print.

### 6.17 Dashboard Analytics
Attendance Today, attendance rate, late employees, department attendance, payroll overview, attendance trend.

### 6.18 Security Alert
Mendeteksi GPS outside office, unusual login, multiple device login, suspicious attendance, IP changes, impossible location, repeated attempts.
Severity: INFO, LOW, MEDIUM, HIGH, CRITICAL.

### 6.19 Admin Quick Actions
Add Employee, Create Shift, Assign Shift, Generate Payroll, Export Attendance, View Security Alert, Create Announcement.

### 6.20 Reports
Attendance, late, absence, overtime, payroll, dan security reports. Export PDF, Excel, CSV.

---

## 7. User Flow

### 7.1 Employee Login
Open Website → Login → Authentication → Dashboard.

### 7.2 Employee Check-In
Dashboard → Check In → Camera Permission → Ambil Foto → GPS Permission → Location Validation → Check Shift → Attendance Created → Success.

### 7.3 Failed Attendance
Check In → Camera Unavailable atau Foto Gagal → Show Reason → Retry.

### 7.4 GPS Failed
Check In → Foto Diambil → GPS Validation → Outside Radius → Attendance Rejected.

### 7.5 Employee Check-Out
Dashboard → Check Out → Ambil Foto → GPS Validation → Save Attendance → Show Work Duration.

### 7.6 HR Employee Management
HR Dashboard → Employees → Employee List → Add Employee → Employee Information → Assign Department → Assign Shift → Set Salary → Save.

### 7.7 Payroll Flow
Payroll → Select Period → Calculate Payroll → Process Attendance → Calculate Overtime → Calculate Deduction → Calculate Salary → Review → Approve → Generate Payslip → Publish.

---

## 8. UI/UX Design

### 8.1 Design Direction
Apple/macOS-inspired enterprise web application: clean, minimal, spacious, premium, functional, calm, smooth. Framework tidak otomatis membuat desain Apple-like.

### 8.2 Recommended Stack
Next.js + Tailwind CSS + shadcn/ui + Motion + Lucide React.

### 8.3 Layout
Desktop: sidebar + header + content area. Sidebar collapsible. Employee attendance harus nyaman di smartphone browser.

### 8.4 Sidebar
Dashboard; Attendance (Today, History, Corrections); Employees; Schedule (Shifts, Calendar); Leave; Payroll; Reports; Security; Settings.

### 8.5 Header
Breadcrumb, search, notification, user avatar.

### 8.6 Cards
Border tipis, radius besar, neutral background, shadow halus, spacing konsisten.

### 8.7 Color System
- Background: `#F5F5F7`
- Surface: `#FFFFFF`
- Primary Text: `#1D1D1F`
- Secondary Text: `#6E6E73`
- Border: `#D2D2D7`
- Status colors: success green, warning orange, danger red, info blue; digunakan secukupnya.

### 8.8 Typography
Inter / SF Pro Display fallback / system UI. Gunakan hierarchy Display, H1, H2, H3, Body, Caption, Label tanpa terlalu banyak font weight.

### 8.9 Radius
- Small: 8px
- Medium: 12px
- Large: 16px
- Card: 20px
- Modal: 24px

### 8.10 Motion
Untuk page transition, modal, dropdown, sidebar, toast, card interaction, loading, dan verification. Subtle, tidak berlebihan.

### 8.11 Attendance UI
Primary action yang jelas dengan jam, tombol Check In/Out, status lokasi, dan pratinjau foto.

### 8.12 Photo Attendance UI
Kamera berjalan otomatis; user tekan "Ambil Foto" → preview muncul → tekan "Pakai Foto Ini" atau "Ulangi". Dua state: Siap dan Gagal (kamera ditolak / tidak ada).

### 8.13 Responsive Design
- Desktop: >=1280px
- Tablet: 768–1279px
- Mobile: <768px

---

## 9. Database Overview

**Recommended relational database:** PostgreSQL.

### Tables

- **users**: id, employee_id, email, password_hash, role_id, status, last_login_at, timestamps.
- **employees**: id, employee_code, user_id, full_name, NIK, email, phone, gender, birth_date, address, department_id, position_id, employment_status, join_date, resign_date, photo_url, timestamps.
- **departments**: id, name, description, manager_id, timestamps.
- **positions**: id, name, description, department_id, timestamps.
- **roles**: id, name, description.
- **permissions**: id, name, description.
- **role_permissions**: role_id, permission_id.
- **offices**: id, name, address, latitude, longitude, radius, status, timestamps.
- **employee_locations**: id, employee_id, latitude, longitude, accuracy, captured_at.
- **shifts**: id, name, start_time, end_time, break_start, break_end, grace_period, is_overnight, status.
- **employee_shifts**: id, employee_id, shift_id, date, created_at.
- **attendance**: id, employee_id, office_id, shift_id, date, check_in, check_out, coordinates/accuracy, photo, status, late_minutes, early_leave_minutes, work_minutes, timestamps.
- **attendance_events**: id, attendance_id, employee_id, event_type, timestamp, location, device_id, IP, metadata.
- **leave_requests**: id, employee_id, leave_type_id, start_date, end_date, reason, status, approved_by, approved_at, created_at.
- **leave_types**: id, name, description, annual_limit, is_paid, status.
- **salary_structures**: id, employee_id, basic_salary, effective_from, effective_to, timestamps.
- **salary_components**: id, name, type, calculation_method, amount, is_taxable, status.
- **payrolls**: id, employee_id, period_start, period_end, basic_salary, total_allowance, total_overtime, total_bonus, total_deduction, tax, net_salary, status, approved_by, approved_at, created_at.
- **payslips**: id, payroll_id, employee_id, file_url, generated_at, published_at.
- **security_events**: id, employee_id, event_type, severity, IP, device, location, description, metadata, created_at, resolved_at, resolved_by.
- **audit_logs**: id, user_id, action, entity_type, entity_id, old_value, new_value, IP, user_agent, created_at.

### Relationship
Users → Employees → Department, Position, Attendance, Employee Shift, Leave Request, Salary Structure, Payroll → Payslip.

---

## 10. Technical Requirements

**Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Motion, Lucide React.

**Backend:** Next.js Route Handlers / Server Actions; alternative separated backend: NestJS.

**Database:** PostgreSQL + Prisma (alternative Drizzle ORM).

**Authentication:** Auth.js, Clerk, Supabase Auth, atau custom authentication dengan secure HTTP-only cookies.

**Photo Capture:** canvas → `toDataURL('image/jpeg', 0.7)`, maks lebar 640px. Ringan untuk kamera HP lama.

**Geolocation:** Browser Geolocation API. GPS harus divalidasi server-side.

**Security:** HTTPS, HTTP-only cookies, CSRF protection, rate limiting, input validation, SQL injection/XSS protection, RBAC, audit logging, encryption, Argon2id/bcrypt.

**API:**
```
/api/auth/login
/api/attendance/check-in
/api/attendance/check-out
/api/attendance/history
/api/employees
/api/employees/:id
/api/shifts
/api/shifts/:id
/api/payroll
/api/payroll/calculate
/api/payroll/:id
/api/payslips
/api/reports
/api/security/events
```

**Validation:** Zod.

**State:** React Server Components, Server Actions, URL Search Params, TanStack Query. Zustand jika membutuhkan client state.

**File Storage:** S3-compatible storage seperti AWS S3, Cloudflare R2, atau Supabase Storage.

---

## 11. Non-Functional Requirements

**Performance target:**
- Dashboard initial load <2–3 seconds pada jaringan normal.
- Attendance API <2 seconds pada kondisi jaringan normal.

**Availability target:**
- 99.5%+ production.

**Scalability:**
- MVP 100–500 employees.
- Arsitektur siap berkembang ke 1,000+ employees.

---

## 12. Security Requirements

Biometric data harus encrypted, access restricted, tidak diekspos ke employee lain, tidak dikirim lewat URL, dan tidak ditampilkan di dashboard biasa.

Location data hanya digunakan untuk kebutuhan attendance validation, security verification, dan audit. Hindari continuous tracking jika tidak dibutuhkan.

---

## 13. Dashboard

### Admin Dashboard
Good Morning, Admin → Today statistics → Present/Late/Absent/Leave → Attendance Overview → Department Attendance → Recent Activity → Security Alerts.

### Employee Dashboard
Good Morning → tanggal → Today's Attendance → Check In/Out → Today's Shift → Work Duration → Attendance History.

---

## 14. Notification System

In-app dan email untuk attendance success/failure, late reminder, shift reminder, leave approval/rejection, payroll published, dan security alert. Optional: WhatsApp dan push notification.

---

## 15. Search & Filter

Global search untuk Employee, Employee ID, Department, Position, Attendance, Payroll.
Table filters: Date, Status, Department, Shift, Employee.

---

## 16. Reporting

Report generator menyediakan Date Range, Department, Employee, Status, Shift. Output PDF, Excel, CSV. Report mencatat Generated By, Generated At, Period, dan Filter.

---

## 17. Error Handling

Pesan harus actionable. Contoh:
- "Terjadi kesalahan saat melakukan absensi. Silakan coba kembali."
- "Lokasi Anda belum dapat diverifikasi. Pastikan izin lokasi aktif."
- "Kamera tidak dapat diakses. Periksa permission browser Anda."

---

## 18. Empty & Loading State

Empty state menjelaskan bahwa belum ada data dan menyediakan action. Loading menggunakan skeleton atau spinner untuk proses singkat. Proses pengambilan foto menggunakan status "Menyiapkan kamera..." / "Ambil foto".

---

## 19. Accessibility

Keyboard navigation, focus state, screen reader support, contrast, form labels, dan error messages. Target WCAG 2.1 AA.

---

## 20. Scope Project

### MVP
Authentication; employee CRUD; department; position; check-in/out; photo capture; GPS verification; attendance history; shift management; dashboard analytics; salary structure; payroll calculation; payslip; attendance/payroll reports; security events; audit log.

### Phase 2
Leave management, overtime management, advanced analytics, email notification, advanced security detection, multi-office, announcements.

### Phase 3
Mobile app, push notification, SSO, WhatsApp integration, advanced payroll engine, AI attendance analytics, workforce analytics, predictive insights.

### Out of Scope MVP
Full accounting, recruitment ATS, performance management, inventory, CRM, project management, full ERP, continuous employee GPS tracking.

---

## 21. Project Structure

```
attendance-app/
├── app/
│   ├── (auth)/login/
│   ├── dashboard/
│   ├── attendance/
│   ├── employees/
│   ├── shifts/
│   ├── leave/
│   ├── payroll/
│   ├── reports/
│   ├── security/
│   └── settings/
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── attendance/
│   ├── employees/
│   ├── payroll/
│   └── charts/
├── lib/
│   ├── auth/
│   ├── database/
│   ├── attendance/
│   ├── payroll/
│   ├── photo/
│   ├── location/
│   └── security/
├── prisma/
│   └── schema.prisma
├── public/
├── types/
├── hooks/
├── utils/
├── middleware.ts
└── package.json
```

---

## 22. Design System Components

Button, Input, Select, Dropdown, Dialog, Sheet, Card, Table, Badge, Tabs, Toast, Tooltip, Calendar, DatePicker, Avatar, Progress, Skeleton, Chart.

**Custom components:**
AttendanceCard, PhotoCapture, LocationStatus, EmployeeCard, ShiftCard, PayrollSummary, PayslipPreview, SecurityAlert, AnalyticsCard, QuickAction.

---

## 23. Acceptance Criteria

**Attendance:** Berhasil jika foto diambil + GPS verified + employee active + shift valid.

**GPS:** Ditolak jika distance > allowed radius, kecuali ada override yang diizinkan.

**Payroll:** Berhasil jika employee salary exists + attendance processed + payroll period valid.

**Payslip:** Hanya dapat diakses oleh employee owner, HR, dan authorized admin.

---

## 24. Audit Requirements

Wajib mencatat login, logout, failed login, employee CRUD, attendance create/modify, correction, payroll generate/modify/approve, payslip publish, permission changes, dan security events.

---

## 25. Business Rules

1. Satu check-in aktif per shift.
2. Check-out hanya setelah check-in.
3. GPS harus berada dalam radius yang diizinkan.
4. Foto absensi harus berhasil diambil.
5. Attendance mengikuti shift employee.
6. Correction harus memiliki audit trail.
7. Payroll yang Approved tidak boleh diubah tanpa permission khusus.

---

## 26. Analytics Metrics

Attendance Rate, Absence Rate, Late Rate, Average Check-In Time, Average Work Hours, Overtime Hours, Leave Rate, Payroll Cost, Department Attendance.

---

## 27. UX Principles

- One primary action per screen.
- Reduce unnecessary clicks.
- Always explain system status.
- Error harus menjelaskan cara recovery.
- Sensitive information tidak boleh terekspos.
- Motion harus mengkomunikasikan state, bukan sekadar dekorasi.

---

## 28. Apple-like Design Checklist

- [ ] Spacing konsisten.
- [ ] Typography hierarchy jelas.
- [ ] Warna tidak berlebihan.
- [ ] Border subtle.
- [ ] Shadow subtle.
- [ ] Radius konsisten.
- [ ] Lucide icons konsisten.
- [ ] Button hierarchy jelas.
- [ ] Hover state.
- [ ] Loading state.
- [ ] Empty state.
- [ ] Error state.
- [ ] Responsive.
- [ ] Motion subtle.
- [ ] Tidak menggunakan gradient berlebihan.
- [ ] Tidak menggunakan glassmorphism berlebihan.

---

## 29. Recommended Tech Stack Summary

| Layer | Technology |
|---|---|
| Framework | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Animation | Motion |
| Icons | Lucide React |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Auth.js |
| Validation | Zod |
| Charts | Recharts |
| File Storage | S3 / Cloudflare R2 |
| PDF | React PDF / server PDF |
| Deployment | Vercel / Cloud Server |
| Version Control | Git + GitHub |

---

## 30. Development Roadmap

**Phase 1 — Foundation:**
Next.js → TypeScript → Tailwind → shadcn/ui → Prisma → PostgreSQL → Authentication → RBAC.

**Phase 2 — Employee:**
Employee CRUD → Department → Position → Profile.

**Phase 3 — Attendance:**
Attendance UI → Camera → Photo Capture → GPS → Attendance Engine → History.

**Phase 4 — Shift:**
Shift Management → Assignment → Calendar → Rules.

**Phase 5 — Payroll:**
Salary Structure → Payroll Engine → Calculation → Review → Approval → Payslip.

**Phase 6 — Analytics:**
Dashboard → Charts → Attendance Analytics → Payroll Analytics → Reports.

**Phase 7 — Security:**
Audit Log → Security Events → Anomaly Detection → Security Dashboard.

---

## 31. Definition of Done

- [ ] Employee login works.
- [ ] Admin login works.
- [ ] RBAC works.
- [ ] HR can create employees.
- [ ] Photo capture works.
- [ ] GPS validation works.
- [ ] Check-in/out works.
- [ ] Attendance status is calculated.
- [ ] Shift management works.
- [ ] Shift assignment works.
- [ ] Attendance history works.
- [ ] Payroll calculation works.
- [ ] Payslip generation works.
- [ ] Employee can view payslip.
- [ ] Dashboard analytics works.
- [ ] Reports can be exported.
- [ ] Security events and audit logs are stored.
- [ ] Responsive UI works.
- [ ] Design system is consistent.
- [ ] Error/loading states exist.
- [ ] Sensitive data permissions work.
- [ ] Production uses HTTPS.

---

## 32. Final Product Vision

Produk akhir bukan sekadar aplikasi absensi, tetapi **Employee Attendance & HR Management Platform** yang menggabungkan Identity, Photo, Location, Attendance, Shift, Leave, Payroll, Payslip, Analytics, Security, dan Reporting.

**Experience:** Simple → Fast → Clean → Secure → Professional.

**Visual:** Apple/macOS-inspired + Enterprise + Minimal + Modern + Responsive.

---

## 33. Important Implementation Notes

**Photo:** foto di lokasi adalah bukti kehadiran, bukan verifikasi identitas. Jangan menggagalkan absensi hanya karena pencahayaan atau kualitas kamera kurang. Identitas dijamin oleh sesi login; lokasi oleh GPS.

**GPS:** koordinat browser bukan bukti lokasi yang sempurna. Simpan coordinates, accuracy, timestamp, IP, dan device serta gunakan anti-abuse rules yang sesuai.

**Payroll:** gunakan calculation engine configurable, bukan hard-coded untuk satu perusahaan.

**Biometric Data:** membutuhkan access control, encryption, retention policy, dan privacy policy yang jelas sebelum production.

**Privacy:** collect data seminimal mungkin sesuai kebutuhan fitur dan jelaskan penggunaan data kepada pengguna.

---

*END OF PRD*