"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LocateFixed, Building2 } from "lucide-react";
import { ambilLokasi } from "@/components/absensi/lokasi";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Kantor = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius: number;
};

export function FormKantor() {
  const router = useRouter();
  const [kantor, setKantor] = useState<Kantor | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("");

  useEffect(() => {
    fetch("/api/settings/kantor")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.kantor) {
          setKantor(d.kantor);
          setNama(d.kantor.name);
          setAlamat(d.kantor.address ?? "");
          setLat(String(d.kantor.latitude));
          setLng(String(d.kantor.longitude));
          setRadius(String(d.kantor.radius));
        }
      })
      .catch(() => toast.error("Gagal memuat data kantor."))
      .finally(() => setMemuat(false));
  }, []);

  async function isiDariLokasiSaya() {
    const hasil = await ambilLokasi();
    if (!hasil.ok) {
      toast.error(hasil.alasan);
      return;
    }
    setLat(String(hasil.posisi.latitude));
    setLng(String(hasil.posisi.longitude));
    toast.success("Koordinat diambil dari posisi Anda sekarang.");
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    const latitude = Number(lat);
    const longitude = Number(lng);
    const rad = Number(radius);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(rad)) {
      toast.error("Isi latitude, longitude, dan radius dengan angka yang valid.");
      return;
    }

    setMenyimpan(true);
    try {
      const res = await fetch("/api/settings/kantor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nama, address: alamat || undefined, latitude, longitude, radius: rad }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menyimpan.");
        return;
      }
      setKantor(data.kantor);
      toast.success("Lokasi kantor diperbarui.");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  if (memuat) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--ink-2)]" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Memuat...
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-[var(--brand)]" aria-hidden />
          <h2 className="text-[15px] font-semibold">Lokasi & Radius Kantor</h2>
        </div>

        <form onSubmit={simpan} className="space-y-4">
          <Label className="block space-y-1.5">
            <span>Nama Kantor</span>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Kantor Pusat" required />
          </Label>

          <Label className="block space-y-1.5">
            <span>Alamat</span>
            <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Jl. Contoh No. 1" />
          </Label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="block space-y-1.5">
              <span>Latitude</span>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-6.2088" inputMode="decimal" required />
            </Label>
            <Label className="block space-y-1.5">
              <span>Longitude</span>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="106.8456" inputMode="decimal" required />
            </Label>
          </div>

          <Label className="block space-y-1.5">
            <span>Radius (meter)</span>
            <Input value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="150" inputMode="numeric" required />
          </Label>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={isiDariLokasiSaya}>
              <LocateFixed className="size-4" aria-hidden /> Pakai Lokasi Saya Sekarang
            </Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Simpan"}
            </Button>
          </div>
        </form>

        {kantor && (
          <p className="text-[12px] text-[var(--ink-2)]">
            Saat ini: {kantor.latitude}, {kantor.longitude} · radius {Math.round(kantor.radius)}m
          </p>
        )}
      </CardContent>
    </Card>
  );
}
