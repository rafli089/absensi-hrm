/** Geolokasi: haversine + guard akurasi (PRD §6.4, §33). */

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Jarak dua koordinat dalam meter. */
export function haversine(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

export type GpsVerdict =
  | { ok: true; distance: number; accuracy: number }
  | { ok: false; reason: string; distance?: number; accuracy: number };

const MAX_ACCURACY_M = () => Number(process.env.GPS_MAX_ACCURACY_M ?? 100);

/**
 * Validasi lokasi check-in terhadap kantor.
 * Akurasi GPS yang terlalu kasar ditolak: HP bisa melaporkan titik tengah kota
 * dengan akurasi 2km, itu bukan bukti berada di kantor (PRD §33).
 */
export function validateLocation(
  gps: { latitude: number; longitude: number; accuracy: number },
  office: { latitude: number; longitude: number; radius: number },
): GpsVerdict {
  if (!Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) {
    return { ok: false, reason: "Koordinat lokasi tidak valid.", accuracy: gps.accuracy };
  }

  const max = MAX_ACCURACY_M();
  if (gps.accuracy > max) {
    return {
      ok: false,
      reason: `Akurasi lokasi terlalu rendah (±${Math.round(gps.accuracy)}m). Coba di area dengan sinyal GPS lebih baik.`,
      accuracy: gps.accuracy,
    };
  }

  const distance = haversine(gps, office);
  if (distance > office.radius) {
    return {
      ok: false,
      distance,
      accuracy: gps.accuracy,
      reason: `Anda berada ${distance} meter dari kantor. Radius yang diizinkan ${office.radius} meter.`,
    };
  }

  return { ok: true, distance, accuracy: gps.accuracy };
}
