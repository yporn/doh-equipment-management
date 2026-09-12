import profiles from '../data/rental-rates.json' with { type: 'json' };

export function bangkokToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
}
export function acquisitionInfo(machine) {
  const profile = profiles[machine.code];
  return { acquisitionDate: machine.acquisitionDate ?? profile?.acquisitionDate ?? null,
    standardLifeYears: machine.standardLifeYears ?? profile?.standardLifeYears ?? null };
}
// Compare calendar anniversaries, not rounded ages or 365-day approximations.
export function ageBand(acquisitionDate, standardLifeYears, atDate) {
  if (!validDate(acquisitionDate) || !validDate(atDate) || !Number.isFinite(standardLifeYears) || standardLifeYears <= 0 || atDate < acquisitionDate) return null;
  const start = new Date(`${acquisitionDate}T00:00:00Z`);
  for (let band = 0; band < 3; band++) {
    const months = standardLifeYears * 6 * (band + 1);
    const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth()+1,0)).getUTCDate();
    target.setUTCDate(Math.min(start.getUTCDate(),lastDay));
    if (atDate <= target.toISOString().slice(0,10)) return band;
  }
  // User confirmed that the fourth band continues beyond twice standard life.
  return 3;
}
export function ratesAt(machine, atDate = bangkokToday()) {
  const profile = profiles[machine.code];
  if (!profile) return machine;
  const info = acquisitionInfo(machine);
  const band = ageBand(info.acquisitionDate, info.standardLifeYears, atDate);
  return band === null ? { yearlyRate:null, monthlyRate:null, weeklyRate:null, dailyRate:null, hourlyRate:null } : profile.bands[band];
}
export function rentalRate(machine, rateType, atDate) {
  const key = {DAILY:'dailyRate',WEEKLY:'weeklyRate',MONTHLY:'monthlyRate',YEARLY:'yearlyRate',HOURLY:'hourlyRate'}[rateType];
  return ratesAt(machine,atDate)[key] ?? null;
}
export function currentMachine(machine) {
  return {...machine, ...acquisitionInfo(machine), ...ratesAt(machine), ageBasedRates: Boolean(profiles[machine.code])};
}
