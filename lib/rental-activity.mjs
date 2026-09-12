export function bangkokMonth(now = new Date()) {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export function isCurrentRental(record, now = new Date()) {
  return record.status === "ACTIVE" && record.startDate.slice(0, 7) === bangkokMonth(now);
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
