"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

/** Form pengajuan cuti. Satu hari = satu baris LeaveRequest, jadi weekend otomatis dilewati. */
export function AjukanCuti() {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [type, setType] = useState("ANNUAL");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const hariIni = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMenyimpan(true);
    setErrors({});
    try {
      const r = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, dari, sampai, reason }),
      });
      const d = await r.json();
      if (!r.ok) {
        // 422 punya `fields`; sisanya cuma pesan umum.
        if (Array.isArray(d.fields)) {
          setErrors(Object.fromEntries(d.fields.map((f: { field: string; message: string }) => [f.field, f.message])));
        }
        toast.error(d.error ?? "Gagal mengajukan cuti.");
        return;
      }
      toast.success(`Pengajuan ${d.jumlahHari} hari ${d.label.toLowerCase()} terkirim.`);
      setBuka(false);
      setDari(""); setSampai(""); setReason("");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" aria-hidden />Ajukan cuti</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajukan cuti</DialogTitle>
          <DialogDescription>Akhir pekan tidak dihitung. Kuota annual {12} hari per tahun.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 p-6">
          <Field label="Jenis cuti" htmlFor="cuti-type" required>
            <Select id="cuti-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ANNUAL">Cuti Tahunan</option>
              <option value="SICK">Cuti Sakit</option>
              <option value="PERSONAL">Cuti Pribadi</option>
              <option value="UNPAID">Cuti Tanpa Gaji</option>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari" htmlFor="cuti-dari" error={errors.dari} required>
              <Input id="cuti-dari" type="date" min={hariIni} value={dari}
                onChange={(e) => { setDari(e.target.value); if (!sampai) setSampai(e.target.value); }}
                required />
            </Field>
            <Field label="Sampai" htmlFor="cuti-sampai" error={errors.sampai} required>
              <Input id="cuti-sampai" type="date" min={dari || hariIni} value={sampai}
                onChange={(e) => setSampai(e.target.value)} required />
            </Field>
          </div>

          <Field label="Alasan" htmlFor="cuti-alasan" error={errors.reason} required
            hint="Minimal 3 karakter. Akan terlihat oleh atasan Anda.">
            <Textarea id="cuti-alasan" value={reason} onChange={(e) => setReason(e.target.value)}
              minLength={3} maxLength={500} required />
          </Field>

          <DialogFooter className="p-0 pt-2">
            <Button type="button" variant="ghost" onClick={() => setBuka(false)}>Batal</Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Kirim pengajuan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
