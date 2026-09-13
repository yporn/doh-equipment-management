"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppSidebar from "../components/app-sidebar";
import Select from "../components/select";
import { isCurrentRental, watchBangkokMonth } from "../../lib/rental-activity.mjs";
import RentalReport from "./rental-report";
import { ConfirmActionButton, ConfirmSubmitButton } from "../components/confirm-action";
import { fiscalYearOf, matchesRentalHistory, monthlyEquivalentAmount, overlapsCalendarMonth } from "../../lib/rental-history.mjs";
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

export default function RentalsPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
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
      const [machineResponse, rentalResponse] = await Promise.all([
        fetch("/api/machineries"),
        fetch("/api/rentals"),
      ]);
      if (!machineResponse.ok || !rentalResponse.ok) throw new Error();
      setMachines(await machineResponse.json());
      setRentals(await rentalResponse.json());
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
    .reduce((sum, record) => sum + monthlyEquivalentAmount(record), 0);

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
      {showReport && <RentalReport records={filtered} criteria={reportCriteria} month={monthFilter} onClose={() => setShowReport(false)} />}
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
