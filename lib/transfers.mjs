import { validDisposalDate } from "./disposals.mjs";
import { fiscalYearOf } from "./rental-history.mjs";

export const transporterTypes = ["61-01", "64-01", "15-01"];
export const departmentChoices = machines => [...new Set(machines.map(machine => machine.currentDepartment?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
export const transporterChoices = machines => machines.filter(machine => transporterTypes.includes(machine.typeCode)).sort((a, b) => transporterTypes.indexOf(a.typeCode) - transporterTypes.indexOf(b.typeCode) || a.code.localeCompare(b.code, "en", { numeric: true }));

export const transferVersion = record => JSON.stringify([record.transferDate, record.transportersJson, record.itemsJson]);

export function matchesTransferHistory(record, filters) {
  const normalize = value => String(value ?? "").trim().toLocaleLowerCase("th");
  const query = normalize(filters.query);
  const searchable = [record.transferDate, ...record.transporters, ...record.items.flatMap(item => [item.machineryCode, item.from.name, item.to.name])];
  return (!query || searchable.some(value => normalize(value).includes(query))) &&
    (!filters.fiscalYear || fiscalYearOf(record.transferDate) === Number(filters.fiscalYear)) &&
    (!filters.month || Number(record.transferDate.slice(5, 7)) === Number(filters.month)) &&
    (!filters.fromDepartment || record.items.some(item => item.from.name.trim() === filters.fromDepartment.trim())) &&
    (!filters.toDepartment || record.items.some(item => item.to.name.trim() === filters.toDepartment.trim()));
}

/** @param {{ transporters: string[], items: { machineryCode: string, from: { kind: string, name: string }, to: { kind: string, name: string } }[] } | null} previous */
export function validateTransfer(input, machines, previous = null) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "ข้อมูลขนย้ายไม่ถูกต้อง" };
  if (!validDisposalDate(input.transferDate)) return { error: "กรุณาระบุวันที่ขนย้ายให้ถูกต้อง" };
  if (!Array.isArray(input.transporters) || !input.transporters.length || input.transporters.length > 100 || !Array.isArray(input.items) || !input.items.length || input.items.length > 100) return { error: "กรุณาเพิ่มรถขนย้ายและเครื่องจักรที่ขนย้ายอย่างน้อย 1 รายการ (สูงสุด 100 รายการ)" };
  const allowed = new Set(transporterChoices(machines).map(machine => machine.code));
  for (const code of previous?.transporters ?? []) allowed.add(code);
  if (input.transporters.some(code => !allowed.has(code))) return { error: "ขนย้ายโดยต้องเลือกจากประเภท 61-01, 64-01 หรือ 15-01 ในบัญชีเครื่องจักร" };
  if (new Set(input.transporters).size !== input.transporters.length) return { error: "เลือกรถขนย้ายซ้ำกัน" };
  const codes = new Set(machines.map(machine => machine.code));
  for (const item of previous?.items ?? []) codes.add(item.machineryCode);
  const departments = new Set(departmentChoices(machines));
  for (const item of previous?.items ?? []) for (const key of ["from", "to"]) if (item[key].kind === "DEPARTMENT") departments.add(item[key].name);
  const items = [];
  const seen = new Set();
  for (const item of input.items) {
    if (!item || !codes.has(item.machineryCode)) return { error: "กรุณาเลือกเครื่องจักรที่ขนย้ายจากบัญชีเครื่องจักร" };
    if (seen.has(item.machineryCode)) return { error: "มีเครื่องจักรที่ขนย้ายซ้ำกันในรายการ" };
    if (input.transporters.includes(item.machineryCode)) return { error: "เครื่องจักรที่ขนย้ายต้องไม่เป็นรถที่ใช้ขนย้ายในรายการเดียวกัน" };
    seen.add(item.machineryCode);
    const locations = {};
    for (const key of ["from", "to"]) {
      const location = item[key];
      if (!location || !["DEPARTMENT", "OTHER"].includes(location.kind) || typeof location.name !== "string" || !location.name.trim() || location.name.trim().length > 300) return { error: "กรุณาเลือกสถานที่จาก–ไป หรือระบุสถานที่อื่นๆ ให้ครบ" };
      const name = location.name.trim();
      if (location.kind === "DEPARTMENT" && !departments.has(name)) return { error: "ไม่พบหน่วยงานที่เลือก กรุณาเลือกใหม่หรือใช้สถานที่อื่นๆ" };
      locations[key] = { kind: location.kind, name };
    }
    if (locations.from.name === locations.to.name) return { error: "สถานที่ต้นทางและปลายทางต้องต่างกัน" };
    items.push({ machineryCode: item.machineryCode, ...locations });
  }
  const transporters = [...new Set([...transporterChoices(machines).map(machine => machine.code), ...(previous?.transporters ?? [])])].filter(code => input.transporters.includes(code));
  return { record: { transferDate: input.transferDate, transporters, items } };
}
