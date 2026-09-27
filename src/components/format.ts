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
