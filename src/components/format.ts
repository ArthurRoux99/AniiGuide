/** Durée lisible : « 42 min », « 5 h 07 », « 3 j 4 h ». */
export function fmtDuration(hours: number | null): string {
  if (hours == null || !isFinite(hours)) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m === 60 ? `${h + 1} h` : `${h} h ${String(m).padStart(2, '0')}`;
  }
  const total = Math.round(hours);
  return `${Math.floor(total / 24)} j ${total % 24} h`;
}

/** Parse « 1:30 », « 1 min 30 », « 90 s » ou « 90 » (secondes). */
export function parseDuration(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (!t) return null;
  const hms = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (hms) return hms[3] ? +hms[1] * 3600 + +hms[2] * 60 + +hms[3] : +hms[1] * 60 + +hms[2];
  let total = 0, found = false;
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(h|min|m|s)?/g)) {
    const v = parseFloat(m[1].replace(',', '.'));
    total += m[2] === 'h' ? v * 3600 : m[2] === 'min' || m[2] === 'm' ? v * 60 : v;
    found = true;
  }
  return found ? total : null;
}
