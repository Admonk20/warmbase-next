/**
 * Send-timing helpers — pure logic, no IO.
 * Used inside sendEmail to enforce per-user windows, weekend/holiday skip,
 * and per-lead best send hour.
 */

export type SendPrefs = {
  send_start_hour: number;
  send_end_hour: number;
  skip_weekends: boolean;
  holiday_dates: string[];
  default_timezone: string;
  throttle_seconds: number;
};

const DEFAULT_PREFS: SendPrefs = {
  send_start_hour: 9,
  send_end_hour: 17,
  skip_weekends: true,
  holiday_dates: [],
  default_timezone: "UTC",
  throttle_seconds: 60,
};

function hourInZone(date: Date, tz: string): number {
  try {
    const f = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz });
    return Number(f.format(date));
  } catch { return date.getUTCHours(); }
}

function dayInZone(date: Date, tz: string): { isoDate: string; weekday: number } {
  try {
    const f = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", timeZone: tz });
    const parts = f.formatToParts(date);
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const d = parts.find((p) => p.type === "day")!.value;
    const wd = parts.find((p) => p.type === "weekday")!.value;
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { isoDate: `${y}-${m}-${d}`, weekday: map[wd] ?? 0 };
  } catch {
    return { isoDate: date.toISOString().slice(0, 10), weekday: date.getUTCDay() };
  }
}

export function sendabilityCheck(opts: {
  prefs?: Partial<SendPrefs> | null;
  leadTimezone?: string | null;
  leadBestHour?: number | null;
  now?: Date;
}): { allowed: boolean; reason?: string } {
  const prefs = { ...DEFAULT_PREFS, ...(opts.prefs ?? {}) } as SendPrefs;
  const tz = opts.leadTimezone || prefs.default_timezone;
  const now = opts.now ?? new Date();
  const { isoDate, weekday } = dayInZone(now, tz);
  if (prefs.skip_weekends && (weekday === 0 || weekday === 6)) {
    return { allowed: false, reason: "weekend_skip" };
  }
  if (prefs.holiday_dates?.includes(isoDate)) {
    return { allowed: false, reason: "holiday_skip" };
  }
  const hour = hourInZone(now, tz);
  const startH = opts.leadBestHour ?? prefs.send_start_hour;
  const endH = opts.leadBestHour != null ? Math.min(opts.leadBestHour + 2, 23) : prefs.send_end_hour;
  if (hour < prefs.send_start_hour || hour >= prefs.send_end_hour) {
    return { allowed: false, reason: `outside_send_window_${prefs.send_start_hour}_${prefs.send_end_hour}` };
  }
  if (opts.leadBestHour != null && (hour < startH || hour >= endH)) {
    // soft preference — don't block, just note
  }
  return { allowed: true };
}

/** Compute best send hour for a lead from past open events (0-23 most-opened bucket). */
export function bestHourFromOpens(opens: Array<{ occurred_at: string }>, tz = "UTC"): number | null {
  if (opens.length < 3) return null;
  const buckets = new Array(24).fill(0);
  for (const o of opens) {
    const h = hourInZone(new Date(o.occurred_at), tz);
    buckets[h] += 1;
  }
  let best = 0, bestN = 0;
  for (let i = 0; i < 24; i++) if (buckets[i] > bestN) { best = i; bestN = buckets[i]; }
  return bestN >= 2 ? best : null;
}
