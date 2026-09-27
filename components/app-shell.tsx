import { cn } from "@/lib/utils";
import { type SessionUser } from "@/lib/auth/session";
import { Sidebar, MobileHeader } from "@/app/dashboard/_components/navigation";

/**
 * Shell layout: sidebar (desktop) + header (mobile) + konten.
 * Sidebar memakai flex row, bukan `position: fixed` + media query,
 * jadi selalu punya ruang dan tidak pernah hilang karena kelas yang tertimpa.
 */
export function AppShell({
  user,
  children,
  className,
  maxWidth = "max-w-[1000px]",
}: {
  user: SessionUser;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <MobileHeader user={user} />
      <div className="flex">
        <Sidebar user={user} />
        <div className="min-w-0 flex-1">
          <main className={cn("p-5 lg:py-8", maxWidth, className)}>{children}</main>
        </div>
      </div>
    </div>
  );
}
