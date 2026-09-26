"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppSidebar from "../components/app-sidebar";
import Select from "../components/select";
import { useAuth } from "../auth-context";
import { isCurrentRental, watchBangkokMonth } from "../../lib/rental-activity.mjs";
import RentalReport from "./rental-report";
import { ConfirmActionButton, ConfirmSubmitButton } from "../components/confirm-action";
import { fiscalYearOf, matchesRentalHistory, monthlyEquivalentAmount, overlapsCalendarMonth, overlapsFiscalYear } from "../../lib/rental-history.mjs";
import { FISCAL_MONTHS, FISCAL_MONTH_LABELS, planStatus, summarizeRentalPlans } from "../../lib/rental-plan.mjs";
import { CENTRAL_RENTER_NAME, createCentralAllocationResolver } from "../../lib/central-rental.mjs";
import { rentalRate, bangkokToday } from "../../lib/age-rates.mjs";

type Machine = {
  code: string;
  name: string;
  status: string;
  currentDepartment: string;
  dailyRate: number;
  weeklyRate: number | null;
  monthlyRate: number | null;
  yearlyRate: number | null;
  acquisitionDate: string | null;
  standardLifeYears: number | null;
};
type Rental = {
  id: string;
  machineryCode: string;
  machineryName: string | null;
  renterName: string;
  startDate: string;
  expectedReturnDate: string;
  returnedDate: string | null;
  duration: number;
  rentalMode: "W" | "M";
  rateType: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  rateAmount: number;
  totalAmount: number;
  approver: string;
  status: "ACTIVE" | "RETURNED";
  note: string | null;
};
type RentalPlan = { id: string; department: string; fiscalYear: number; planAmount: number };
type PlanSummaryEntry = { department: string; plan: number; actual: number; monthly: number[]; remaining: number; percent: number };
type CentralAllocation = { id: string; fiscalYear: number; month: string; project: string };

const thaiDate = (value: string) =>
  new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
const rateLabels = {
  DAILY: "วัน",
  WEEKLY: "สัปดาห์",
  MONTHLY: "เดือน",
  YEARLY: "ปี",
};
const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
// A Thai fiscal year (e.g. 2570) runs Oct 2569 - Sep 2570, so Oct-Dec of that fiscal year fall in the PREVIOUS Buddhist calendar year. Naming the year avoids that ambiguity.
function monthFilterLabel(month: string, fiscalYear: string) {
  if (!month) return "ทุกเดือน";
  const monthName = thaiMonths[Number(month) - 1];
  if (!fiscalYear) return monthName;
  const buddhistYear = Number(month) >= 10 ? Number(fiscalYear) - 1 : Number(fiscalYear);
  return `${monthName} ${buddhistYear}`;
}
function calculateEndDate(
  startDate: string,
  duration: number,
  rateType: keyof typeof rateLabels,
) {
  if (!startDate || duration <= 0) return "";
  const date = new Date(`${startDate}T00:00:00Z`);
  if (rateType === "DAILY") date.setUTCDate(date.getUTCDate() + duration);
  if (rateType === "WEEKLY") date.setUTCDate(date.getUTCDate() + duration * 7);
  if (rateType === "MONTHLY") date.setUTCMonth(date.getUTCMonth() + duration);
  if (rateType === "YEARLY")
    date.setUTCFullYear(date.getUTCFullYear() + duration);
  // The start date counts as the first day of the rental period.
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
function centralMonthlyTotal(members: Rental[], month: string, fiscalYear: string) {
  return members.reduce((sum, member) => sum + (overlapsCalendarMonth(member, month, fiscalYear) ? monthlyEquivalentAmount(member, month, fiscalYear) : 0), 0);
}

function PlanSparkline({ monthly }: { monthly: number[] }) {
  const max = Math.max(...monthly, 1);
  const gap = 3;
  const barWidth = 220 / monthly.length - gap;
  return (
    <svg className="plan-spark" viewBox="0 0 220 28" width="220" height="28" role="img" aria-label="ค่าเช่าแต่ละเดือน">
      {monthly.map((value, index) => {
        const height = value > 0 ? Math.max((value / max) * 22, 2) : 0;
        return (
          <rect key={index} x={index * (barWidth + gap)} y={28 - height} width={barWidth} height={height} rx="1.5" className={value > 0 ? "plan-spark-bar" : "plan-spark-bar-empty"}>
            <title>{FISCAL_MONTH_LABELS[index]}: {value.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท</title>
          </rect>
        );
      })}
    </svg>
  );
}

function PlanRow({ entry, canEdit, expanded, onToggle, onSave }: { entry: PlanSummaryEntry; canEdit: boolean; expanded: boolean; onToggle: () => void; onSave: (department: string, planAmount: number) => Promise<void> }) {
  const [value, setValue] = useState(entry.plan ? String(entry.plan) : "");
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState("");
  useEffect(() => {
    // Plans load asynchronously after this row already mounted at plan: 0 — resync the field
    // once the real saved amount arrives (or changes from elsewhere), without clobbering
    // whatever the user is actively typing (this only fires when the saved plan itself changes).
    setValue(entry.plan ? String(entry.plan) : "");
  }, [entry.plan]);
  const dirty = Number(value || 0) !== entry.plan;
  const status = planStatus(entry.percent);
  const hasPlan = entry.plan > 0;
  async function save() {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) { setRowError("ตัวเลขไม่ถูกต้อง"); return; }
    setSaving(true);
    setRowError("");
    try {
      await onSave(entry.department, amount);
    } catch {
      setRowError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }
  return (
    <tr className={expanded ? "plan-row-expanded" : undefined}>
      <td>
        <button type="button" className="plan-expand-toggle" onClick={onToggle} aria-expanded={expanded}>
          <span className="plan-expand-icon" aria-hidden="true">{expanded ? "▾" : "▸"}</span>
          <strong>{entry.department}</strong>
        </button>
      </td>
      <td className="number">
        {canEdit ? (
          <div className="plan-edit">
            <input type="number" min="0" step="10000" value={value} onChange={(event) => setValue(event.target.value)} aria-label={`แผนค่าเช่าของ ${entry.department}`} />
            {dirty && <button type="button" className="plan-save" disabled={saving} onClick={save}>{saving ? "กำลังบันทึก…" : "บันทึก"}</button>}
          </div>
        ) : entry.plan.toLocaleString("th-TH")}
        {rowError && <span className="plan-row-error">{rowError}</span>}
      </td>
      <td><PlanSparkline monthly={entry.monthly} /></td>
      <td className="number">{entry.actual.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</td>
      <td className={`number${entry.remaining < 0 ? " plan-negative" : ""}`}>{entry.remaining < 0 ? "-" : ""}{Math.abs(entry.remaining).toLocaleString("th-TH", { maximumFractionDigits: 0 })}</td>
      <td>
        {hasPlan ? (
          <div className="plan-pct">
            <div className="plan-pct-track"><div className={`plan-pct-fill plan-pct-fill-${status}`} style={{ width: `${Math.min(entry.percent, 100)}%` }} /></div>
            <span>{entry.percent.toFixed(0)}%</span>
          </div>
        ) : entry.actual > 0 ? <span className="plan-no-plan">ยังไม่ได้ตั้งแผน</span> : "—"}
      </td>
    </tr>
  );
}

function PlanDrillDown({ department, rentals, resolveDepartment, fiscalYear, mode, monthIndex, onModeChange, onMonthChange }: {
  department: string;
  rentals: Rental[];
  resolveDepartment: (record: Rental, monthIndex: number, fiscalYear: string) => string;
  fiscalYear: string;
  mode: "year" | "month";
  monthIndex: number;
  onModeChange: (mode: "year" | "month") => void;
  onMonthChange: (index: number) => void;
}) {
  const rows = useMemo(() => {
    return rentals
      .map((record) => {
        const monthly = FISCAL_MONTHS.map((month, index) =>
          resolveDepartment(record, index, fiscalYear).trim() === department && overlapsCalendarMonth(record, month, fiscalYear)
            ? monthlyEquivalentAmount(record, month, fiscalYear)
            : 0);
        const amount = mode === "year" ? monthly.reduce((sum, value) => sum + value, 0) : monthly[monthIndex];
        return { record, amount };
      })
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [rentals, resolveDepartment, fiscalYear, department, mode, monthIndex]);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <tr className="plan-drilldown-row">
      <td colSpan={6}>
        <div className="plan-drilldown">
          <div className="rental-toggle">
            <div className="segmented" role="group" aria-label={`ช่วงเวลาที่แสดงรายการเครื่องจักรของ ${department}`}>
              <button type="button" className={mode === "year" ? "seg-btn active" : "seg-btn"} onClick={() => onModeChange("year")}>ทั้งปีงบประมาณ</button>
              <button type="button" className={mode === "month" ? "seg-btn active" : "seg-btn"} onClick={() => onModeChange("month")}>รายเดือน</button>
            </div>
            {mode === "month" && (
              <select className="month-select" aria-label="เลือกเดือน" value={monthIndex} onChange={(event) => onMonthChange(Number(event.target.value))}>
                {FISCAL_MONTHS.map((_, index) => (
                  <option key={index} value={index}>{FISCAL_MONTH_LABELS[index]}</option>
                ))}
              </select>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="detail-note">ไม่มีรายการเครื่องจักรของ &quot;{department}&quot; ในช่วงเวลานี้</p>
          ) : (
            <table className="plan-drilldown-table">
              <thead>
                <tr>
                  <th>รหัสเครื่องจักร</th>
                  <th>รายละเอียด</th>
                  <th>ผู้เช่า</th>
                  <th>ระยะเวลาสัญญา</th>
                  <th className="number">ค่าเช่า (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ record, amount }) => (
                  <tr key={record.id}>
                    <td className="machine-code">{record.machineryCode}</td>
                    <td>{record.machineryName ?? "—"}</td>
                    <td>
                      {record.renterName}
                      {record.renterName.trim() === CENTRAL_RENTER_NAME && department !== CENTRAL_RENTER_NAME && (
                        <span className="plan-drilldown-badge">จัดสรรจากส่วนกลาง</span>
                      )}
                    </td>
                    <td className="plan-drilldown-duration">{thaiDate(record.startDate)} – {thaiDate(record.expectedReturnDate)}</td>
                    <td className="number">{amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="number">รวม</td>
                  <td className="number">{total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </td>
    </tr>
  );
}

function AllocationRow({ label, amount, current, projectOptions, canEdit, onSave }: { label: string; amount: number; current: string; projectOptions: string[]; canEdit: boolean; onSave: (project: string) => Promise<void> }) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState("");
  useEffect(() => { setValue(current); }, [current]);
  async function handleChange(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);
    setRowError("");
    try {
      await onSave(next);
    } catch {
      setValue(previous);
      setRowError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }
  return (
    <tr>
      <td>{label}</td>
      <td>
        {canEdit ? (
          <>
            <Select ariaLabel={`โครงการของเดือน ${label}`} value={value} onChange={handleChange} options={projectOptions.map((name) => ({ value: name, label: name }))} menuPortal />
            {saving && <span className="muted"> กำลังบันทึก…</span>}
            {rowError && <span className="plan-row-error">{rowError}</span>}
          </>
        ) : value}
      </td>
      <td className="number">{amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท</td>
    </tr>
  );
}

function CentralAllocationModal({ centralRentals, allocations, projectOptions, planFiscalYear, currentFiscalYear, currentFiscalMonthIndex, canEdit, onClose, onSave }: {
  centralRentals: Rental[];
  allocations: CentralAllocation[];
  projectOptions: string[];
  planFiscalYear: string;
  currentFiscalYear: string;
  currentFiscalMonthIndex: number;
  canEdit: boolean;
  onClose: () => void;
  onSave: (fiscalYear: number, month: string, project: string) => Promise<void>;
}) {
  const reachedCount = Number(planFiscalYear) < Number(currentFiscalYear) ? FISCAL_MONTHS.length
    : Number(planFiscalYear) > Number(currentFiscalYear) ? 0
      : currentFiscalMonthIndex + 1;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <section className="modal rental-modal" role="dialog" aria-modal="true" aria-labelledby="allocate-central-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" aria-label="ปิด" onClick={onClose}>×</button>
        <p className="eyebrow">จัดสรรค่าเช่ารายเดือน</p>
        <h2 id="allocate-central-title">ค่าเช่าส่วนกลาง</h2>
        <p className="detail-note">{centralRentals.length.toLocaleString("th-TH")} เครื่องจักร ที่เช่าโดย &quot;{CENTRAL_RENTER_NAME}&quot; · ปีงบประมาณ {planFiscalYear}</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>รหัส</th><th>รายละเอียด</th><th>ระยะเวลา</th><th className="number">ค่าเช่ารวม</th></tr></thead>
            <tbody>
              {centralRentals.map((record) => (
                <tr key={record.id}>
                  <td><strong className="machine-code">{record.machineryCode}</strong></td>
                  <td>{record.machineryName ?? "—"}</td>
                  <td>{thaiDate(record.startDate)} – {thaiDate(record.expectedReturnDate)}</td>
                  <td className="number">{record.totalAmount.toLocaleString("th-TH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="detail-note">จัดสรรตามเดือน — เลือกโครงการจะมีผลกับค่าเช่าส่วนกลางทั้งหมดในเดือนนั้น</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>เดือน</th><th>โครงการที่รับภาระค่าเช่า</th><th className="number">รวมค่าเช่าส่วนกลาง/เดือน</th></tr></thead>
            <tbody>
              {FISCAL_MONTHS.map((month, index) => {
                if (index >= reachedCount) {
                  return (
                    <tr key={month}>
                      <td>{FISCAL_MONTH_LABELS[index]}</td>
                      <td className="muted">ยังไม่ถึงเดือนนี้ — จัดสรรได้เมื่อใกล้ถึง</td>
                      <td className="number muted">—</td>
                    </tr>
                  );
                }
                const amount = centralMonthlyTotal(centralRentals, month, planFiscalYear);
                const current = allocations.find((allocation) => allocation.month === month)?.project ?? CENTRAL_RENTER_NAME;
                return (
                  <AllocationRow
                    key={month}
                    label={FISCAL_MONTH_LABELS[index]}
                    amount={amount}
                    current={current}
                    projectOptions={projectOptions}
                    canEdit={canEdit}
                    onSave={(project) => onSave(Number(planFiscalYear), month, project)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function RentalsPage() {
  const { user } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [rentalPlans, setRentalPlans] = useState<RentalPlan[]>([]);
  const [centralAllocations, setCentralAllocations] = useState<CentralAllocation[]>([]);
  const [showCentralAllocation, setShowCentralAllocation] = useState(false);
  const [centralCostMode, setCentralCostMode] = useState<"year" | "month">("year");
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fiscalYearFilter, setFiscalYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [machineryFilter, setMachineryFilter] = useState("");
  const [rentalModeFilter, setRentalModeFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Rental | null>(null);
  const [machineCode, setMachineCode] = useState("");
  const [rentalMode, setRentalMode] = useState<"W" | "M">("W");
  const [rateType, setRateType] = useState<keyof typeof rateLabels>("DAILY");
  const [startDate, setStartDate] = useState(
    bangkokToday(),
  );
  const [duration, setDuration] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [machineResponse, rentalResponse, planResponse, allocationResponse] = await Promise.all([
        fetch("/api/machineries"),
        fetch("/api/rentals"),
        fetch("/api/rental-plans"),
        fetch("/api/central-rental-allocations"),
      ]);
      if (!machineResponse.ok || !rentalResponse.ok || !planResponse.ok || !allocationResponse.ok) throw new Error();
      setMachines(await machineResponse.json());
      setRentals(await rentalResponse.json());
      setRentalPlans(await planResponse.json());
      setCentralAllocations(await allocationResponse.json());
    } catch {
      setError("ไม่สามารถโหลดข้อมูลระบบเช่าได้ กรุณาลองใหม่อีกครั้ง");
    } finally { setLoading(false); }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    return watchBangkokMonth(() => { void loadData(); });
  }, []);


  const rentalDepartments = useMemo(
    () => [...new Set(machines.map((machine) => machine.currentDepartment?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "th")),
    [machines],
  );
  const filtered = useMemo(() => {
    return rentals.filter((record) => matchesRentalHistory(record, {
      query, fiscalYear: fiscalYearFilter, month: monthFilter, machinery: machineryFilter, rentalMode: rentalModeFilter, department: departmentFilter,
    }));
  }, [query, rentals, fiscalYearFilter, monthFilter, machineryFilter, rentalModeFilter, departmentFilter]);
  const fiscalYears = useMemo(
    () => {
      const years = new Set<number>();
      for (const record of rentals) {
        const startYear = fiscalYearOf(record.startDate);
        const endYear = record.expectedReturnDate ? fiscalYearOf(record.expectedReturnDate) : startYear;
        for (let year = startYear; year <= endYear; year++) years.add(year);
      }
      return [...years].sort((a, b) => b - a);
    },
    [rentals],
  );
  const rentalMachines = useMemo(
    () => [...new Set(rentals.map((record) => record.machineryCode))].sort(),
    [rentals],
  );
  function resetFilters() {
    setDepartmentFilter("");
    setQuery("");
    setFiscalYearFilter("");
    setMonthFilter("");
    setMachineryFilter("");
    setRentalModeFilter("");
  }
  const reportDepartments = [...new Set(rentals.map(record => record.renterName.trim()))].sort((a, b) => a.localeCompare(b, "th"));
  const reportCriteria = [
    fiscalYearFilter ? `ปีงบประมาณ ${fiscalYearFilter}` : "ทุกปีงบประมาณ",
    monthFilterLabel(monthFilter, fiscalYearFilter),
    departmentFilter ? `หน่วยงานผู้เช่า: ${departmentFilter}` : "ทุกหน่วยงานผู้เช่า",
    machineryFilter ? `เครื่องจักร: ${machineryFilter}` : "",
    rentalModeFilter === "W" ? "W-เช่าใช้งาน" : rentalModeFilter === "M" ? "M-ขอใช้งาน" : "",
    query ? `คำค้น: ${query}` : "",
  ].filter(Boolean).join(" • ");
  const activeCount = new Set(rentals.filter(record => isCurrentRental(record)).map(record => record.machineryCode)).size;
  const availableCount = new Set(machines.filter(machine => !rentals.some(record => record.machineryCode === machine.code && isCurrentRental(record))).map(machine => machine.code)).size;
  const today = bangkokToday();
  const currentMonthNumber = String(Number(today.slice(5, 7)));
  const currentFiscalYear = String(fiscalYearOf(today));
  // Follow the selected month filter when set, otherwise default to the current real month.
  const summaryMonth = monthFilter || currentMonthNumber;
  const summaryFiscalYear = monthFilter ? fiscalYearFilter : currentFiscalYear;
  const summaryMonthLabel = monthFilter ? monthFilterLabel(monthFilter, fiscalYearFilter) : "เดือนนี้";
  const monthlyIncomeEstimate = rentals
    .filter((record) => overlapsCalendarMonth(record, summaryMonth, summaryFiscalYear))
    .reduce((sum, record) => sum + monthlyEquivalentAmount(record, summaryMonth, summaryFiscalYear), 0);

  // The plan-vs-actual panel follows the fiscal year filter when set, otherwise the current one.
  const planFiscalYear = fiscalYearFilter || currentFiscalYear;
  const centralResolver = useMemo(() => createCentralAllocationResolver(centralAllocations), [centralAllocations]);
  const planSummary: PlanSummaryEntry[] = useMemo(
    () => summarizeRentalPlans(rentals, rentalPlans, planFiscalYear, centralResolver),
    [rentals, rentalPlans, planFiscalYear, centralResolver],
  );
  async function saveRentalPlan(department: string, planAmount: number) {
    const response = await fetch("/api/rental-plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department, fiscalYear: Number(planFiscalYear), planAmount }),
    });
    if (!response.ok) throw new Error("Unable to save rental plan");
    const saved = await response.json() as RentalPlan;
    setRentalPlans((previous) => {
      const others = previous.filter((plan) => !(plan.department === department && String(plan.fiscalYear) === String(planFiscalYear)));
      return [...others, saved];
    });
  }

  const currentFiscalMonthIndex = FISCAL_MONTHS.indexOf(String(Number(today.slice(5, 7))));
  const [centralCostMonthIndex, setCentralCostMonthIndex] = useState(currentFiscalMonthIndex);
  const [centralFiscalYear, setCentralFiscalYear] = useState(currentFiscalYear);
  const [expandedPlanDepartment, setExpandedPlanDepartment] = useState<string | null>(null);
  const [planDrillMode, setPlanDrillMode] = useState<"year" | "month">("year");
  const [planDrillMonthIndex, setPlanDrillMonthIndex] = useState(currentFiscalMonthIndex);
  useEffect(() => { setExpandedPlanDepartment(null); }, [planFiscalYear]);
  const centralRentals = useMemo(
    () => rentals.filter((record) => record.renterName.trim() === CENTRAL_RENTER_NAME && overlapsFiscalYear(record, centralFiscalYear)),
    [rentals, centralFiscalYear],
  );
  const centralCostReachedCount = Number(centralFiscalYear) < Number(currentFiscalYear) ? FISCAL_MONTHS.length
    : Number(centralFiscalYear) > Number(currentFiscalYear) ? 0
      : currentFiscalMonthIndex + 1;
  const centralYearTotal = FISCAL_MONTHS.slice(0, centralCostReachedCount)
    .reduce((sum, month) => sum + centralMonthlyTotal(centralRentals, month, centralFiscalYear), 0);
  const centralMonthTotal = centralCostMonthIndex < centralCostReachedCount
    ? centralMonthlyTotal(centralRentals, FISCAL_MONTHS[centralCostMonthIndex], centralFiscalYear)
    : 0;
  const centralAllocatedCount = centralAllocations.filter((allocation) => String(allocation.fiscalYear) === String(centralFiscalYear)).length;
  async function saveCentralAllocation(fiscalYear: number, month: string, project: string) {
    const response = await fetch("/api/central-rental-allocations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscalYear, month, project }),
    });
    if (!response.ok) throw new Error("ไม่สามารถบันทึกการจัดสรรค่าเช่าส่วนกลางได้");
    const saved = await response.json() as CentralAllocation;
    setCentralAllocations((previous) => {
      const others = previous.filter((allocation) => !(String(allocation.fiscalYear) === String(fiscalYear) && allocation.month === month));
      return [...others, saved];
    });
  }

  function suggestedRate(code = machineCode, type = rateType) {
    const machine = machines.find((item) => item.code === code);
    return machine ? rentalRate(machine, type, startDate) : null;
  }
  const samePricing = editing && editing.machineryCode === machineCode && editing.startDate === startDate && editing.rateType === rateType && editing.rentalMode === rentalMode;
  const rateAmount = rentalMode === "M" ? 0 : samePricing ? editing.rateAmount : suggestedRate();
  function chooseMachine(value: string) {
    setMachineCode(value);
  }
  function chooseRateType(value: keyof typeof rateLabels) {
    setRateType(value);
  }
  function openCreate() {
    setMachineCode("");
    setRentalMode("W");
    setRateType("DAILY");
    setStartDate(bangkokToday());
    setDuration(1);
    setError("");
    setShowCreate(true);
  }
  function openEdit(record: Rental) {
    setEditing(record);
    setMachineCode(record.machineryCode);
    setRentalMode(record.rentalMode);
    setRateType(record.rateType);
    setStartDate(record.startDate);
    setDuration(record.duration);
    setError("");
  }

  async function createRental(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/rentals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          machineryCode: machineCode,
          renterName: form.get("renterName"),
          rentalMode,
          startDate,
          duration,
          rateType,
          rateAmount: rentalMode === "M" ? 0 : rateAmount,
          approver: form.get("approver"),
          note: form.get("note"),
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "ไม่สามารถบันทึกได้");
      setShowCreate(false);
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกได้");
    } finally {
      setIsSaving(false);
    }
  }
  async function updateRental(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setIsSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/rentals", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "EDIT",
          id: editing.id,
          renterName: form.get("renterName"),
          rentalMode,
          startDate,
          duration,
          rateType,
          rateAmount: rentalMode === "M" ? 0 : rateAmount,
          approver: form.get("approver"),
          note: form.get("note"),
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "ไม่สามารถแก้ไขได้");
      setEditing(null);
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถแก้ไขได้");
    } finally {
      setIsSaving(false);
    }
  }
  async function deleteRental(record: Rental) {
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/rentals", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: record.id }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "ไม่สามารถลบได้");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถลบได้");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <datalist id="rental-departments">
        {rentalDepartments.map((department) => (
          <option key={department} value={department} />
        ))}
      </datalist>
      <AppSidebar active="rentals" />
      {showReport && <RentalReport records={filtered} criteria={reportCriteria} month={monthFilter} fiscalYear={fiscalYearFilter} onClose={() => setShowReport(false)} />}
      <section className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">การนำเครื่องจักรไปใช้งาน</p>
            <h1>ระบบเช่าเครื่องจักร</h1>
          </div>
          <div className="top-actions">
            <button className="primary" onClick={openCreate}>
              ＋ บันทึกการเช่า
            </button>
          </div>
        </header>
        <div className="content rental-content">
          <section className="stats-grid rental-stats">
            <article className="stat-card">
              <span>เช่า/ขอใช้งานเดือนนี้</span>
              <strong>{activeCount.toLocaleString("th-TH")}</strong>
              <small>เครื่อง</small>
            </article>
            <article className="stat-card">
              <span>ไม่มีรายการเช่าเดือนนี้</span>
              <strong>{availableCount.toLocaleString("th-TH")}</strong>
              <small>เครื่อง</small>
            </article>
            <article className="stat-card">
              <span>ประวัติทั้งหมด</span>
              <strong>{rentals.length.toLocaleString("th-TH")}</strong>
              <small>รายการ</small>
            </article>
            <article className="stat-card">
              <span>ประมาณการรายได้ค่าเช่า{monthFilter ? ` ${summaryMonthLabel}` : "เดือนนี้"}</span>
              <strong>{monthlyIncomeEstimate.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</strong>
              <small>บาท</small>
            </article>
          </section>
          <section className="panel plan-panel">
            <div className="panel-heading">
              <div>
                <h2>สรุปเทียบแผนงบประมาณ · ปีงบประมาณ {planFiscalYear}</h2>
                <p>แยกตามหน่วยงาน/โครงการที่เช่า (เลือกปีงบประมาณอื่นได้จากตัวกรองด้านล่าง)</p>
              </div>
            </div>
            {planSummary.length === 0 ? (
              <div className="empty-state"><strong>ยังไม่มีข้อมูลแผนหรือค่าเช่าของปีนี้</strong><span>เริ่มตั้งแผนค่าเช่าได้จากตารางด้านล่างหลังมีข้อมูล</span></div>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>หน่วยงาน/โครงการที่เช่า</th>
                        <th className="number">แผนค่าเช่า (บาท)</th>
                        <th>ค่าเช่าแต่ละเดือน (ต.ค.–ก.ย.)</th>
                        <th className="number">ค่าเช่ารวม</th>
                        <th className="number">ค่าเช่าที่เหลือ</th>
                        <th>% ที่ใช้ไป</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planSummary.map((entry) => (
                        <Fragment key={entry.department}>
                          <PlanRow
                            entry={entry}
                            canEdit={user?.role === "ADMIN"}
                            expanded={expandedPlanDepartment === entry.department}
                            onToggle={() => setExpandedPlanDepartment((current) => current === entry.department ? null : entry.department)}
                            onSave={saveRentalPlan}
                          />
                          {expandedPlanDepartment === entry.department && (
                            <PlanDrillDown
                              department={entry.department}
                              rentals={rentals}
                              resolveDepartment={centralResolver}
                              fiscalYear={planFiscalYear}
                              mode={planDrillMode}
                              monthIndex={planDrillMonthIndex}
                              onModeChange={setPlanDrillMode}
                              onMonthChange={setPlanDrillMonthIndex}
                            />
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>ค่าเช่าส่วนกลาง</h2>
                <p>เครื่องจักรที่เช่าโดย &quot;{CENTRAL_RENTER_NAME}&quot; จัดสรรค่าเช่ารายเดือนไปยังโครงการต่างๆ ได้โดยตรง ไม่ต้องแยกรายการ</p>
              </div>
              {centralRentals.length > 0 && (
                <button type="button" className="secondary" onClick={() => setShowCentralAllocation(true)}>จัดสรรค่าเช่า →</button>
              )}
            </div>
            {centralRentals.length === 0 ? (
              <div className="empty-state">
                <strong>ยังไม่มีรายการเช่าโดย &quot;{CENTRAL_RENTER_NAME}&quot;</strong>
                <span>เมื่อมีการบันทึกเช่าโดย &quot;{CENTRAL_RENTER_NAME}&quot; จะจัดสรรค่าเช่ารายเดือนได้จากที่นี่</span>
              </div>
            ) : (
              <>
                <div className="rental-toggle">
                  <div className="segmented" role="group" aria-label="ช่วงเวลาที่แสดงค่าเช่ารวม">
                    <button type="button" className={centralCostMode === "year" ? "seg-btn active" : "seg-btn"} onClick={() => setCentralCostMode("year")}>รายปี (ต.ค.–ปัจจุบัน)</button>
                    <button type="button" className={centralCostMode === "month" ? "seg-btn active" : "seg-btn"} onClick={() => setCentralCostMode("month")}>รายเดือน</button>
                  </div>
                  <Select
                    ariaLabel="เลือกปีงบประมาณของค่าเช่าส่วนกลาง"
                    className="filter-select"
                    value={centralFiscalYear}
                    onChange={setCentralFiscalYear}
                    options={fiscalYears.map((year) => ({ value: String(year), label: `ปีงบประมาณ ${year}` }))}
                  />
                  {centralCostMode === "month" && (
                    <select className="month-select" aria-label="เลือกเดือน" value={centralCostMonthIndex} onChange={(event) => setCentralCostMonthIndex(Number(event.target.value))}>
                      {FISCAL_MONTHS.slice(0, centralCostReachedCount).map((_, index) => (
                        <option key={index} value={index}>{FISCAL_MONTH_LABELS[index]}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="rental-total">
                  <strong>{(centralCostMode === "year" ? centralYearTotal : centralMonthTotal).toLocaleString("th-TH", { maximumFractionDigits: 0 })}</strong>
                  <span>บาท {centralCostMode === "year" ? `ปีงบประมาณ ${centralFiscalYear} (ต.ค.–ปัจจุบัน)` : FISCAL_MONTH_LABELS[centralCostMonthIndex]}</span>
                </div>
                <div className="rental-group-list">
                  <div className="rental-group-card">
                    <div className="rental-group-main">
                      <span>{centralRentals.length.toLocaleString("th-TH")} เครื่องจักร</span>
                      <div className="rental-group-chips">
                        {centralRentals.map((record) => <span className="rental-group-chip" key={record.id}>{record.machineryCode}</span>)}
                      </div>
                    </div>
                    <span className={`rental-group-status ${centralCostReachedCount > 0 && centralAllocatedCount >= centralCostReachedCount ? "done" : "pending"}`}>
                      {centralCostReachedCount === 0 ? "ยังไม่ถึงปีงบประมาณนี้" : centralAllocatedCount >= centralCostReachedCount ? "จัดสรรครบทุกเดือนที่ถึงแล้ว" : `จัดสรรแล้ว ${centralAllocatedCount}/${centralCostReachedCount} เดือน`}
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>ประวัติการเช่า</h2>
                <p>กรองปีงบประมาณและเดือนตามวันที่เริ่มเช่า (ปีงบประมาณ: ตุลาคม–กันยายน)</p>
              </div>
              <label className="search">
                <span>⌕</span>
                <input
                  aria-label="ค้นหาประวัติการเช่า"
                  placeholder="ค้นหาเครื่องจักร หน่วยงาน หรือผู้บันทึกข้อมูล"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="service-history-filters rental-history-filters">
              <label>
                ปีงบประมาณ
                <Select ariaLabel="กรองตามปีงบประมาณ" value={fiscalYearFilter} onChange={setFiscalYearFilter} options={[{ value: "", label: "ทุกปีงบประมาณ" }, ...fiscalYears.map((year) => ({ value: String(year), label: `ปีงบประมาณ ${year}` }))]} />
              </label>
              <label>
                เดือน
                <Select ariaLabel="กรองตามเดือน" value={monthFilter} onChange={setMonthFilter} options={[{ value: "", label: "ทุกเดือน" }, ...thaiMonths.map((month, index) => ({ value: String(index + 1), label: month }))]} />
              </label>
              <label>
                หมายเลขเครื่องจักร
                <Select ariaLabel="กรองตามหมายเลขเครื่องจักร" isSearchable isClearable placeholder="พิมพ์หมายเลขเครื่องจักร" value={machineryFilter} onChange={setMachineryFilter} options={rentalMachines.map((code) => ({ value: code, label: code }))} />
              </label>
              <label>
                ประเภทการเช่า
                <Select ariaLabel="กรองตามประเภทการเช่า" value={rentalModeFilter} onChange={setRentalModeFilter} options={[{ value: "", label: "ทุกประเภทการเช่า" }, { value: "W", label: "W-เช่าใช้งาน" }, { value: "M", label: "M-ขอใช้งาน" }]} />
              </label>
              <label>หน่วยงาน/โครงการที่เช่า<Select ariaLabel="กรองตามหน่วยงานที่เช่า" isSearchable value={departmentFilter} onChange={setDepartmentFilter} options={[{ value: "", label: "ทุกหน่วยงานที่เช่า" }, ...reportDepartments.map(name => ({ value: name, label: name }))]} /></label>
              <button type="button" onClick={resetFilters}>ล้างตัวกรอง</button>
              <button type="button" className="report-button" disabled={loading || isSaving || Boolean(error)} onClick={() => setShowReport(true)}>พิมพ์รายงาน</button>
            </div>
            <p className="detail-note">สถานะเช่าอ้างอิงเดือนของวันเริ่มเช่า เมื่อขึ้นเดือนใหม่แล้วไม่มีรายการเช่าและไม่มีงานซ่อมค้าง จะเป็นพร้อมใช้งาน (ว่าง) โดยคงสถานะจำหน่ายไว้</p>
            <p className="detail-note">หน่วยงานผู้เช่าแยกจากที่อยู่เครื่องจักร การบันทึกเช่าไม่เปลี่ยนที่อยู่ ให้บันทึกการขนย้ายเมื่อมีการย้ายจริง</p>
            <p className="rental-filter-summary" role="status">พบ {filtered.length.toLocaleString("th-TH")} จาก {rentals.length.toLocaleString("th-TH")} รายการ</p>
            {error && !showCreate && !editing && (
              <p className="page-error" role="alert">
                {error}
              </p>
            )}
            <div className="table-wrap rental-table">
              <table>
                <thead>
                  <tr>
                    <th>เครื่องจักร</th>
                    <th>หน่วยงาน/โครงการที่เช่า</th>
                    <th>ระยะเวลาเช่า</th>
                    <th>อัตราค่าเช่า</th>
                    <th>ประเภทการเช่า</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong className="machine-code">
                          {record.machineryCode}
                        </strong>
                        <span className="muted">
                          {record.machineryName ?? "—"}
                        </span>
                      </td>
                      <td>
                        <strong>{record.renterName}</strong>
                        <span className="muted">
                          บันทึกโดย {record.approver}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {thaiDate(record.startDate)} –{" "}
                          {thaiDate(
                            record.returnedDate ?? record.expectedReturnDate,
                          )}
                        </strong>
                        <span className="muted">
                          {record.returnedDate ? "คืนจริง" : "กำหนดคืน"}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {record.totalAmount.toLocaleString("th-TH")} บาท
                        </strong>
                        <span className="muted">
                          {record.rentalMode === "M"
                            ? "M · ไม่คิดค่าเช่า"
                            : `W · ${record.duration} ${rateLabels[record.rateType]} × ${record.rateAmount.toLocaleString("th-TH")} บาท`}
                        </span>
                      </td>
                      <td>
                        <span className={`status status-condition-${record.rentalMode}`}>
                          {record.rentalMode === "M" ? "M-ขอใช้งาน" : "W-เช่าใช้งาน"}
                        </span>
                      </td>
                      <td>
                        <div className="service-row-actions">
                          <button
                            className="secondary compact-action"
                            onClick={() => openEdit(record)}
                          >
                            แก้ไข
                          </button>
                          <ConfirmActionButton className="danger-button compact-action" title="ยืนยันการลบข้อมูล" message={`ต้องการลบรายการเช่าของ ${record.renterName} ใช่หรือไม่?${record.status === "ACTIVE" ? " ระบบจะปรับสถานะและหน่วยงานผู้เช่าตามรายการที่ยังเหลืออยู่" : ""}`} confirmLabel="ยืนยันการลบ" onConfirm={() => deleteRental(record)}>ลบ</ConfirmActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="empty-state">
                  <strong>{rentals.length ? "ไม่พบประวัติการเช่าตามตัวกรอง" : "ยังไม่มีประวัติการเช่า"}</strong>
                  <span>{rentals.length ? "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง" : "เริ่มต้นด้วยการบันทึกการเช่าครั้งแรก"}</span>
                  {rentals.length > 0 && <button type="button" onClick={resetFilters}>ล้างตัวกรอง</button>}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
      {showCentralAllocation && (
        <CentralAllocationModal
          centralRentals={centralRentals}
          allocations={centralAllocations.filter((allocation) => String(allocation.fiscalYear) === String(centralFiscalYear))}
          projectOptions={reportDepartments}
          planFiscalYear={centralFiscalYear}
          currentFiscalYear={currentFiscalYear}
          currentFiscalMonthIndex={currentFiscalMonthIndex}
          canEdit={user?.role === "ADMIN"}
          onClose={() => setShowCentralAllocation(false)}
          onSave={saveCentralAllocation}
        />
      )}
      {showCreate && (
        <div className="modal-backdrop">
          <section
            className="modal rental-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rental-title"
          >
            <button
              className="modal-close"
              onClick={() => setShowCreate(false)}
              aria-label="ปิด"
            >
              ×
            </button>
            <p className="eyebrow">สร้างรายการใหม่</p>
            <h2 id="rental-title">บันทึกการเช่าเครื่องจักร</h2>
            <form onSubmit={createRental}>
              <div className="form-grid">
                <label className="wide">
                  เครื่องจักรในบัญชี (เลือกได้ทุกสถานะ)
                  <input
                    required
                    list="rental-machineries"
                    value={machineCode}
                    onChange={(event) => chooseMachine(event.target.value)}
                    placeholder="พิมพ์หมายเลขหรือเลือกเครื่องจักร"
                    autoComplete="off"
                  />
                  <datalist id="rental-machineries">
                    {machines.map((machine) => (
                      <option value={machine.code} key={machine.code}>
                        {machine.name}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label className="wide">
                  หน่วยงาน/โครงการที่เช่า
                  <input
                    name="renterName"
                    required
                    list="rental-departments"
                    autoComplete="off"
                    placeholder="เลือกหรือพิมพ์หน่วยงานผู้เช่า"
                  />
                </label>
                <label className="wide">
                  ประเภทการเช่า
                  <select
                    name="rentalMode"
                    value={rentalMode}
                    onChange={(event) =>
                      setRentalMode(event.target.value as "W" | "M")
                    }
                  >
                    <option value="W">W-เช่าใช้งาน</option>
                    <option value="M">M-ขอใช้งาน</option>
                  </select>
                </label>
                <label>
                  วันที่เริ่มเช่า
                  <input
                    name="startDate"
                    type="date"
                    required
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </label>
                <label className="wide">
                  ระยะเวลา
                  <div className="rental-duration-field">
                    <input
                      name="duration"
                      aria-label="จำนวนระยะเวลา"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={duration}
                      onChange={(event) =>
                        setDuration(Math.max(1, Number(event.target.value)))
                      }
                    />
                    <select
                      aria-label="หน่วยระยะเวลา"
                      value={rateType}
                      onChange={(event) =>
                        chooseRateType(
                          event.target.value as keyof typeof rateLabels,
                        )
                      }
                    >
                      <option value="DAILY">วัน</option>
                      <option value="WEEKLY">สัปดาห์</option>
                      <option value="MONTHLY">เดือน</option>
                      <option value="YEARLY">ปี</option>
                    </select>
                  </div>
                </label>
                <label>
                  อัตราค่าเช่าต่อหน่วย (บาท)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    readOnly
                    aria-readonly="true"
                    value={rateAmount ?? ""}
                  />
                </label>
                <div className="rental-calculation wide">
                  <div>
                    <span>วันสิ้นสุด</span>
                    <strong>
                      {calculateEndDate(startDate, duration, rateType)
                        ? thaiDate(
                            calculateEndDate(startDate, duration, rateType),
                          )
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>ค่าเช่ารวม</span>
                    <strong>
                      {(rentalMode === "M"
                        ? 0
                        : duration * Number(rateAmount || 0)
                      ).toLocaleString("th-TH")}{" "}
                      บาท
                    </strong>
                  </div>
                </div>
                <label className="wide">
                  ผู้บันทึกข้อมูล
                  <input name="approver" required />
                </label>
              </div>
              <label className="form-note">
                หมายเหตุ
                <textarea name="note" rows={3} />
              </label>
              {rateAmount === null && <p className="form-error">ไม่มีอัตราค่าเช่าสำหรับหน่วยหรือวันที่เลือก กรุณาเลือกหน่วยอื่นหรือตรวจสอบวันที่จัดหา</p>}
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowCreate(false)}
                >
                  ยกเลิก
                </button>
                <ConfirmSubmitButton title="ยืนยันการเพิ่มข้อมูล" message="ต้องการเพิ่มรายการเช่านี้เข้าสู่ระบบใช่หรือไม่?" confirmLabel="ยืนยันการเพิ่ม" disabled={isSaving || rateAmount === null}>
                  {isSaving ? "กำลังบันทึก…" : "ยืนยันการเช่า"}
                </ConfirmSubmitButton>
              </div>
            </form>
          </section>
        </div>
      )}
      {editing && (
        <div className="modal-backdrop">
          <section
            className="modal rental-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-rental-title"
          >
            <button
              className="modal-close"
              onClick={() => setEditing(null)}
              aria-label="ปิด"
            >
              ×
            </button>
            <p className="eyebrow">{editing.machineryCode}</p>
            <h2 id="edit-rental-title">แก้ไขรายการเช่า</h2>
            <form onSubmit={updateRental}>
              <div className="form-grid">
                <label className="wide">
                  เครื่องจักร
                  <input
                    value={editing.machineryCode}
                    readOnly
                    aria-readonly="true"
                  />
                </label>
                <label className="wide">
                  หน่วยงาน/โครงการที่เช่า
                  <input
                    name="renterName"
                    required
                    list="rental-departments"
                    autoComplete="off"
                    placeholder="เลือกหรือพิมพ์หน่วยงานผู้เช่า"
                    defaultValue={editing.renterName}
                  />
                </label>
                <label className="wide">
                  ประเภทการเช่า
                  <select
                    name="rentalMode"
                    value={rentalMode}
                    onChange={(event) =>
                      setRentalMode(event.target.value as "W" | "M")
                    }
                  >
                    <option value="W">W-เช่าใช้งาน</option>
                    <option value="M">M-ขอใช้งาน</option>
                  </select>
                </label>
                <label>
                  วันที่เริ่มเช่า
                  <input
                    name="startDate"
                    type="date"
                    required
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </label>
                <label className="wide">
                  ระยะเวลา
                  <div className="rental-duration-field">
                    <input
                      name="duration"
                      aria-label="จำนวนระยะเวลาแก้ไข"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={duration}
                      onChange={(event) =>
                        setDuration(Math.max(1, Number(event.target.value)))
                      }
                    />
                    <select
                      aria-label="หน่วยระยะเวลาแก้ไข"
                      value={rateType}
                      onChange={(event) =>
                        chooseRateType(
                          event.target.value as keyof typeof rateLabels,
                        )
                      }
                    >
                      <option value="DAILY">วัน</option>
                      <option value="WEEKLY">สัปดาห์</option>
                      <option value="MONTHLY">เดือน</option>
                      <option value="YEARLY">ปี</option>
                    </select>
                  </div>
                </label>
                <label>
                  อัตราค่าเช่าต่อหน่วย (บาท)
                  <input
                    type="number"
                    readOnly
                    aria-readonly="true"
                    value={rateAmount ?? ""}
                  />
                </label>
                <div className="rental-calculation wide">
                  <div>
                    <span>วันสิ้นสุด</span>
                    <strong>
                      {thaiDate(
                        calculateEndDate(startDate, duration, rateType),
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>ค่าเช่ารวม</span>
                    <strong>
                      {(rentalMode === "M"
                        ? 0
                        : duration * Number(rateAmount || 0)
                      ).toLocaleString("th-TH")}{" "}
                      บาท
                    </strong>
                  </div>
                </div>
                <label className="wide">
                  ผู้บันทึกข้อมูล
                  <input
                    name="approver"
                    required
                    defaultValue={editing.approver}
                  />
                </label>
              </div>
              <label className="form-note">
                หมายเหตุ
                <textarea
                  name="note"
                  rows={3}
                  defaultValue={editing.note ?? ""}
                />
              </label>
              {rateAmount === null && <p className="form-error">ไม่มีอัตราค่าเช่าสำหรับหน่วยหรือวันที่เลือก กรุณาเลือกหน่วยอื่นหรือตรวจสอบวันที่จัดหา</p>}
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(null)}
                >
                  ยกเลิก
                </button>
                <ConfirmSubmitButton title="ยืนยันการแก้ไข" message="ต้องการบันทึกการเปลี่ยนแปลงรายการเช่านี้ใช่หรือไม่?" confirmLabel="ยืนยันการแก้ไข" disabled={isSaving || rateAmount === null}>
                  {isSaving ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
                </ConfirmSubmitButton>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
