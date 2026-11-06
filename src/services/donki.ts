/**
 * NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information) service.
 * Endpoint: https://api.nasa.gov/DONKI/FLR  (solar flares)
 *
 * - Opt-in only: called when the player presses the button in the Safety screen.
 * - Uses NASA's public DEMO_KEY (rate-limited). Replace with your own key via VITE_NASA_API_KEY.
 * - Results are shown as real historical records and NEVER drive the game's simulated storm.
 * - Any failure (offline, rate limit, timeout) falls back silently to the built-in scenario.
 */
export interface FlareRecord {
  id: string;
  begin: string;
  peak: string | null;
  classType: string;
  source: string | null;
}

const API_KEY = (import.meta.env.VITE_NASA_API_KEY as string | undefined) || 'DEMO_KEY';

export async function fetchRecentFlares(days = 30, timeoutMs = 8000): Promise<FlareRecord[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `https://api.nasa.gov/DONKI/FLR?startDate=${fmt(start)}&endDate=${fmt(end)}&api_key=${API_KEY}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`DONKI ${res.status}`);
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((f: Record<string, unknown>) => ({
        id: String(f.flrID ?? ''),
        begin: String(f.beginTime ?? ''),
        peak: (f.peakTime as string) ?? null,
        classType: String(f.classType ?? '?'),
        source: (f.sourceLocation as string) ?? null,
      }))
      .filter((f) => f.id)
      .sort((a, b) => b.begin.localeCompare(a.begin))
      .slice(0, 6);
  } finally {
    clearTimeout(timer);
  }
}
