import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Absensi & HR Management", template: "%s · Absensi" },
  description: "Sistem absensi karyawan dengan foto di lokasi, validasi GPS, dan payroll otomatis.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F5F5F7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${inter.variable} min-h-screen bg-[var(--bg)] text-[var(--ink)] antialiased`}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              borderRadius: "16px",
              border: "1px solid #D2D2D7",
              fontFamily: "inherit",
            },
          }}
        />
      </body>
    </html>
  );
}
