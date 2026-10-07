/** Business days in transit for standard shipping, on top of dispatch time. */
export const STANDARD_TRANSIT_DAYS = 2;

/** Adds business days (Mon–Fri) to a date. */
export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

export function estimateArrival(dispatchDays: number, transitDays = STANDARD_TRANSIT_DAYS, from = new Date()) {
  return addBusinessDays(from, dispatchDays + transitDays);
}

export const formatArrival = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
