import { Suspense } from "react";
import { LoginForm } from "./_components/login-form";

export const metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
