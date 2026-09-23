"use client";

import { watchBangkokMonth } from "../lib/rental-activity.mjs";
import { FormEvent, useEffect, useMemo, useState } from "react";
import registry from "../data/machineries.json";
import { currentMachine, bangkokToday } from "../lib/age-rates.mjs";
import { fiscalYearOf } from "../lib/rental-history.mjs";
import { FISCAL_MONTHS, FISCAL_MONTH_LABELS, summarizeRentalPlans } from "../lib/rental-plan.mjs";
import { categorizeRentalCost, createCentralAllocationResolver } from "../lib/central-rental.mjs";
import AppSidebar from "./components/app-sidebar";
import { ConfirmSubmitButton } from "./components/confirm-action";
import Select from "./components/select";
import MachineryReport from "./machinery-report";

type MachineryStatus =
  | "AVAILABLE"
  | "RENTED"
  | "IN_SERVICE"
  | "UNDER_REPAIR"
  | "INACTIVE";
type MachineryCondition = "W" | "M" | "AVAILABLE" | "DAMAGED" | "MAINTENANCE" | "AWAITING_DISPOSAL" | "DISPOSAL_APPROVED";
type RecentTransfer = { id: string; transferDate: string; transporters: string[]; items: { machineryCode: string; from: { name: string }; to: { name: string } }[] };
type RecentService = { id: string; machineryCode: string; machineryName: string | null; serviceDate: string; items: { description: string }[] };
type RepairSummary = { id: string; machineryCode: string; machineryName: string | null; repairDate: string; symptom: string; status: "WAITING" | "WAITING_PARTS" | "IN_PROGRESS" | "COMPLETED" };
type DashboardRental = { renterName: string; startDate: string; expectedReturnDate: string; rateType: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"; duration: number; totalAmount: number };
type CentralAllocation = { fiscalYear: number; month: string; project: string };
type RentalPlan = { department: string; fiscalYear: number; planAmount: number };
type CostCategory = "central" | "yearly" | "monthly";
const costCategoryMeta: Record<CostCategory, { label: string; className: string }> = {
  central: { label: "ส่วนกลาง", className: "cost-cat-central" },
  yearly: { label: "สัญญาเช่ารายปี", className: "cost-cat-yearly" },
  monthly: { label: "สัญญาเช่ารายเดือน", className: "cost-cat-monthly" },
};
function scopedMonthlyTotal(monthly: number[], mode: "fy" | "month", monthIndex: number, reachedCount: number) {
  return mode === "fy" ? monthly.slice(0, reachedCount).reduce((sum, value) => sum + value, 0) : monthly[monthIndex];
}
const repairStatusLabels: Record<RepairSummary["status"], string> = { WAITING: "รอตรวจสอบ", WAITING_PARTS: "รออะไหล่", IN_PROGRESS: "กำลังซ่อม", COMPLETED: "ซ่อมเสร็จแล้ว" };
type Machine = {
  id?: string;
  code: string;
  typeCode: string | null;
  name: string;
  brand: string;
  model: string | null;
  engineModel?: string | null;
  registrationNumber?: string | null;
  serialNumber: string;
  department: string;
  owningDepartment: string | null;
  leasingDepartment?: string | null;
  renterDepartment?: string | null;
  currentDepartment: string;
  condition: MachineryCondition;
  status: MachineryStatus;
  repairStatus?: "NONE" | "ACTIVE";
  acquiredYear: number | null;
  acquisitionDate?: string | null;
  standardLifeYears?: number | null;
  ageBasedRates?: boolean;
  fuelRate?: number | null;
  fuelUnit?: string | null;
  fuelConsumption?: string | null;
  purchasePrice: number | null;
  utilization2563?: number | null;
  utilization2564?: number | null;
  utilization2565?: number | null;
  yearlyRate: number | null;
  monthlyRate: number | null;
  weeklyRate: number | null;
  dailyRate: number | null;
  hourlyRate: number | null;
  note?: string | null;
  source?: string | null;
};

const conditionLabels: Record<MachineryCondition, string> = {
  W: "W — เช่าใช้งาน",
  M: "M — ขอใช้งาน",
  AVAILABLE: "พร้อมใช้งาน (ว่าง)",
  DAMAGED: "ชำรุด",
  MAINTENANCE: "ซ่อมบำรุง",
  AWAITING_DISPOSAL: "รอจำหน่าย",
  DISPOSAL_APPROVED: "อนุมัติจำหน่าย",
};
const editableConditionLabels = Object.entries(conditionLabels).filter(([value]) => value !== "MAINTENANCE");
type RegistryColumnKey = "owning" | "leasing" | "current" | "renter" | "status";
const registryColumnLabels: Record<RegistryColumnKey, string> = {
  owning: "ต้นสังกัด",
  leasing: "ศูนย์ผู้ให้เช่า",
  current: "หน่วยงาน/โครงการที่เครื่องจักรอยู่",
  renter: "หน่วยงาน/โครงการที่เช่า",
  status: "สถานะ",
};
const registryColumnOptions = Object.entries(registryColumnLabels).map(([value, label]) => ({ value, label }));
function registryColumnCell(key: RegistryColumnKey, machine: Machine) {
  switch (key) {
    case "owning": return machine.owningDepartment || "—";
    case "leasing": return machine.leasingDepartment || "—";
    case "current": return machine.currentDepartment;
    case "renter": return machine.renterDepartment || "—";
    case "status": return (
      <div className="status-stack">
        {(machine.repairStatus !== "ACTIVE" || machine.condition === "W" || machine.condition === "M") && <span className={`status status-condition-${machine.condition === "MAINTENANCE" ? "AVAILABLE" : machine.condition}`}>{conditionLabels[machine.condition === "MAINTENANCE" ? "AVAILABLE" : machine.condition]}</span>}
        {machine.repairStatus === "ACTIVE" && <span className="status status-repair">ซ่อมบำรุง</span>}
      </div>
    );
  }
}
const statusOfCondition = (condition: MachineryCondition): MachineryStatus =>
  condition === "W" || condition === "M" ? "RENTED" : condition === "MAINTENANCE" ? "UNDER_REPAIR" : condition === "AWAITING_DISPOSAL" || condition === "DISPOSAL_APPROVED" ? "INACTIVE" : "AVAILABLE";
const initialMachines: Machine[] = registry.map((item) => ({
  ...item,
  serialNumber: "",
  department: item.currentDepartment,
  acquiredYear: null,
  source: "เวิร์กบุ๊ก1.xlsx — สภาพเครื่องจักร (2 ก.ย. 2569)",
})).map(currentMachine) as Machine[];
const acquisitionLabel = (value?: string | null) => value ? new Intl.DateTimeFormat("th-TH", {dateStyle:"medium"}).format(new Date(`${value}T00:00:00`)) : "—";

export function EquipmentApp({
  registryOnly = false,
}: {
  registryOnly?: boolean;
}) {
  const [machines, setMachines] = useState(initialMachines);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | MachineryCondition>("ALL");
  const [typeCode, setTypeCode] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [sort, setSort] = useState("code");
  const [registryColumns, setRegistryColumns] = useState<[RegistryColumnKey, RegistryColumnKey, RegistryColumnKey]>(["current", "renter", "status"]);
  const [selected, setSelected] = useState<Machine | null>(null);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [formError, setFormError] = useState("");
  const [dataError, setDataError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [repairsInProgress, setRepairsInProgress] = useState<RepairSummary[] | null>(null);
  const [disposalCounts, setDisposalCounts] = useState<{ pending: number; approved: number } | null>(null);
  const [dashboardRentals, setDashboardRentals] = useState<DashboardRental[] | null>(null);
  const [centralAllocations, setCentralAllocations] = useState<CentralAllocation[]>([]);
  const [rentalPlans, setRentalPlans] = useState<RentalPlan[]>([]);
  const today = bangkokToday();
  const currentFiscalYear = fiscalYearOf(today);
  const currentFiscalMonthIndex = FISCAL_MONTHS.indexOf(String(Number(today.slice(5, 7))));
  const [costMode, setCostMode] = useState<"fy" | "month">("fy");
  const [costMonthIndex, setCostMonthIndex] = useState(currentFiscalMonthIndex);
  const [recentTransfers, setRecentTransfers] = useState<RecentTransfer[] | null>(null);
  const [recentServices, setRecentServices] = useState<RecentService[] | null>(null);
  useEffect(() => {
    const reload = () => fetch("/api/machineries")
      .then(async (response) => {
        if (!response.ok) throw new Error("load failed");
        setMachines((await response.json()) as Machine[]);
      })
      .catch(() =>
        setDataError(
          "กำลังใช้ข้อมูลตัวอย่าง เนื่องจากยังเชื่อมฐานข้อมูลไม่ได้",
        ),
      );
    void reload();
    return watchBangkokMonth(() => { void reload(); });
  }, []);
  useEffect(() => {
    if (registryOnly) return;
    let active = true;
    Promise.all([
      fetch("/api/repairs").then((response) => (response.ok ? response.json() : [])),
      fetch("/api/disposals").then((response) => (response.ok ? response.json() : [])),
      fetch("/api/rentals").then((response) => (response.ok ? response.json() : [])),
      fetch("/api/transfers").then((response) => (response.ok ? response.json() : [])),
      fetch("/api/services").then((response) => (response.ok ? response.json() : [])),
      fetch("/api/central-rental-allocations").then((response) => (response.ok ? response.json() : [])),
      fetch("/api/rental-plans").then((response) => (response.ok ? response.json() : [])),
    ])
      .then(([repairs, disposals, rentals, transfers, services, allocations, plans]: [
        RepairSummary[],
        { status: string }[],
        DashboardRental[],
        RecentTransfer[],
        RecentService[],
        CentralAllocation[],
        RentalPlan[],
      ]) => {
        if (!active) return;
        setRepairsInProgress(repairs.filter((item) => item.status !== "COMPLETED").sort((a, b) => b.repairDate.localeCompare(a.repairDate)));
        setDisposalCounts({
          pending: disposals.filter((item) => item.status === "AWAITING_DISPOSAL").length,
          approved: disposals.filter((item) => item.status === "DISPOSAL_APPROVED").length,
        });
        setDashboardRentals(rentals);
        setCentralAllocations(allocations);
        setRentalPlans(plans);
        setRecentTransfers(transfers.slice(0, 3));
        setRecentServices(services.slice(0, 3));
      })
      .catch(() => { /* leave the dashboard panels empty if any of these fail */ });
    return () => { active = false; };
  }, [registryOnly]);
  const departments = useMemo(
    () =>
      Array.from(
        new Set(machines.map((item) => item.currentDepartment)),
      ).sort(),
    [machines],
  );
  const typeCodes = useMemo(
    () => Array.from(new Set(machines.map((item) => item.typeCode).filter((item): item is string => Boolean(item)))).sort((a, b) => a.localeCompare(b, "th")),
    [machines],
  );
  const stats = useMemo(() => {
    const count = (value: MachineryStatus) =>
      machines.filter((item) => value === "UNDER_REPAIR" ? item.repairStatus === "ACTIVE" : item.status === value && (value !== "AVAILABLE" || item.repairStatus !== "ACTIVE")).length;
    return [
      {
        label: "เครื่องจักรทั้งหมด",
        value: machines.length.toLocaleString("th-TH"),
        tone: "navy",
        note: "ข้อมูลจากทะเบียนล่าสุด",
      },
      {
        label: "พร้อมใช้งาน",
        value: count("AVAILABLE").toLocaleString("th-TH"),
        tone: "green",
        note: "คำนวณจากทะเบียนในระบบ",
      },
      {
        label: "กำลังเช่า",
        value: count("RENTED").toLocaleString("th-TH"),
        tone: "blue",
        note: "รอปรับสถานะจากเอกสารเช่าปัจจุบัน",
      },
      {
        label: "ซ่อม / Service",
        value: (count("IN_SERVICE") + count("UNDER_REPAIR")).toLocaleString(
          "th-TH",
        ),
        tone: "orange",
        note: "จากสถานะที่ยืนยันแล้ว",
      },
    ];
  }, [machines]);
  const centralResolver = useMemo(() => createCentralAllocationResolver(centralAllocations), [centralAllocations]);
  const rentalCostByDepartment = useMemo(
    () => summarizeRentalPlans(dashboardRentals ?? [], rentalPlans, currentFiscalYear, centralResolver),
    [dashboardRentals, rentalPlans, currentFiscalYear, centralResolver],
  );
  const rentalCostRows = useMemo(() => {
    const rows = rentalCostByDepartment
      .map((entry) => ({
        department: entry.department,
        plan: entry.plan,
        amount: costMode === "fy"
          ? entry.monthly.slice(0, currentFiscalMonthIndex + 1).reduce((sum, value) => sum + value, 0)
          : entry.monthly[costMonthIndex],
      }))
      .filter((row) => row.amount > 0)
      .map((row) => ({ ...row, planPercent: row.plan > 0 ? (row.amount / row.plan) * 100 : Infinity }))
      .sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return { rows, total };
  }, [rentalCostByDepartment, costMode, costMonthIndex, currentFiscalMonthIndex]);
  const rentalsByCostCategory = useMemo(() => {
    const groups: Record<CostCategory, DashboardRental[]> = { central: [], yearly: [], monthly: [] };
    for (const record of dashboardRentals ?? []) groups[categorizeRentalCost(record)].push(record);
    return groups;
  }, [dashboardRentals]);
  const costCategorySummaries = useMemo(() => ({
    central: summarizeRentalPlans(rentalsByCostCategory.central, [], currentFiscalYear, centralResolver),
    yearly: summarizeRentalPlans(rentalsByCostCategory.yearly, [], currentFiscalYear, centralResolver),
    monthly: summarizeRentalPlans(rentalsByCostCategory.monthly, [], currentFiscalYear, centralResolver),
  }), [rentalsByCostCategory, currentFiscalYear, centralResolver]);
  const costCategoryTotals = useMemo(() => {
    const totals: Record<CostCategory, number> = { central: 0, yearly: 0, monthly: 0 };
    (Object.keys(costCategorySummaries) as CostCategory[]).forEach((category) => {
      totals[category] = costCategorySummaries[category].reduce((sum, entry) => sum + scopedMonthlyTotal(entry.monthly, costMode, costMonthIndex, currentFiscalMonthIndex + 1), 0);
    });
    return totals;
  }, [costCategorySummaries, costMode, costMonthIndex, currentFiscalMonthIndex]);
  const departmentCategoryAmounts = useMemo(() => {
    const map = new Map<string, Record<CostCategory, number>>();
    for (const department of rentalCostByDepartment.map((entry) => entry.department)) {
      const amounts: Record<CostCategory, number> = { central: 0, yearly: 0, monthly: 0 };
      (Object.keys(costCategorySummaries) as CostCategory[]).forEach((category) => {
        const entry = costCategorySummaries[category].find((row) => row.department === department);
        amounts[category] = entry ? scopedMonthlyTotal(entry.monthly, costMode, costMonthIndex, currentFiscalMonthIndex + 1) : 0;
      });
      map.set(department, amounts);
    }
    return map;
  }, [rentalCostByDepartment, costCategorySummaries, costMode, costMonthIndex, currentFiscalMonthIndex]);
  function fiscalMonthLabel(index: number) {
    const monthNumber = Number(FISCAL_MONTHS[index]);
    const buddhistYear = monthNumber >= 10 ? currentFiscalYear - 1 : currentFiscalYear;
    return `${FISCAL_MONTH_LABELS[index]} ${buddhistYear}`;
  }
  const filteredMachines = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("th");
    return machines
      .filter((machine) => {
        const searchable = [
          machine.code,
          machine.typeCode,
          machine.name,
          machine.brand,
          machine.model,
          machine.engineModel,
          machine.registrationNumber,
          machine.currentDepartment,
          machine.owningDepartment,
          machine.serialNumber,
        ]
          .join(" ")
          .toLocaleLowerCase("th");
        return (
          (!keyword || searchable.includes(keyword)) &&
          (status === "ALL" || (status === "MAINTENANCE" ? machine.repairStatus === "ACTIVE" : machine.condition === status)) &&
          (typeCode === "ALL" || machine.typeCode === typeCode) &&
          (department === "ALL" || machine.currentDepartment === department)
        );
      })
      .sort((a, b) =>
        sort === "name"
            ? a.name.localeCompare(b.name, "th")
            : a.code.localeCompare(b.code),
      );
  }, [department, machines, query, sort, status, typeCode]);
  const pageCount = Math.max(1, Math.ceil(filteredMachines.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedMachines = filteredMachines.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const displayedMachines = registryOnly
    ? paginatedMachines
    : filteredMachines.slice(0, 5);

  async function createMachine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = String(data.get("code") ?? "").trim();
    if (machines.some((machine) => machine.code === code)) {
      setFormError("หมายเลขเครื่องจักรนี้มีอยู่ในระบบแล้ว");
      return;
    }
    const currentDepartment = String(
      data.get("currentDepartment") ?? "",
    ).trim();
    const input: Machine = {
      code,
      typeCode: String(data.get("typeCode") ?? "").trim() || null,
      name: String(data.get("name") ?? "").trim(),
      brand: String(data.get("brand") ?? "")
        .trim()
        .toUpperCase(),
      model: String(data.get("model") ?? "").trim() || null,
      engineModel: String(data.get("engineModel") ?? "").trim() || null,
      registrationNumber:
        String(data.get("registrationNumber") ?? "").trim() || null,
      serialNumber: String(data.get("serialNumber") ?? "").trim(),
      department: currentDepartment,
      owningDepartment:
        String(data.get("owningDepartment") ?? "").trim() || currentDepartment,
      leasingDepartment:
        String(data.get("leasingDepartment") ?? "").trim() || null,
      currentDepartment,
      condition: String(data.get("condition")) as MachineryCondition,
      status: statusOfCondition(String(data.get("condition")) as MachineryCondition),
      dailyRate: Number(data.get("dailyRate")),
      acquiredYear: Number(data.get("year")) || null,
      acquisitionDate: String(data.get("acquisitionDate") ?? "") || null,
      standardLifeYears: Number(data.get("standardLifeYears")) || null,
      purchasePrice: Number(data.get("purchasePrice")) || null,
      yearlyRate: Number(data.get("yearlyRate")) || null,
      monthlyRate: Number(data.get("monthlyRate")) || null,
      weeklyRate: Number(data.get("weeklyRate")) || null,
      hourlyRate: Number(data.get("hourlyRate")) || null,
    };
    setIsSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/machineries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as Machine & { message?: string };
      if (!response.ok) {
        setFormError(result.message ?? "ไม่สามารถบันทึกข้อมูลได้");
        return;
      }
      setMachines((current) => [result, ...current]);
      setShowCreate(false);
      setSelected(result);
    } catch {
      setFormError("เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  }
  async function updateMachine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const numberValue = (name: string) =>
      value(name) === "" ? null : Number(value(name));
    const input = {
      ...editing,
      typeCode: value("typeCode") || null,
      name: value("name"),
      brand: value("brand").toUpperCase(),
      model: value("model") || null,
      engineModel: value("engineModel") || null,
      registrationNumber: value("registrationNumber") || null,
      serialNumber: value("serialNumber"),
      acquiredYear: numberValue("acquiredYear"),
      acquisitionDate: value("acquisitionDate") || null,
      standardLifeYears: numberValue("standardLifeYears"),
      owningDepartment: value("owningDepartment"),
      leasingDepartment: value("leasingDepartment") || null,
      currentDepartment: value("currentDepartment"),
      department: value("currentDepartment"),
      purchasePrice: numberValue("purchasePrice"),
      condition: value("condition") as MachineryCondition,
      status: statusOfCondition(value("condition") as MachineryCondition),
      yearlyRate: numberValue("yearlyRate"),
      monthlyRate: numberValue("monthlyRate"),
      weeklyRate: numberValue("weeklyRate"),
      dailyRate: Number(value("dailyRate")),
      hourlyRate: numberValue("hourlyRate"),
      note: value("note") || null,
    };
    setIsSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/machineries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as Machine & { message?: string };
      if (!response.ok) {
        setFormError(result.message ?? "ไม่สามารถแก้ไขข้อมูลได้");
        return;
      }
      setMachines((current) =>
        current.map((machine) =>
          machine.code === result.code ? result : machine,
        ),
      );
      setEditing(null);
      setSelected(result);
    } catch {
      setFormError("เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  }
  function resetFilters() {
    setQuery("");
    setStatus("ALL");
    setTypeCode("ALL");
    setDepartment("ALL");
    setSort("code");
    setPage(1);
  }
  const machineryReportCriteria = [
    typeCode !== "ALL" ? `รหัสประเภท: ${typeCode}` : "ทุกรหัสประเภท",
    department !== "ALL" ? `หน่วยงาน: ${department}` : "ทุกหน่วยงาน",
    status !== "ALL" ? `สถานะ: ${conditionLabels[status]}` : "สถานะทั้งหมด",
    query ? `คำค้น: ${query}` : "",
  ].filter(Boolean).join(" • ");

  return (
    <>
    <main className={`app-shell ${registryOnly ? "registry-view" : ""}`}>
      <AppSidebar active={registryOnly ? "machineries" : "dashboard"} />
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">ศูนย์สร้างทางขอนแก่น</p>
            <h1>{registryOnly ? "บัญชีเครื่องจักร" : "ภาพรวมเครื่องจักร"}</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="การแจ้งเตือน">
              ♢<span className="dot" />
            </button>
            <button className="primary" onClick={() => setShowCreate(true)}>
              ＋ เพิ่มเครื่องจักร
            </button>
          </div>
        </header>
        <div className="content" id="dashboard">
          {dataError && (
            <div className="data-warning" role="status">
              {dataError}
            </div>
          )}
          {!registryOnly && (
            <section className="stats-grid" aria-label="ข้อมูลสรุป">
              {stats.map((item) => (
                <article className={`stat-card ${item.tone}`} key={item.label}>
                  <div className="stat-icon">●</div>
                  <div>
                    <p>{item.label}</p>
                    <strong>{item.value}</strong>
                    <span>{item.note}</span>
                  </div>
                </article>
              ))}
            </section>
          )}
          <section className="panel" id="machinery" hidden={!registryOnly}>
            <div className="panel-heading">
              <div>
                <h2>
                  {registryOnly
                    ? "ทะเบียนเครื่องจักรทั้งหมด"
                    : "บัญชีเครื่องจักรล่าสุด"}
                </h2>
                <p>
                  พบ {filteredMachines.length} รายการจากทะเบียนทั้งหมด{" "}
                  {machines.length} รายการ
                </p>
              </div>
              {registryOnly ? (
                <div className="service-row-actions">
                  <button className="secondary" onClick={resetFilters}>
                    ล้างตัวกรอง
                  </button>
                  <button className="secondary" onClick={() => setShowReport(true)}>
                    พิมพ์รายงาน
                  </button>
                </div>
              ) : (
                <a className="secondary button-link" href="/machineries">
                  ดูทั้งหมด {machines.length} รายการ →
                </a>
              )}
            </div>
            <div className="toolbar" hidden={!registryOnly}>
              <label className="search">
                <span>⌕</span>
                <input
                  aria-label="ค้นหาเครื่องจักร"
                  placeholder="ค้นหารหัส ชื่อ ยี่ห้อ หรือหน่วยงาน"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className="toolbar-select">
                <Select
                  ariaLabel="กรองตามรหัสประเภท"
                  className="filter-select"
                  value={typeCode}
                  onChange={setTypeCode}
                  options={[
                    { value: "ALL", label: "รหัสประเภททั้งหมด" },
                    ...typeCodes.map((item) => ({ value: item, label: item })),
                  ]}
                />
              </div>
              <div className="toolbar-select">
                <Select
                  ariaLabel="กรองตามหน่วยงาน"
                  className="filter-select"
                  isSearchable
                  value={department}
                  onChange={setDepartment}
                  options={[
                    { value: "ALL", label: "ทุกหน่วยงาน" },
                    ...departments.map((item) => ({ value: item, label: item })),
                  ]}
                />
              </div>
              <div className="toolbar-select">
                <Select
                  ariaLabel="กรองตามสถานะ"
                  className="filter-select"
                  value={status}
                  onChange={(value) => setStatus(value as "ALL" | MachineryCondition)}
                  options={[
                    { value: "ALL", label: "สถานะทั้งหมด" },
                    ...Object.entries(conditionLabels).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
              <div className="toolbar-select">
                <Select
                  ariaLabel="เรียงข้อมูล"
                  className="filter-select"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "code", label: "เรียงตามรหัส" },
                    { value: "name", label: "เรียงตามชื่อ" },
                  ]}
                />
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>หมายเลขเครื่องจักร</th>
                    <th>รหัสประเภท</th>
                    <th>รายละเอียด</th>
                    {registryColumns.map((column, index) => (
                      <th key={index} className="registry-column-head">
                        <Select
                          ariaLabel={`เลือกคอลัมน์ที่ ${index + 1}`}
                          className="registry-column-select"
                          value={column}
                          onChange={(value) => setRegistryColumns((columns) => {
                            const next = [...columns] as typeof columns;
                            next[index] = value as RegistryColumnKey;
                            return next;
                          })}
                          options={registryColumnOptions}
                          menuPortal
                        />
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {displayedMachines.map((machine) => (
                    <tr key={machine.code}>
                      <td>
                        <strong className="machine-code">{machine.code}</strong>
                      </td>
                      <td><strong>{machine.typeCode || "—"}</strong></td>
                      <td>
                        <strong>{machine.name}</strong>
                        <span className="muted">
                          {machine.brand} {machine.model}
                        </span>
                      </td>
                      {registryColumns.map((column, index) => (
                        <td key={index}>{registryColumnCell(column, machine)}</td>
                      ))}
                      <td>
                        <button
                          className="row-action"
                          aria-label={`ดู ${machine.code}`}
                          onClick={() => setSelected(machine)}
                        >
                          ›
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredMachines.length === 0 && (
                <div className="empty-state">
                  <strong>ไม่พบเครื่องจักร</strong>
                  <span>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</span>
                  <button onClick={resetFilters}>ล้างตัวกรอง</button>
                </div>
              )}
            </div>
            {registryOnly && filteredMachines.length > 0 && (
              <div className="pagination">
                <span>
                  รายการ {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, filteredMachines.length)} จาก{" "}
                  {filteredMachines.length}
                </span>
                <label>
                  แสดง
                  <select
                    value={pageSize}
                    onChange={(event) =>
                      setPageSize(Number(event.target.value))
                    }
                  >
                    <option>10</option>
                    <option>20</option>
                    <option>50</option>
                  </select>
                  รายการ
                </label>
                <div>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    ‹ ก่อนหน้า
                  </button>
                  <strong>
                    {page} / {pageCount}
                  </strong>
                  <button
                    disabled={page === pageCount}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    ถัดไป ›
                  </button>
                </div>
              </div>
            )}
          </section>
          {!registryOnly && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>ค่าเช่ารวมตามโครงการ</h2>
                  <p>
                    {costMode === "fy"
                      ? `ตุลาคม ${currentFiscalYear - 1} – ปัจจุบัน (${acquisitionLabel(today)}) · ปีงบประมาณ ${currentFiscalYear}`
                      : `${fiscalMonthLabel(costMonthIndex)} · ปีงบประมาณ ${currentFiscalYear}`}
                  </p>
                </div>
                <a className="secondary button-link" href="/rentals">
                  ดูสรุปเทียบแผนงบประมาณ →
                </a>
              </div>
              <div className="rental-toggle">
                <div className="segmented" role="group" aria-label="ช่วงเวลาที่แสดง">
                  <button type="button" className={costMode === "fy" ? "seg-btn active" : "seg-btn"} onClick={() => setCostMode("fy")}>ปีงบประมาณ (ต.ค.–ปัจจุบัน)</button>
                  <button type="button" className={costMode === "month" ? "seg-btn active" : "seg-btn"} onClick={() => setCostMode("month")}>รายเดือน</button>
                </div>
                {costMode === "month" && (
                  <select className="month-select" aria-label="เลือกเดือน" value={costMonthIndex} onChange={(event) => setCostMonthIndex(Number(event.target.value))}>
                    {FISCAL_MONTHS.slice(0, currentFiscalMonthIndex + 1).map((_, index) => (
                      <option key={index} value={index}>{fiscalMonthLabel(index)}</option>
                    ))}
                  </select>
                )}
              </div>
              {dashboardRentals === null ? (
                <p className="detail-note">กำลังโหลด…</p>
              ) : rentalCostRows.rows.length === 0 ? (
                <div className="empty-state">
                  <strong>ยังไม่มีค่าเช่าในช่วงที่เลือก</strong>
                </div>
              ) : (
                <>
                  <div className="rental-total">
                    <strong>{rentalCostRows.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</strong>
                    <span>บาท จาก {rentalCostRows.rows.length.toLocaleString("th-TH")} โครงการที่เช่าเครื่องจักร</span>
                  </div>
                  <div className="rental-cost-breakdown">
                    {(Object.keys(costCategoryMeta) as CostCategory[]).map((category) => (
                      <div
                        key={category}
                        className={`rental-cost-segment ${costCategoryMeta[category].className}`}
                        style={{ width: `${rentalCostRows.total ? (costCategoryTotals[category] / rentalCostRows.total) * 100 : 0}%` }}
                      />
                    ))}
                  </div>
                  <div className="rental-cost-legend">
                    {(Object.keys(costCategoryMeta) as CostCategory[]).map((category) => (
                      <div className="rental-cost-legend-item" key={category}>
                        <span className={`rental-cost-dot ${costCategoryMeta[category].className}`} />
                        <div>
                          <strong>{costCategoryMeta[category].label}</strong>
                          <span>
                            {costCategoryTotals[category].toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท ·{" "}
                            {(rentalCostRows.total ? (costCategoryTotals[category] / rentalCostRows.total) * 100 : 0).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rental-rows">
                    {rentalCostRows.rows.map((row) => {
                      const categoryAmounts = departmentCategoryAmounts.get(row.department) ?? { central: 0, yearly: 0, monthly: 0 };
                      const hasPlan = row.plan > 0;
                      const filledPercent = hasPlan ? Math.min(row.planPercent, 100) : 100;
                      return (
                        <div className="rental-row-block" key={row.department}>
                          <div className="rental-row">
                            <div className="rental-row-name" title={row.department}>{row.department}</div>
                            <div className="rental-track">
                              <div className="rental-fill-group" style={{ width: `${filledPercent}%` }}>
                                {(Object.keys(costCategoryMeta) as CostCategory[]).map((category) => {
                                  const amount = categoryAmounts[category];
                                  if (amount <= 0) return null;
                                  return (
                                    <span
                                      key={category}
                                      className={`rental-fill-segment ${costCategoryMeta[category].className}`}
                                      style={{ width: `${(amount / row.amount) * 100}%` }}
                                      title={`${costCategoryMeta[category].label}: ${amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                            <div className="rental-amount">{row.amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท</div>
                            <div className="rental-pct" title={hasPlan ? undefined : "ยังไม่ได้ตั้งแผนค่าเช่า"}>{hasPlan ? `${row.planPercent.toFixed(0)}%` : "—"}</div>
                          </div>
                          <div className="rental-row-breakdown">
                            {(Object.keys(costCategoryMeta) as CostCategory[]).map((category) => {
                              const amount = categoryAmounts[category];
                              if (amount <= 0) return null;
                              return (
                                <span className="rental-row-breakdown-item" key={category}>
                                  <span className={`rental-cost-dot ${costCategoryMeta[category].className}`} />
                                  {costCategoryMeta[category].label} {amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          )}
          <div className="lower-grid">
            <section className="panel compact">
              <div className="panel-heading">
                <div>
                  <h2>งานซ่อมบำรุงที่กำลังดำเนินการ</h2>
                  <p>{repairsInProgress ? `${repairsInProgress.length.toLocaleString("th-TH")} รายการที่ยังไม่เสร็จสิ้น` : "กำลังโหลด…"}</p>
                </div>
                <a className="secondary button-link" href="/repairs">
                  ดูทั้งหมด →
                </a>
              </div>
              {(repairsInProgress ?? []).map((record) => (
                <div className="repair-item" key={record.id}>
                  <div>
                    <span className="machine-code">{record.machineryCode}</span>
                    <strong>{record.machineryName ?? "—"}</strong>
                    <span className="muted">{record.symptom || "—"} · แจ้ง {acquisitionLabel(record.repairDate)}</span>
                  </div>
                  <span className={`repair-pill ${record.status}`}>{repairStatusLabels[record.status]}</span>
                </div>
              ))}
              {repairsInProgress?.length === 0 && (
                <div className="empty-state">
                  <strong>ไม่มีงานซ่อมบำรุงค้างอยู่</strong>
                </div>
              )}
            </section>
            <section className="panel compact">
              <div className="panel-heading">
                <div>
                  <h2>Service ล่าสุด</h2>
                  <p>3 รายการล่าสุด</p>
                </div>
                <a className="secondary button-link" href="/service">
                  ดูทั้งหมด →
                </a>
              </div>
              {(recentServices ?? []).map((record) => (
                <div className="service-latest-item" key={record.id}>
                  <div>
                    <strong>{record.machineryCode} — {record.machineryName ?? "—"}</strong>
                    <span>
                      {acquisitionLabel(record.serviceDate)} · {record.items.map((item) => item.description).join(", ") || "—"}
                    </span>
                  </div>
                </div>
              ))}
              {recentServices?.length === 0 && (
                <div className="empty-state">
                  <strong>ยังไม่มีประวัติ Service</strong>
                </div>
              )}
            </section>
            <section className="panel compact">
              <div className="panel-heading">
                <div>
                  <h2>จำหน่ายเครื่องจักร</h2>
                  <p>สถานะปัจจุบันในระบบ</p>
                </div>
                <a className="secondary button-link" href="/disposals">
                  ดูทั้งหมด →
                </a>
              </div>
              <div className="disposal-grid">
                <div className="disposal-tile pending">
                  <p>รอจำหน่าย</p>
                  <strong>{disposalCounts ? disposalCounts.pending.toLocaleString("th-TH") : "…"}</strong>
                </div>
                <div className="disposal-tile approved">
                  <p>อนุมัติจำหน่าย</p>
                  <strong>{disposalCounts ? disposalCounts.approved.toLocaleString("th-TH") : "…"}</strong>
                </div>
              </div>
            </section>
          </div>
          {!registryOnly && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>ขนย้ายล่าสุด</h2>
                  <p>3 เที่ยวล่าสุด</p>
                </div>
                <a className="secondary button-link" href="/transfers">
                  ไปหน้าขนย้ายเครื่องจักร →
                </a>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>วันที่ขนย้าย</th>
                      <th>ขนย้ายโดย</th>
                      <th>เครื่องจักร</th>
                      <th>เส้นทาง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recentTransfers ?? []).flatMap((trip) =>
                      trip.items.map((item, index) => (
                        <tr key={`${trip.id}-${index}`}>
                          {index === 0 && (
                            <>
                              <td rowSpan={trip.items.length}>{acquisitionLabel(trip.transferDate)}</td>
                              <td rowSpan={trip.items.length}>{trip.transporters.join(", ")}</td>
                            </>
                          )}
                          <td><strong className="machine-code">{item.machineryCode}</strong></td>
                          <td>{item.from.name} → {item.to.name}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
                {recentTransfers?.length === 0 && (
                  <div className="empty-state">
                    <strong>ยังไม่มีประวัติขนย้าย</strong>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </section>
      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setSelected(null)}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <section
            className="modal detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="ปิด"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <p className="eyebrow">หมายเลขเครื่องจักร</p>
            <h2 id="detail-title" className="machine-code">
              {selected.code}
            </h2>
            <div className="status-stack">
              {(selected.repairStatus !== "ACTIVE" || selected.condition === "W" || selected.condition === "M") && <span className={`status status-condition-${selected.condition === "MAINTENANCE" ? "AVAILABLE" : selected.condition}`}>{conditionLabels[selected.condition === "MAINTENANCE" ? "AVAILABLE" : selected.condition]}</span>}
              {selected.repairStatus === "ACTIVE" && <span className="status status-repair">ซ่อมบำรุง</span>}
            </div>
            <h3>{selected.name}</h3>
            <dl>
              <div>
                <dt>รหัสประเภท</dt>
                <dd>{selected.typeCode ?? "—"}</dd>
              </div>
              <div>
                <dt>ยี่ห้อ / รุ่น</dt>
                <dd>
                  {selected.brand} {selected.model}
                </dd>
              </div>
              <div>
                <dt>เลขตัวถัง / Serial</dt>
                <dd>{selected.serialNumber || "—"}</dd>
              </div>
              <div>
                <dt>รุ่นเครื่องยนต์</dt>
                <dd>{selected.engineModel || "—"}</dd>
              </div>
              <div>
                <dt>หมายเลขทะเบียน</dt>
                <dd>{selected.registrationNumber || "—"}</dd>
              </div>
              <div>
                <dt>ปีที่จัดหา</dt>
                <dd>{selected.acquiredYear ?? "—"}</dd>
              </div>
              <div><dt>วันที่จัดหา</dt><dd>{acquisitionLabel(selected.acquisitionDate)}</dd></div>
              <div><dt>อายุการใช้งานมาตรฐาน</dt><dd>{selected.standardLifeYears ?? "—"} ปี</dd></div>
              <div>
                <dt>ต้นสังกัด</dt>
                <dd>{selected.owningDepartment ?? "—"}</dd>
              </div>
              <div>
                <dt>ศูนย์ผู้ให้เช่า</dt>
                <dd>{selected.leasingDepartment ?? "—"}</dd>
              </div>
              <div>
                <dt>อัตราสิ้นเปลืองเชื้อเพลิง</dt>
                <dd>{selected.fuelConsumption || "—"}</dd>
              </div>
              <div>
                <dt>หน่วยงาน/โครงการที่เช่า</dt>
                <dd>{selected.renterDepartment || "—"}</dd>
              </div>
              <div>
                <dt>หน่วยงาน/โครงการที่เครื่องจักรอยู่</dt>
                <dd>{selected.currentDepartment}</dd>
              </div>
              <div>
                <dt>ราคาจัดซื้อ</dt>
                <dd>
                  {selected.purchasePrice?.toLocaleString("th-TH") ?? "—"} บาท
                </dd>
              </div>
              <div>
                <dt>ค่าเช่าปัจจุบัน วัน / สัปดาห์ / เดือน / ปี</dt>
                <dd>
                  {selected.dailyRate?.toLocaleString("th-TH") ?? "—"} /{" "}
                  {selected.weeklyRate?.toLocaleString("th-TH") ?? "—"} /{" "}
                  {selected.monthlyRate?.toLocaleString("th-TH") ?? "—"} /{" "}
                  {selected.yearlyRate?.toLocaleString("th-TH") ?? "—"} บาท
                </dd>
              </div>
              <div>
                <dt>ค่าเช่ารายชั่วโมง</dt>
                <dd>
                  {selected.hourlyRate?.toLocaleString("th-TH") ?? "—"} บาท
                </dd>
              </div>
              <div>
                <dt>หมายเหตุจากทะเบียน</dt>
                <dd>{selected.note ?? "—"}</dd>
              </div>
            </dl>
            <div className="detail-actions">
              <button className="secondary" onClick={() => setSelected(null)}>
                ปิด
              </button>
              <button
                className="primary"
                onClick={() => {
                  setEditing(selected);
                  setSelected(null);
                  setFormError("");
                }}
              >
                แก้ไขข้อมูล
              </button>
            </div>
          </section>
        </div>
      )}
      {editing && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
          >
            <button
              className="modal-close"
              aria-label="ปิด"
              onClick={() => {
                setEditing(null);
                setFormError("");
              }}
            >
              ×
            </button>
            <p className="eyebrow">หมายเลขเครื่องจักร {editing.code}</p>
            <h2 id="edit-title">แก้ไขข้อมูลเครื่องจักร</h2>
            <form onSubmit={updateMachine}>
              <div className="form-grid">
                <label>
                  หมายเลขเครื่องจักร
                  <input value={editing.code} disabled />
                </label>
                <label>
                  รหัสประเภท
                  <input
                    name="typeCode"
                    defaultValue={editing.typeCode ?? ""}
                  />
                </label>
                <label className="wide">
                  ชื่อเครื่องจักร
                  <input name="name" required defaultValue={editing.name} />
                </label>
                <label>
                  ยี่ห้อ
                  <input name="brand" required defaultValue={editing.brand} />
                </label>
                <label>
                  รุ่น
                  <input name="model" defaultValue={editing.model ?? ""} />
                </label>
                <label>
                  เลขตัวถัง / Serial
                  <input
                    name="serialNumber"
                    defaultValue={editing.serialNumber}
                  />
                </label>
                <label>
                  รุ่นเครื่องยนต์
                  <input name="engineModel" defaultValue={editing.engineModel ?? ""} />
                </label>
                <label>
                  หมายเลขทะเบียน
                  <input name="registrationNumber" defaultValue={editing.registrationNumber ?? ""} />
                </label>
                <label>
                  ปีที่จัดหา (พ.ศ.)
                  <input
                    name="acquiredYear"
                    type="number"
                    min="2400"
                    max="2700"
                    defaultValue={editing.acquiredYear ?? ""}
                  />
                </label>
                <label>วันที่จัดหา<input name="acquisitionDate" type="date" required={editing.ageBasedRates} defaultValue={editing.acquisitionDate ?? ""} /></label>
                <label>อายุการใช้งานมาตรฐาน (ปี)<input name="standardLifeYears" type="number" min="1" step="1" required={editing.ageBasedRates} defaultValue={editing.standardLifeYears ?? ""} /></label>
                {editing.ageBasedRates && <p className="wide">ค่าเช่าปรับอัตโนมัติตามวันที่จัดหาและอายุมาตรฐาน จากอัตราค่าเช่า.xlsx โดยอายุเกิน 2 เท่าใช้อัตราช่วงสุดท้าย</p>}
                <label className="wide">
                  ศูนย์ต้นสังกัด
                  <input
                    name="owningDepartment"
                    list="departments"
                    defaultValue={editing.owningDepartment ?? ""}
                  />
                </label>
                <label className="wide">
                  ศูนย์ผู้ให้เช่า
                  <input name="leasingDepartment" defaultValue={editing.leasingDepartment ?? ""} />
                </label>
                <label className="wide">
                  หน่วยงาน/โครงการที่เครื่องจักรอยู่
                  <input
                    name="currentDepartment"
                    required
                    list="departments"
                    defaultValue={editing.currentDepartment}
                  />
                </label>
                <label>
                  ราคาจัดซื้อ (บาท)
                  <input
                    name="purchasePrice"
                    type="number"
                    min="0"
                    defaultValue={editing.purchasePrice ?? ""}
                  />
                </label>
                <label>
                  สถานะ
                  <select name="condition" defaultValue={editing.condition === "MAINTENANCE" ? "AVAILABLE" : editing.condition}>
                    {editableConditionLabels.map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ค่าเช่ารายปี
                  <input
                    name="yearlyRate"
                    type="number"
                    min="0"
                    defaultValue={editing.yearlyRate ?? ""}
                    readOnly={editing.ageBasedRates}
                  />
                </label>
                <label>
                  ค่าเช่ารายเดือน
                  <input
                    name="monthlyRate"
                    type="number"
                    min="0"
                    defaultValue={editing.monthlyRate ?? ""}
                    readOnly={editing.ageBasedRates}
                  />
                </label>
                <label>
                  ค่าเช่ารายสัปดาห์
                  <input
                    name="weeklyRate"
                    type="number"
                    min="0"
                    defaultValue={editing.weeklyRate ?? ""}
                    readOnly={editing.ageBasedRates}
                  />
                </label>
                <label>
                  ค่าเช่ารายวัน
                  <input
                    name="dailyRate"
                    type="number"
                    min="0"
                    step="1"
                    required={!editing.ageBasedRates}
                    readOnly={editing.ageBasedRates}
                    defaultValue={editing.dailyRate ?? ""}
                  />
                </label>
                <label>
                  ค่าเช่ารายชั่วโมง
                  <input
                    name="hourlyRate"
                    type="number"
                    min="0"
                    defaultValue={editing.hourlyRate ?? ""}
                    readOnly={editing.ageBasedRates}
                  />
                </label>
                <label className="wide">
                  หมายเหตุ
                  <textarea
                    name="note"
                    rows={3}
                    defaultValue={editing.note ?? ""}
                  />
                </label>
              </div>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(null)}
                  disabled={isSaving}
                >
                  ยกเลิก
                </button>
                <ConfirmSubmitButton title="ยืนยันการแก้ไข" message="ต้องการบันทึกการเปลี่ยนแปลงข้อมูลเครื่องจักรนี้ใช่หรือไม่?" confirmLabel="ยืนยันการแก้ไข" disabled={isSaving}>
                  {isSaving ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
                </ConfirmSubmitButton>
              </div>
            </form>
          </section>
        </div>
      )}
      {showCreate && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
          >
            <button
              className="modal-close"
              aria-label="ปิด"
              onClick={() => {
                setShowCreate(false);
                setFormError("");
              }}
            >
              ×
            </button>
            <p className="eyebrow">ทะเบียนเครื่องจักร</p>
            <h2 id="create-title">เพิ่มเครื่องจักรใหม่</h2>
            <form onSubmit={createMachine}>
              <div className="form-grid">
                <label>
                  หมายเลขเครื่องจักร
                  <input name="code" required placeholder="เช่น 82-6209-19-7" />
                </label>
                <label>
                  รหัสประเภท
                  <input name="typeCode" placeholder="เช่น 82-03" />
                </label>
                <label className="wide">
                  ชื่อเครื่องจักร
                  <input name="name" required />
                </label>
                <label>
                  ยี่ห้อ
                  <input name="brand" required />
                </label>
                <label>
                  รุ่น
                  <input name="model" />
                </label>
                <label>
                  เลขตัวถัง / Serial
                  <input name="serialNumber" />
                </label>
                <label>
                  รุ่นเครื่องยนต์
                  <input name="engineModel" />
                </label>
                <label>
                  หมายเลขทะเบียน
                  <input name="registrationNumber" />
                </label>
                <label>
                  ปีที่จัดหา (พ.ศ.)
                  <input name="year" type="number" min="2400" max="2700" />
                </label>
                <label className="wide">
                  ศูนย์ต้นสังกัด
                  <input name="owningDepartment" list="departments" />
                </label>
                <label className="wide">
                  ศูนย์ผู้ให้เช่า
                  <input name="leasingDepartment" list="departments" />
                </label>
                <label className="wide">
                  หน่วยงาน/โครงการที่เครื่องจักรอยู่
                  <input name="currentDepartment" required list="departments" />
                  <datalist id="departments">
                    {departments.map((item) => (
                      <option value={item} key={item} />
                    ))}
                  </datalist>
                </label>
                <label>
                  ราคาจัดซื้อ (บาท)
                  <input name="purchasePrice" type="number" min="0" />
                </label>
                <label>วันที่จัดหา<input name="acquisitionDate" type="date" /></label>
                <label>อายุการใช้งานมาตรฐาน (ปี)<input name="standardLifeYears" type="number" min="1" step="1" /></label>
                <label>
                  สถานะ
                  <select name="condition" defaultValue="AVAILABLE">
                    {editableConditionLabels.map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ค่าเช่ารายปี
                  <input name="yearlyRate" type="number" min="0" />
                </label>
                <label>
                  ค่าเช่ารายเดือน
                  <input name="monthlyRate" type="number" min="0" />
                </label>
                <label>
                  ค่าเช่ารายสัปดาห์
                  <input name="weeklyRate" type="number" min="0" />
                </label>
                <label>
                  ค่าเช่ารายวัน
                  <input
                    name="dailyRate"
                    type="number"
                    min="0"
                    step="1"
                    required
                  />
                </label>
                <label>
                  ค่าเช่ารายชั่วโมง
                  <input name="hourlyRate" type="number" min="0" />
                </label>
              </div>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowCreate(false)}
                  disabled={isSaving}
                >
                  ยกเลิก
                </button>
                <ConfirmSubmitButton title="ยืนยันการเพิ่มข้อมูล" message="ต้องการเพิ่มเครื่องจักรรายการนี้เข้าสู่ระบบใช่หรือไม่?" confirmLabel="ยืนยันการเพิ่ม" disabled={isSaving}>
                  {isSaving ? "กำลังบันทึก…" : "บันทึกเครื่องจักร"}
                </ConfirmSubmitButton>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
    {showReport && (
      <MachineryReport records={filteredMachines} criteria={machineryReportCriteria} onClose={() => setShowReport(false)} />
    )}
    </>
  );
}

export default function Home() {
  return <EquipmentApp />;
}
