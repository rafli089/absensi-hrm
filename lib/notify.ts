"use client";

/**
 * Toast wrapper di atas sonner. Dipanggil dari komponen client saja.
 * Cukup satu file — tanpa context provider sendiri (PRD §8.10, §17).
 */
import { toast } from "sonner";

type Opsi = { deskripsi?: string; aksi?: { label: string; onClick: () => void } };

export const notify = {
  sukses: (pesan: string, o?: Opsi) =>
    toast.success(pesan, {
      description: o?.deskripsi,
      action: o?.aksi && { label: o.aksi.label, onClick: o.aksi.onClick },
    }),
  gagal: (pesan: string, o?: Opsi) =>
    toast.error(pesan, { description: o?.deskripsi }),
  info: (pesan: string, o?: Opsi) =>
    toast.info(pesan, { description: o?.deskripsi }),
  janji: <T,>(promise: Promise<T>, pesan: { loading: string; sukses: string; gagal: string }) =>
    promise.then(
      (v) => {
        toast.success(pesan.sukses);
        return v;
      },
      (e) => {
        toast.error(pesan.gagal, { description: e instanceof Error ? e.message : undefined });
        throw e;
      },
    ),
};
