"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Form ganti kata sandi. Payload selalu 3 field; API yang memutuskan
 * langsung vs menunggu-approval berdasarkan role.
 */
export function UbahPassword({ menunggu }: { menunggu: boolean }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [salah, setSalah] = useState("");
  const [form, setForm] = useState({ lama: "", baru: "", ulang: "" });

  function set(k: "lama" | "baru" | "ulang", v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSalah("");
    if (form.baru !== form.ulang) {
      setSalah("Konfirmasi tidak sama dengan kata sandi baru.");
      return;
    }
    setMenyimpan(true);
    try {
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.lama,
          newPassword: form.baru,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSalah(d.error ?? "Gagal mengubah kata sandi.");
        return;
      }
      if (d.menunggu) {
        toast.success("Pengajuan terkirim. Menunggu persetujuan atasan.");
      } else {
        toast.success("Kata sandi berhasil diubah.");
      }
      setBuka(false);
      setForm({ lama: "", baru: "", ulang: "" });
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button>
          <KeyRound className="size-4" aria-hidden />
          Ganti kata sandi
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ganti kata sandi</DialogTitle>
          <DialogDescription>
            {menunggu
              ? "Pengajuan Anda menunggu persetujuan atasan sebelum kata sandi berubah."
              : "Kata sandi langsung berubah setelah disimpan."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 p-6">
          <Field label="Kata sandi lama" htmlFor="pw-lama" error={salah || undefined} required>
            <Input
              id="pw-lama" type="password" value={form.lama}
              onChange={(e) => set("lama", e.target.value)} autoComplete="current-password" required
            />
          </Field>
          <Field label="Kata sandi baru" htmlFor="pw-baru"
            hint="Min. 8 karakter, huruf besar, huruf kecil, dan angka." required>
            <Input
              id="pw-baru" type="password" value={form.baru}
              onChange={(e) => set("baru", e.target.value)} autoComplete="new-password" required
            />
          </Field>
          <Field label="Ulangi kata sandi baru" htmlFor="pw-ulang" required>
            <Input
              id="pw-ulang" type="password" value={form.ulang}
              onChange={(e) => set("ulang", e.target.value)} autoComplete="new-password" required
            />
          </Field>

          <DialogFooter className="p-0 pt-2">
            <Button type="button" variant="ghost" onClick={() => setBuka(false)}>Batal</Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {menunggu ? "Kirim pengajuan" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
