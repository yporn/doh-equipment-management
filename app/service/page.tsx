"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppSidebar from "../components/app-sidebar";
import { ConfirmActionButton, ConfirmSubmitButton } from "../components/confirm-action";
import Select from "../components/select";

type Machine = {
  code: string;
  name: string;
  brand: string;
  model: string | null;
  currentDepartment: string;
};
type ServiceItem = {
  serviceType: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  specification: string | null;
};
type ServiceRecord = {
  id: string;
  machineryCode: string;
  machineryName: string | null;
  machineryBrand: string | null;
  machineryModel: string | null;
  serviceDate: string;
  documentNumber: string | null;
  meterReading: number | null;
  meterUnit: "KILOMETER" | "HOUR" | null;
  provider: string | null;
  technician: string | null;
  items: ServiceItem[];
  note: string | null;
};

const thaiDate = (value: string) =>
  new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
const shortThaiDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${String(Number(year) + 543).slice(-2)}`;
};
const thaiMonths = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const fiscalYearOf = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return year + (month >= 10 ? 544 : 543);
};
const serviceTypes = [
  "เปลี่ยนน้ำมันเครื่อง",
  "เปลี่ยนไส้กรองน้ำมันเครื่อง",
  "เปลี่ยนไส้กรองน้ำมันเชื้อเพลิง",
  "เปลี่ยนไส้กรองอากาศ",
  "เปลี่ยนกรองน้ำมันเกียร์",
  "เปลี่ยนน้ำมันเกียร์",
  "เปลี่ยนน้ำมันเฟืองท้าย",
  "เปลี่ยน/เติม น้ำมันไฮดรอลิค",
  "เปลี่ยนไส้กรองไฮดรอลิค",
  "เปลี่ยนแบตเตอรี่",
  "เปลี่ยนยาง",
];
const oilTypes = [
  "SAE 10W-30",
  "SAE 15W-40",
  "SAE 30",
  "SAE 75W-90",
  "SAE 80W-90",
  "SAE 90",
  "SAE 140",
  "ISO VG 46",
  "ISO VG 68",
  "ISO VG 100",
  "Dot 3",
  "AUTOMAT",
];
const batterySizes = ["12V 90Ah", "12V 120Ah", "12V 150Ah"];
const tireSizes = [
  "9.00-20",
  "10.00-20",
  "11.00-20",
  "11R-22.5",
  "14.00-24",
  "215/65R16",
  "215/70R15",
  "215/70R16",
  "265/70R16",
];
const emptyServiceItem = (): ServiceItem => ({
  serviceType: "",
  description: "",
  quantity: null,
  unit: null,
  specification: null,
});
const itemSummary = (item: ServiceItem) =>
  [
    item.quantity
      ? `${item.quantity.toLocaleString("th-TH")} ${item.unit ?? ""}`
      : "",
    item.specification
      ? `${item.unit === "ลิตร" ? "ชนิดน้ำมัน" : "ขนาด"} ${item.specification}`
      : "",
  ]
    .filter(Boolean)
    .join(" • ");

export default function ServicePage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [query, setQuery] = useState("");
  const [fiscalYearFilter, setFiscalYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [machineryFilter, setMachineryFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ServiceRecord | null>(null);
  const [selected, setSelected] = useState<ServiceRecord | null>(null);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      const [machineResponse, serviceResponse] = await Promise.all([
        fetch("/api/machineries"),
        fetch("/api/services"),
      ]);
      if (!machineResponse.ok || !serviceResponse.ok) throw new Error();
      setMachines(await machineResponse.json());
      setRecords(await serviceResponse.json());
    } catch {
      setError("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("th");
    return records.filter((record) => {
      const month = Number(record.serviceDate.slice(5, 7));
      const matchesText =
        !text ||
        [
          record.machineryCode,
          record.machineryName,
          record.provider,
          record.technician,
          ...record.items.map((item) => item.description),
        ].some((value) => value?.toLocaleLowerCase("th").includes(text));
      return (
        matchesText &&
        (!fiscalYearFilter ||
          fiscalYearOf(record.serviceDate) === Number(fiscalYearFilter)) &&
        (!monthFilter || month === Number(monthFilter)) &&
        (!machineryFilter.trim() ||
          record.machineryCode
            .toLocaleLowerCase("th")
            .includes(machineryFilter.trim().toLocaleLowerCase("th")))
      );
    });
  }, [fiscalYearFilter, machineryFilter, monthFilter, query, records]);
  const fiscalYears = useMemo(
    () =>
      [
        ...new Set(records.map((record) => fiscalYearOf(record.serviceDate))),
      ].sort((a, b) => b - a),
    [records],
  );
  const serviceMachines = useMemo(
    () =>
      [...new Set(records.map((record) => record.machineryCode))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [records],
  );
  function toggleServiceType(serviceType: string, checked: boolean) {
    setItems((current) =>
      checked
        ? [
            ...current,
            { ...emptyServiceItem(), serviceType, description: serviceType },
          ]
        : current.filter((item) => item.serviceType !== serviceType),
    );
  }

  function changeItem(
    serviceType: string,
    field: "quantity" | "specification",
    value: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.serviceType === serviceType
          ? {
              ...item,
              [field]:
                field === "quantity"
                  ? value === ""
                    ? null
                    : Number(value)
                  : value,
            }
          : item,
      ),
    );
  }

  function openCreate() {
    setEditing(null);
    setItems([]);
    setError("");
    setShowCreate(true);
  }

  function openEdit(record: ServiceRecord) {
    setEditing(record);
    setItems(
      record.items.map((item) => ({
        ...emptyServiceItem(),
        ...item,
        serviceType: item.serviceType || item.description,
      })),
    );
    setSelected(null);
    setError("");
    setShowCreate(true);
  }

  function closeForm() {
    setShowCreate(false);
    setEditing(null);
    setError("");
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const validItems = items.filter((item) => item.serviceType);
    if (!validItems.length) {
      setError("กรุณาระบุรายการ Service อย่างน้อย 1 รายการ");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/services", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editing?.id,
          machineryCode: form.get("machineryCode"),
          serviceDate: form.get("serviceDate"),
          meterReading: form.get("meterReading"),
          meterUnit: form.get("meterUnit"),
          provider: form.get("provider"),
          technician: form.get("technician"),
          note: form.get("note"),
          items: validItems,
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "ไม่สามารถบันทึกได้");
      await loadData();
      closeForm();
      setItems([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกได้");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteService(record: ServiceRecord) {
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/services", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: record.id }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "ไม่สามารถลบได้");
      setSelected(null);
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถลบได้");
    } finally {
      setIsSaving(false);
    }
  }

  function printService(record: ServiceRecord) {
    setSelected(record);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => window.print()),
    );
  }

  return (
    <main className="app-shell">
      <AppSidebar active="service" />
      <section className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">การบำรุงตามรอบ</p>
            <h1>ระบบ Service</h1>
          </div>
          <div className="top-actions">
            <button className="primary" onClick={openCreate}>
              ＋ บันทึก Service
            </button>
          </div>
        </header>
        <div className="content service-content">
          <section className="stats-grid service-stats">
            <article className="stat-card">
              <span>ประวัติตามตัวกรอง</span>
              <strong>{filtered.length.toLocaleString("th-TH")}</strong>
              <small>รายการ</small>
            </article>
            <article className="stat-card">
              <span>เครื่องจักรที่เคย Service</span>
              <strong>
                {new Set(
                  filtered.map((record) => record.machineryCode),
                ).size.toLocaleString("th-TH")}
              </strong>
              <small>เครื่อง</small>
            </article>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>ประวัติ Service</h2>
                <p>เลือกดูสรุปตามปีงบประมาณ เดือน และหมายเลขเครื่องจักร</p>
              </div>
              <label className="search">
                <span>⌕</span>
                <input
                  aria-label="ค้นหาประวัติ Service"
                  placeholder="ค้นหารายการ หรือผู้ให้บริการ"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="service-history-filters">
              <label>
                ปีงบประมาณ
                <Select
                  ariaLabel="กรองตามปีงบประมาณ"
                  value={fiscalYearFilter}
                  onChange={setFiscalYearFilter}
                  options={[
                    { value: "", label: "ทุกปีงบประมาณ" },
                    ...fiscalYears.map((year) => ({ value: String(year), label: `ปีงบประมาณ ${year}` })),
                  ]}
                />
              </label>
              <label>
                เดือน
                <Select
                  ariaLabel="กรองตามเดือน"
                  value={monthFilter}
                  onChange={setMonthFilter}
                  options={[
                    { value: "", label: "ทุกเดือน" },
                    ...thaiMonths.map((month, index) => ({ value: String(index + 1), label: month })),
                  ]}
                />
              </label>
              <label>
                หมายเลขเครื่องจักร
                <Select
                  ariaLabel="กรองตามหมายเลขเครื่องจักร"
                  isSearchable
                  isClearable
                  placeholder="พิมพ์หมายเลขเครื่องจักร"
                  value={machineryFilter}
                  onChange={setMachineryFilter}
                  options={serviceMachines.map((code) => ({ value: code, label: code }))}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setFiscalYearFilter("");
                  setMonthFilter("");
                  setMachineryFilter("");
                  setQuery("");
                }}
              >
                ล้างตัวกรอง
              </button>
            </div>
            {error && !showCreate && (
              <p className="page-error" role="alert">
                {error}
              </p>
            )}
            <div className="table-wrap service-table">
              <table>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>เครื่องจักร</th>
                    <th>ค่ามิเตอร์</th>
                    <th>รายการ Service</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{thaiDate(record.serviceDate)}</strong>
                      </td>
                      <td>
                        <strong className="machine-code">
                          {record.machineryCode}
                        </strong>
                        <span className="muted">
                          {record.machineryName ?? "—"}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {record.meterReading !== null
                            ? record.meterReading.toLocaleString("th-TH")
                            : "—"}
                        </strong>
                        <span className="muted">
                          {record.meterUnit === "KILOMETER"
                            ? "กิโลเมตร"
                            : record.meterUnit === "HOUR"
                              ? "ชั่วโมง"
                              : ""}
                        </span>
                      </td>
                      <td>
                        <strong>{record.items[0]?.description ?? "—"}</strong>
                        <span className="muted">
                          {record.items.length > 1
                            ? `และอีก ${record.items.length - 1} รายการ`
                            : itemSummary(record.items[0]) ||
                              record.provider ||
                              ""}
                        </span>
                      </td>
                      <td>
                        <div className="service-row-actions">
                          <button
                            className="print-button compact-action"
                            onClick={() => printService(record)}
                          >
                            พิมพ์
                          </button>
                          <button
                            className="secondary compact-action"
                            onClick={() => openEdit(record)}
                          >
                            แก้ไข
                          </button>
                          <ConfirmActionButton
                            className="danger-button compact-action"
                            title="ยืนยันการลบข้อมูล"
                            message={`ต้องการลบประวัติ Service ของเครื่องจักร ${record.machineryCode} วันที่ ${thaiDate(record.serviceDate)} ใช่หรือไม่?`}
                            confirmLabel="ยืนยันการลบ"
                            disabled={isSaving}
                            onConfirm={() => deleteService(record)}
                          >
                            ลบ
                          </ConfirmActionButton>
                          <button
                            className="row-action"
                            aria-label={`ดู Service ${record.machineryCode}`}
                            onClick={() => setSelected(record)}
                          >
                            ›
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="empty-state">
                  <strong>ไม่พบประวัติ Service ตามตัวกรอง</strong>
                  <span>ลองเปลี่ยนปีงบประมาณ เดือน หรือหมายเลขเครื่องจักร</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
      {showCreate && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal service-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-title"
          >
            <button
              className="modal-close"
              aria-label="ปิด"
              onClick={closeForm}
            >
              ×
            </button>
            <p className="eyebrow">ประวัติการบำรุงตามรอบ</p>
            <h2 id="service-title">
              {editing ? "แก้ไข Service" : "บันทึก Service"}
            </h2>
            <form onSubmit={saveService}>
              <div className="form-grid">
                <label className="wide">
                  เครื่องจักร
                  <input
                    name="machineryCode"
                    required
                    list="service-machineries"
                    defaultValue={editing?.machineryCode ?? ""}
                    placeholder="พิมพ์รหัส ชื่อ ยี่ห้อ หรือรุ่นเพื่อค้นหา"
                    autoComplete="off"
                  />
                  <datalist id="service-machineries">
                    {machines.map((machine) => (
                      <option value={machine.code} key={machine.code}>
                        {machine.name} — {machine.brand} {machine.model ?? ""}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label>
                  วันที่ Service
                  <input
                    name="serviceDate"
                    type="date"
                    required
                    defaultValue={
                      editing?.serviceDate ??
                      new Date().toISOString().slice(0, 10)
                    }
                  />
                </label>
                <label>
                  ผู้ให้บริการ / อู่
                  <select name="provider" required defaultValue={editing?.provider === "ศูนย์บริการ" ? "ศูนย์บริการ" : "ฝ่ายเครื่องกล"}>
                    <option value="ฝ่ายเครื่องกล">ฝ่ายเครื่องกล</option>
                    <option value="ศูนย์บริการ">ศูนย์บริการ</option>
                  </select>
                </label>
                <label>
                  ค่ามิเตอร์
                  <input
                    name="meterReading"
                    type="number"
                    min="0"
                    step="0.1"
                    defaultValue={editing?.meterReading ?? ""}
                  />
                </label>
                <label>
                  หน่วยมิเตอร์
                  <select
                    name="meterUnit"
                    defaultValue={editing?.meterUnit ?? "KILOMETER"}
                  >
                    <option value="KILOMETER">กิโลเมตร</option>
                    <option value="HOUR">ชั่วโมง</option>
                  </select>
                </label>
                <label>
                  ผู้ดำเนินการ
                  <input
                    name="technician"
                    defaultValue={editing?.technician ?? ""}
                  />
                </label>
              </div>
              <fieldset className="service-items">
                <legend>รายการ Service (เลือกได้หลายรายการ)</legend>
                <div className="service-checklist">
                  {serviceTypes.map((serviceType) => {
                    const item = items.find(
                      (current) => current.serviceType === serviceType,
                    );
                    const selectedType = Boolean(item);
                    const isOil =
                      serviceType === "เปลี่ยนน้ำมันเครื่อง" ||
                      serviceType === "เปลี่ยนน้ำมันเกียร์" ||
                      serviceType === "เปลี่ยนน้ำมันเฟืองท้าย" ||
                      serviceType === "เปลี่ยน/เติม น้ำมันไฮดรอลิค";
                    const isBattery = serviceType === "เปลี่ยนแบตเตอรี่";
                    const isTire = serviceType === "เปลี่ยนยาง";
                    return (
                      <div
                        className={`service-check-row ${selectedType ? "selected" : ""}`}
                        key={serviceType}
                      >
                        <label className="service-check-label">
                          <input
                            type="checkbox"
                            checked={selectedType}
                            onChange={(event) =>
                              toggleServiceType(
                                serviceType,
                                event.target.checked,
                              )
                            }
                          />
                          <span>{serviceType}</span>
                        </label>
                        {selectedType && (isOil || isBattery || isTire) && (
                          <div className="service-extra-fields">
                            <label>
                              จำนวน (
                              {isOil ? "ลิตร" : isBattery ? "ลูก" : "เส้น"})
                              <input
                                required
                                type="number"
                                min={isOil ? "0.1" : "1"}
                                step={isOil ? "0.1" : "1"}
                                value={item?.quantity ?? ""}
                                onChange={(event) =>
                                  changeItem(
                                    serviceType,
                                    "quantity",
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            {(isOil || isBattery || isTire) && (
                              <label>
                                {isOil
                                  ? "ชนิดน้ำมัน"
                                  : `ขนาด${isBattery ? "แบตเตอรี่" : "ยาง"}`}
                                {isOil || isBattery || isTire ? (
                                  <select
                                    required={!isOil}
                                    value={item?.specification ?? ""}
                                    onChange={(event) =>
                                      changeItem(
                                        serviceType,
                                        "specification",
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <option value="">
                                      {isOil ? "ไม่ระบุ" : "เลือกขนาด"}
                                    </option>
                                    {(isOil
                                      ? oilTypes
                                      : isBattery
                                        ? batterySizes
                                        : tireSizes
                                    ).map((specification) => (
                                      <option
                                        value={specification}
                                        key={specification}
                                      >
                                        {specification}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
              <label className="form-note">
                หมายเหตุ
                <textarea
                  name="note"
                  rows={3}
                  defaultValue={editing?.note ?? ""}
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={closeForm}
                  disabled={isSaving}
                >
                  ยกเลิก
                </button>
                <ConfirmSubmitButton title={editing ? "ยืนยันการแก้ไข" : "ยืนยันการเพิ่มข้อมูล"} message={editing ? "ต้องการบันทึกการเปลี่ยนแปลงรายการ Service นี้ใช่หรือไม่?" : "ต้องการเพิ่มรายการ Service นี้เข้าสู่ระบบใช่หรือไม่?"} confirmLabel={editing ? "ยืนยันการแก้ไข" : "ยืนยันการเพิ่ม"} disabled={isSaving}>
                  {isSaving
                    ? "กำลังบันทึก…"
                    : editing
                      ? "บันทึกการแก้ไข"
                      : "บันทึก Service"}
                </ConfirmSubmitButton>
              </div>
            </form>
          </section>
        </div>
      )}
      {selected && (
        <div
          className="modal-backdrop service-print-backdrop"
          role="presentation"
          onMouseDown={() => setSelected(null)}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <section
            className="modal detail-modal service-print"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="print-document">
              <header className="print-doc-header">
                <img
                  src="https://www.doh.go.th/layouts/theme1/images/logo.png"
                  alt="ตรากรมทางหลวง"
                />
                <div>
                  <strong>กรมทางหลวง</strong>
                  <b>ศูนย์สร้างทางขอนแก่น</b>
                  <span>DEPARTMENT OF HIGHWAYS</span>
                </div>
                <small>
                  เลขที่เอกสาร
                  <br />
                  {selected.documentNumber ?? "—"}
                </small>
              </header>
              <h1>ใบสรุปรายการ SERVICE เครื่องจักร</h1>
              <section className="print-info">
                <div>
                  <span>หมายเลขเครื่องจักร</span>
                  <strong>{selected.machineryCode}</strong>
                </div>
                <div>
                  <span>วันที่ Service</span>
                  <strong>{shortThaiDate(selected.serviceDate)}</strong>
                </div>
                <div className="wide">
                  <span>ชื่อเครื่องจักร</span>
                  <strong>{selected.machineryName ?? "—"}</strong>
                </div>
                <div>
                  <span>ค่ามิเตอร์</span>
                  <strong>
                    {selected.meterReading?.toLocaleString("th-TH") ?? "—"}{" "}
                    {selected.meterUnit === "KILOMETER"
                      ? "กิโลเมตร"
                      : selected.meterUnit === "HOUR"
                        ? "ชั่วโมง"
                        : ""}
                  </strong>
                </div>
                <div>
                  <span>ผู้ให้บริการ / อู่</span>
                  <strong>{selected.provider ?? "—"}</strong>
                </div>
                <div className="wide">
                  <span>ผู้ดำเนินการ</span>
                  <strong>{selected.technician ?? "—"}</strong>
                </div>
              </section>
              <table className="print-service-table">
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>รายการ Service</th>
                    <th>จำนวน</th>
                    <th>ขนาด / รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{item.description}</td>
                      <td>
                        {item.quantity
                          ? `${item.quantity.toLocaleString("th-TH")} ${item.unit ?? ""}`
                          : "—"}
                      </td>
                      <td>{item.specification ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <section className="print-note">
                <strong>หมายเหตุ</strong>
                <p>{selected.note ?? "—"}</p>
              </section>
              <section className="print-signatures">
                <div>
                  <span>
                    ลงชื่อ ................................................
                  </span>
                  <strong>ผู้ดำเนินการ</strong>
                  <small>วันที่ ........../........../..........</small>
                </div>
                <div>
                  <span>
                    ลงชื่อ ................................................
                  </span>
                  <strong>ผู้ตรวจสอบ</strong>
                  <small>วันที่ ........../........../..........</small>
                </div>
              </section>
              <footer>เอกสารจากระบบ DOH Equipment Management System</footer>
            </div>
            <div className="screen-service-detail">
              <button
                className="modal-close"
                aria-label="ปิด"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
              <p className="eyebrow">{thaiDate(selected.serviceDate)}</p>
              <h2 id="service-detail-title">
                Service {selected.machineryCode}
              </h2>
              <h3>{selected.machineryName}</h3>
              <dl>
                <div>
                  <dt>ค่ามิเตอร์</dt>
                  <dd>
                    {selected.meterReading?.toLocaleString("th-TH") ?? "—"}{" "}
                    {selected.meterUnit === "KILOMETER"
                      ? "กิโลเมตร"
                      : selected.meterUnit === "HOUR"
                        ? "ชั่วโมง"
                        : ""}
                  </dd>
                </div>
                <div>
                  <dt>ผู้ให้บริการ / อู่</dt>
                  <dd>{selected.provider ?? "—"}</dd>
                </div>
                <div>
                  <dt>ผู้ดำเนินการ</dt>
                  <dd>{selected.technician ?? "—"}</dd>
                </div>
              </dl>
              <div className="service-detail-items">
                <h3>รายการ Service</h3>
                {selected.items.map((item, index) => (
                  <div key={index}>
                    <span>
                      {item.description}
                      {itemSummary(item) && <small>{itemSummary(item)}</small>}
                    </span>
                  </div>
                ))}
              </div>
              {selected.note && (
                <p className="detail-note">
                  <strong>หมายเหตุ</strong>
                  <br />
                  {selected.note}
                </p>
              )}
              <div className="detail-actions">
                <button className="secondary" onClick={() => setSelected(null)}>
                  ปิด
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
