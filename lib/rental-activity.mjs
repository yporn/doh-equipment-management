export function bangkokDate(now = new Date()) {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function bangkokMonth(now = new Date()) {
  return bangkokDate(now).slice(0, 7);
}

/** True while today falls within the rental's own recorded date range, mirroring `currentRentalSql` — a multi-month contract (e.g. a 1-year lease booked once) stays current for its whole term, not just its start month. */
export function isCurrentRental(record, now = new Date()) {
  if (record.status !== "ACTIVE") return false;
  const today = bangkokDate(now);
  return record.startDate <= today && (!record.expectedReturnDate || record.expectedReturnDate >= today);
}

// Refresh an open page on month changes; focus also covers sleeping/background tabs.
export function watchBangkokMonth(onChange, target = window, now = () => new Date()) {
  let month = bangkokMonth(now());
  const check = () => {
    const next = bangkokMonth(now());
    if (next !== month) {
      month = next;
      onChange();
    }
  };
  const timer = target.setInterval(check, 60_000);
  target.addEventListener("focus", check);
  return () => {
    target.clearInterval(timer);
    target.removeEventListener("focus", check);
  };
}
