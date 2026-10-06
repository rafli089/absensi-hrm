"use client";

/**
 * AmbilFoto — potret kamera jadi dataURL JPEG (PRD §6.3).
 *
 * ponytail: hanya foto, tanpa pencocokan identitas/liveness. Cek identitas tetap
 * dari sesi login + GPS. Kalau butuh bukti identitas kuat lagi, pasang
 * verifikasi awan tepat sebelum penyimpanan di route check-in.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, X, Check, Loader2 } from "lucide-react";

/** Maks lebar hasil akhir. HP jadul 640px sudah cukup untuk bukti kehadiran. */
const MAKS_LEBAR = 640;
const KUALITAS = 0.7;

export type HasilFoto = { foto: string; diambilPada: string };

export function AmbilFoto({
  onSelesai,
  onBatal,
}: {
  onSelesai: (hasil: HasilFoto) => void;
  onBatal: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const genRef = useRef(0);
  const [state, setState] = useState<"MENYIAPKAN" | "SIAP" | "GAGAL">("MENYIAPKAN");
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [pesan, setPesan] = useState("Menyiapkan kamera...");
  /** naik tiap "Ulangi" — memicu effect kamera lagi tanpa reload halaman. */
  const [nonce, setNonce] = useState(0);

  const stop = useCallback(() => {
    genRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    const gen = ++genRef.current;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: MAKS_LEBAR }, height: { ideal: 480 } },
          audio: false,
        });
        if (gen !== genRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        try {
          await video.play();
        } catch (e) {
          if (!(e instanceof DOMException && e.name === "AbortError")) throw e;
        }
        if (gen !== genRef.current) return;
        setState("SIAP");
        setPesan("Posisikan wajah di dalam bingkai, lalu tekan tombol.");
      } catch (e) {
        if (gen !== genRef.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        setState("GAGAL");
        setPesan(
          /Permission|denied|NotAllowed/i.test(msg)
            ? "Kamera ditolak. Aktifkan izin kamera di pengaturan browser."
            : /NotFound|Overconstrained/i.test(msg)
              ? "Tidak ada kamera yang bisa dipakai di perangkat ini."
              : `Gagal membuka kamera: ${msg}`,
        );
      }
    })();
    return stop;
  }, [stop, nonce]);

  /** Perbaiki orientasi gambar agar wajah tidak terbalik. */
  function potret() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const skala = Math.min(1, MAKS_LEBAR / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * skala);
    canvas.height = Math.round(video.videoHeight * skala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1); // video ditampilkan scale-x-[-1], jadi balik agar tersimpan normal
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", KUALITAS);
  }

  function ambil() {
    const foto = potret();
    if (!foto) {
      setPesan("Kamera belum siap. Coba lagi.");
      return;
    }
    stop();
    setPratinjau(foto);
  }

  function ulang() {
    setPratinjau(null);
    setNonce((n) => n + 1); // effect kamera jalan lagi
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-black">
        {pratinjau ? (
          // ponytail: pratinjau lokal base64, next/image tak bisa optimasi data-URL.
          // Ganti ke <Image> kalau foto pindah ke URL server/CDN.
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={pratinjau} alt="Pratinjau foto absensi" className="size-full object-cover" />
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="size-full scale-x-[-1] object-cover" />
            <div className="pointer-events-none absolute inset-8 rounded-full border-2 border-white/60" />
          </>
        )}

        {state === "MENYIAPKAN" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 text-body font-medium text-white">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Menyiapkan kamera...
          </div>
        )}
        {state === "GAGAL" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 p-4">
            <p className="rounded-full bg-[var(--danger)] px-4 py-2 text-center text-body font-medium text-white">{pesan}</p>
          </div>
        )}
        {pratinjau && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/35 p-3 backdrop-blur-sm">
            <span className="flex items-center gap-2 rounded-full bg-[var(--ok)] px-4 py-2 text-body font-medium text-white">
              <Check className="size-4" aria-hidden /> Foto siap
            </span>
          </div>
        )}
      </div>

      <p className="text-caption text-[var(--ink-2)]" role="status">
        {pratinjau ? "Foto akan dikirim bersama data absensi." : pesan}
      </p>

      <div className="flex items-center gap-2">
        {!pratinjau ? (
          <>
            <button
              type="button"
              onClick={() => {
                stop();
                onBatal();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-black/[0.12] bg-[var(--surface)] px-4 text-body text-[var(--ink)] transition-colors hover:bg-[var(--bg)] active:scale-[0.98]"
            >
              <X className="size-4" aria-hidden /> Batal
            </button>
            <button
              type="button"
              onClick={ambil}
              disabled={state !== "SIAP"}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--brand-hover)] px-4 text-body font-medium text-white transition-colors hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
            >
              <Camera className="size-4" aria-hidden /> Ambil Foto
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={ulang}
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-black/[0.12] bg-[var(--surface)] px-4 text-body text-[var(--ink)] transition-colors hover:bg-[var(--bg)] active:scale-[0.98]"
            >
              <RotateCcw className="size-4" aria-hidden /> Ulangi
            </button>
            <button
              type="button"
              onClick={() => onSelesai({ foto: pratinjau, diambilPada: new Date().toISOString() })}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--ok)] px-4 text-body font-medium text-white transition-colors hover:brightness-95 active:scale-[0.98]"
            >
              <Check className="size-4" aria-hidden /> Pakai Foto Ini
            </button>
          </>
        )}
      </div>
    </div>
  );
}
