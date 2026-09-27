"use client";

import { Printer } from "lucide-react";

/** Satu-satunya bagian interaktif di slip. `window.print()` membuka dialog
 *  cetak browser, dari situ user bisa "Simpan sebagai PDF". */
export function TombolCetak() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--bg)]"
    >
      <Printer className="size-4" aria-hidden />
      Cetak / Simpan PDF
    </button>
  );
}
