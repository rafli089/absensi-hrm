import { redirect } from "next/navigation";

/**
 * Halaman utama `/` — redirect ke dashboard jika sudah login,
 * atau ke `/login` jika belum.
 * PENTING: file ini WAJIB ada agar Next.js App Router berfungsi.
 */
export default function HomePage() {
  redirect("/dashboard");
}