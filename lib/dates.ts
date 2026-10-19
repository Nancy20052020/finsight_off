/** UTC calendar dates stored as ISO `YYYY-MM-DD` strings. */

export function parseDay(iso: string): number {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function formatDay(ordinal: number): string {
  const date = new Date(ordinal * 86_400_000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  return formatDay(parseDay(iso) + days);
}

export function daysBetween(start: string, end: string): number {
  return parseDay(end) - parseDay(start);
}

/** Monday = 0, matching pandas `Timestamp.dayofweek`. */
export function weekdayMonday0(iso: string): number {
  const sunday0 = new Date(parseDay(iso) * 86_400_000).getUTCDay();
  return (sunday0 + 6) % 7;
}

export function dayOfMonth(iso: string): number {
  return new Date(parseDay(iso) * 86_400_000).getUTCDate();
}

export function yearMonth(iso: string): { year: number; month: number } {
  const date = new Date(parseDay(iso) * 86_400_000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function makeDay(year: number, month: number, day: number): string {
  return formatDay(Math.floor(Date.UTC(year, month - 1, day) / 86_400_000));
}

export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let cursor = parseDay(start); cursor <= parseDay(end); cursor += 1) {
    days.push(formatDay(cursor));
  }
  return days;
}

export function monthDayLabel(iso: string): string {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${names[month - 1]} ${day}, ${year}`;
}
