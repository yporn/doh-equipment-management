import { fiscalYearOf } from "./rental-history.mjs";

export const disposalLabels = { AWAITING_DISPOSAL: "รอจำหน่าย", DISPOSAL_APPROVED: "อนุมัติจำหน่าย", DISPOSED: "จำหน่ายแล้ว" };

/** @param {unknown} value */
export function validDisposalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** @param {Record<string, unknown>} input */
export function validateDisposal(input) {
  const text = (/** @type {string} */ key) => typeof input[key] === "string" ? input[key].trim() : "";
  const record = {
    machineryCode: text("machineryCode"), proposedDate: text("proposedDate"),
    reason: text("reason"), responsiblePerson: text("responsiblePerson"),
    status: text("status"), approvalDate: text("approvalDate"), note: text("note"),
  };
  if (!record.machineryCode || !validDisposalDate(record.proposedDate) || !record.reason || !record.responsiblePerson || !["AWAITING_DISPOSAL", "DISPOSAL_APPROVED"].includes(record.status)) return { error: "กรุณากรอกข้อมูลเสนอจำหน่ายให้ครบและถูกต้อง" };
  if (Object.values(record).some(value => value.length > 4000)) return { error: "ข้อความยาวเกิน 4,000 ตัวอักษร" };
  if (record.status === "DISPOSAL_APPROVED" && (!validDisposalDate(record.approvalDate) || record.approvalDate < record.proposedDate)) return { error: "กรุณาระบุวันที่อนุมัติให้ถูกต้องและไม่ก่อนวันที่เสนอ" };
  if (record.status === "AWAITING_DISPOSAL") record.approvalDate = "";
  return { record };
}

/**
 * @param {{proposedDate:string,status:string,machineryCode:string,machineryName?:string|null,responsiblePerson:string}} record
 * @param {{query:string,status:string,fiscalYear:string}} filters
 */
export function matchesDisposal(record, filters) {
  const query = filters.query.trim().toLocaleLowerCase("th");
  return (!filters.status || record.status === filters.status) &&
    (!filters.fiscalYear || fiscalYearOf(record.proposedDate) === Number(filters.fiscalYear)) &&
    (!query || [record.machineryCode, record.machineryName, record.responsiblePerson].some(value => value?.toLocaleLowerCase("th").includes(query)));
}
