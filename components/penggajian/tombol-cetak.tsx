"use client";

import { Printer } from "lucide-react";

/** Satu-satunya bagian interaktif di slip. `window.print()` membuka dialog
 *  cetak browser, dari situ user bisa "Simpan sebagai PDF". */
export function TombolCetak() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full border border-black/[0.12] bg-[var(--surface)] px-4 py-2 text-body font-medium text-[var(--ink)] transition-colors hover:bg-[var(--bg)] active:scale-[0.98]"
    >
      <Printer className="size-4" aria-hidden />
      Cetak / Simpan PDF
    </button>
  );
}
