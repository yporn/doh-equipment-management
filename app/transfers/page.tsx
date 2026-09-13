"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppSidebar from "../components/app-sidebar";
import { ConfirmActionButton, ConfirmSubmitButton } from "../components/confirm-action";
import Select from "../components/select";
import { departmentChoices, matchesTransferHistory, transporterChoices, transporterTypes } from "../../lib/transfers.mjs";
import { fiscalYearOf } from "../../lib/rental-history.mjs";
import "./transfers.css";

type Machine = { code: string; name: string; typeCode: string | null; currentDepartment: string | null };
type Location = { kind: "DEPARTMENT" | "OTHER"; name: string };
type Item = { machineryCode: string; from: Location; to: Location };
type Trip = { id: string; version: string; transferDate: string; transporters: string[]; items: Item[] };
const emptyItem = (): Item => ({ machineryCode: "", from: { kind: "DEPARTMENT", name: "" }, to: { kind: "DEPARTMENT", name: "" } });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateLabel = (value: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function LocationField({ label, value, choices, onChange }: { label: string; value: Location; choices: string[]; onChange: (value: Location) => void }) {
  return <div className="transfer-location"><label>{label}<select required value={value.kind === "OTHER" ? "__OTHER__" : value.name} onChange={event => onChange(event.target.value === "__OTHER__" ? { kind: "OTHER", name: "" } : { kind: "DEPARTMENT", name: event.target.value })}><option value="">เลือกหน่วยงาน / โครงการ</option>{choices.map(name => <option key={name} value={name}>{name}</option>)}<option value="__OTHER__">อื่นๆ (ระบุ)</option></select></label>{value.kind === "OTHER" && <label>ระบุสถานที่{label}<input required maxLength={300} value={value.name} onChange={event => onChange({ kind: "OTHER", name: event.target.value })} placeholder="พิมพ์สถานที่" /></label>}</div>;
}

export default function TransfersPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [records, setRecords] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [transferDate, setTransferDate] = useState(today);
  const [transporters, setTransporters] = useState([""]);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [query, setQuery] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [month, setMonth] = useState("");
  const [fromDepartment, setFromDepartment] = useState("");
  const [toDepartment, setToDepartment] = useState("");

  async function loadData() {
    try {
      const [machineResponse, recordResponse] = await Promise.all([fetch("/api/machineries"), fetch("/api/transfers")]);
      if (!machineResponse.ok || !recordResponse.ok) throw new Error("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่");
      setMachines(await machineResponse.json()); setRecords(await recordResponse.json());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถโหลดข้อมูลได้"); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);
  const carriers: Machine[] = transporterChoices(machines);
  const departments: string[] = [...new Set([...departmentChoices(machines), ...(editing?.items.flatMap(item => [item.from, item.to].filter(location => location.kind === "DEPARTMENT").map(location => location.name)) ?? [])])].sort((a, b) => a.localeCompare(b, "th"));
  const fiscalYears = useMemo(() => [...new Set(records.map(record => fiscalYearOf(record.transferDate)))].sort((a, b) => b - a), [records]);
  const fromDepartments = useMemo(() => [...new Set(records.flatMap(record => record.items.map(item => item.from.name.trim())).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")), [records]);
  const toDepartments = useMemo(() => [...new Set(records.flatMap(record => record.items.map(item => item.to.name.trim())).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")), [records]);
  const filtered = useMemo(() => records.filter(record => matchesTransferHistory(record, { query, fiscalYear, month, fromDepartment, toDepartment })), [records, query, fiscalYear, month, fromDepartment, toDepartment]);
  const hasFilters = Boolean(query || fiscalYear || month || fromDepartment || toDepartment);
  function resetFilters() { setQuery(""); setFiscalYear(""); setMonth(""); setFromDepartment(""); setToDepartment(""); }

  function openForm(record: Trip | null = null) {
    setEditing(record); setTransferDate(record?.transferDate ?? today()); setTransporters(record ? [...record.transporters] : [""]); setItems(record ? structuredClone(record.items) : [emptyItem()]); setError(""); setNotice(""); setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function deleteRecord(record: Trip) {
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/transfers", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: record.id, version: record.version }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถลบข้อมูลได้");
      setNotice("ลบรายการขนย้ายแล้ว และปรับหน่วยงานตามประวัติล่าสุดที่เหลืออยู่"); setLoading(true); await loadData();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถลบข้อมูลได้"); }
    finally { setSaving(false); }
  }
  function updateItem(index: number, update: Partial<Item>) { setItems(current => current.map((item, position) => position === index ? { ...item, ...update } : item)); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/transfers", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: editing?.id, version: editing?.version, transferDate, transporters, items }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถบันทึกข้อมูลได้");
      setShowForm(false); setEditing(null); setNotice(editing ? "แก้ไขรายการขนย้ายและปรับหน่วยงานในบัญชีเครื่องจักรแล้ว" : "บันทึกขนย้ายและปรับหน่วยงานในบัญชีเครื่องจักรแล้ว"); setLoading(true); await loadData();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกข้อมูลได้"); }
    finally { setSaving(false); }
  }

  return <main className="app-shell"><AppSidebar active="transfers" /><section className="main-area transfer-page">
    <header className="topbar"><div><p className="eyebrow">ประวัติการขนย้าย • ต้นทางและปลายทางรายเครื่อง</p><h1>ระบบขนย้ายเครื่องจักร</h1></div><div className="top-actions"><button type="button" className="primary" disabled={loading || saving || showForm} onClick={() => openForm()}>＋ บันทึกขนย้าย</button></div></header>
    <div className="content service-content">
      {notice && <p className="transfer-notice" role="status">{notice}</p>}
      {error && <div className="page-error" role="alert">{error} {!showForm && <button type="button" className="secondary" disabled={loading} onClick={() => { setError(""); setLoading(true); void loadData(); }}>ลองใหม่</button>}</div>}
      {showForm && <section className="panel transfer-form"><h2>{editing ? "แก้ไขข้อมูลขนย้าย" : "บันทึกข้อมูลขนย้าย"}</h2><form onSubmit={save}><fieldset disabled={saving} className="transfer-fields">
        <label>วันที่ขนย้ายเครื่องจักร<input type="date" required value={transferDate} onChange={event => setTransferDate(event.target.value)} /><small>วันที่เลือก: {transferDate ? dateLabel(transferDate) : "—"}</small></label>
        <fieldset className="service-items"><legend>ขนย้ายโดย</legend><p className="muted">เลือกจากประเภท 61-01 → 64-01 → 15-01 ในบัญชีเครื่องจักร</p>
          {transporters.map((code, index) => <div className="transfer-carrier-row" key={index}><label>รถขนย้ายคันที่ {index + 1}<select required value={code} onChange={event => setTransporters(current => current.map((value, position) => position === index ? event.target.value : value))}><option value="">เลือกหมายเลขเครื่องจักร</option>{editing?.transporters.filter(saved => !carriers.some(machine => machine.code === saved)).map(saved => <option key={saved} value={saved} disabled={transporters.includes(saved) && code !== saved}>{saved} — ข้อมูลเดิม</option>)}{transporterTypes.map(type => <optgroup key={type} label={type}>{carriers.filter(machine => machine.typeCode === type).map(machine => <option key={machine.code} value={machine.code} disabled={transporters.includes(machine.code) && code !== machine.code}>{machine.code} — {machine.name}</option>)}</optgroup>)}</select></label><button type="button" className="remove-item" aria-label={`ลบรถขนย้ายคันที่ ${index + 1}`} disabled={transporters.length === 1} onClick={() => setTransporters(current => current.filter((_, position) => position !== index))}>×</button></div>)}
          {!carriers.length && <p role="status">ไม่มีเครื่องจักรประเภทที่กำหนดในบัญชี กรุณาเพิ่มในบัญชีเครื่องจักรก่อน</p>}
          <button type="button" className="add-item" disabled={transporters.length >= 100} onClick={() => setTransporters(current => [...current, ""])}>＋ เพิ่มรถขนย้าย</button>
        </fieldset>
        <fieldset className="service-items"><legend>เครื่องจักรที่ขนย้าย</legend>
          <datalist id="transfer-machines">{machines.map(machine => <option key={machine.code} value={machine.code}>{machine.name}</option>)}</datalist>
          {items.map((item, index) => <fieldset className="transfer-item" key={index}><legend>รายการที่ {index + 1}</legend><div className="transfer-item-grid"><label>หมายเลขเครื่องจักรที่ขนย้าย<input required list="transfer-machines" value={item.machineryCode} placeholder="พิมพ์ค้นหาหมายเลขเครื่องจักร" onChange={event => { const machine = machines.find(machine => machine.code === event.target.value); updateItem(index, { machineryCode: event.target.value, ...(machine && !item.from.name ? { from: { kind: "DEPARTMENT", name: machine.currentDepartment ?? "" } as Location } : {}) }); }} /><small>{machines.find(machine => machine.code === item.machineryCode)?.name ?? "เลือกหมายเลขจากบัญชีเครื่องจักร"}</small></label><LocationField label="จาก" value={item.from} choices={departments} onChange={from => updateItem(index, { from })} /><LocationField label="ไป" value={item.to} choices={departments} onChange={to => updateItem(index, { to })} /><button type="button" className="remove-item" aria-label={`ลบเครื่องจักรที่ขนย้ายรายการที่ ${index + 1}`} disabled={items.length === 1} onClick={() => setItems(current => current.filter((_, position) => position !== index))}>×</button></div></fieldset>)}
          <button type="button" className="add-item" disabled={items.length >= 100} onClick={() => setItems(current => [...current, emptyItem()])}>＋ เพิ่มรายการเครื่องจักรที่ขนย้าย</button>
        </fieldset>
        <p className="detail-note">หน่วยงานในบัญชีเครื่องจักรจะเปลี่ยนเป็นปลายทางของประวัติขนย้ายล่าสุดตามวันที่ หากเป็นวันเดียวกันใช้รายการที่บันทึกทีหลัง โดยไม่เปลี่ยนสถานะหรือหน่วยงานเจ้าของ</p>
        <div className="modal-actions"><button type="button" className="secondary" onClick={() => { setShowForm(false); setEditing(null); setError(""); }}>ยกเลิก</button><ConfirmSubmitButton title={editing ? "ยืนยันแก้ไขขนย้าย" : "ยืนยันบันทึกขนย้าย"} message={`บันทึกขนย้ายเครื่องจักร ${items.length} รายการ โดยรถขนย้าย ${transporters.length} คัน?`} confirmLabel="ยืนยันบันทึก" disabled={saving || (!carriers.length && !editing)}>{saving ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}</ConfirmSubmitButton></div>
      </fieldset></form></section>}
      <section className="panel"><div className="panel-heading"><div><h2>รายการขนย้ายเครื่องจักร</h2><p>แสดงต้นทาง–ปลายทางแยกแต่ละเครื่องจักร</p></div></div><div className="service-history-filters transfer-filters"><label>ค้นหา<input value={query} onChange={event => setQuery(event.target.value)} placeholder="หมายเลขเครื่องจักร / สถานที่ / วันที่" /></label><label>ปีงบประมาณ<Select ariaLabel="กรองตามปีงบประมาณ" value={fiscalYear} onChange={setFiscalYear} options={[{ value: "", label: "ทุกปีงบประมาณ" }, ...fiscalYears.map(year => ({ value: String(year), label: `ปีงบประมาณ ${year}` }))]} /></label><label>เดือน<Select ariaLabel="กรองตามเดือน" value={month} onChange={setMonth} options={[{ value: "", label: "ทุกเดือน" }, ...thaiMonths.map((name, index) => ({ value: String(index + 1), label: name }))]} /></label><label>หน่วยงานต้นทาง<Select ariaLabel="กรองตามหน่วยงานต้นทาง" isSearchable value={fromDepartment} onChange={setFromDepartment} options={[{ value: "", label: "ทุกหน่วยงานต้นทาง" }, ...fromDepartments.map(name => ({ value: name, label: name }))]} /></label><label>หน่วยงานปลายทาง<Select ariaLabel="กรองตามหน่วยงานปลายทาง" isSearchable value={toDepartment} onChange={setToDepartment} options={[{ value: "", label: "ทุกหน่วยงานปลายทาง" }, ...toDepartments.map(name => ({ value: name, label: name }))]} /></label><button type="button" className="transfer-reset" onClick={resetFilters}>ล้างตัวกรอง</button></div>
        <p className="rental-filter-summary" role="status">{loading ? "กำลังโหลดข้อมูล…" : `พบ ${filtered.length} จาก ${records.length} รายการขนย้าย`}</p><div className="table-wrap"><table className="transfer-table"><thead><tr><th>วันที่ขนย้าย</th><th>ขนย้ายโดย</th><th>เครื่องจักรที่ขนย้าย</th><th>เส้นทาง</th><th>จัดการ</th></tr></thead><tbody>{filtered.flatMap(record => record.items.map((item, index) => <tr key={`${record.id}-${index}`} className={index === 0 ? "transfer-trip-start" : undefined}>{index === 0 && <><td rowSpan={record.items.length}>{dateLabel(record.transferDate)}</td><td rowSpan={record.items.length}>{record.transporters.map(code => <div className="machine-code" key={code}>{code}</div>)}</td></>}<td><strong className="machine-code">{item.machineryCode}</strong></td><td><div className="transfer-route"><span>{item.from.name}{item.from.kind === "OTHER" && <span className="muted"> (อื่นๆ)</span>}</span><span className="transfer-route-arrow" aria-hidden="true">→</span><span>{item.to.name}{item.to.kind === "OTHER" && <span className="muted"> (อื่นๆ)</span>}</span></div></td>{index === 0 && <td rowSpan={record.items.length}><div className="service-row-actions"><button type="button" className="secondary compact-action" disabled={saving || loading || showForm} onClick={() => openForm(record)}>แก้ไข</button><ConfirmActionButton className="danger-button compact-action" title="ยืนยันลบรายการขนย้าย" message={`ลบรายการขนย้ายวันที่ ${dateLabel(record.transferDate)} โดย ${record.transporters.join(", ")} พร้อมเครื่องจักร ${record.items.length} รายการทั้งหมดในเที่ยวนี้? ไม่สามารถกู้คืนจากหน้าจอได้ หน่วยงานจะปรับตามประวัติล่าสุดที่เหลืออยู่ หากไม่มีประวัติจะคืนหน่วยงานก่อนเริ่มเชื่อมข้อมูล โดยไม่เปลี่ยนสถานะเครื่องจักรหรือประวัติระบบอื่น`} confirmLabel="ยืนยันลบข้อมูล" disabled={saving || loading || showForm} onConfirm={() => deleteRecord(record)}>ลบข้อมูล</ConfirmActionButton></div></td>}</tr>))}{!loading && !filtered.length && <tr><td colSpan={5} className="empty-state">{hasFilters ? "ไม่พบรายการขนย้ายตามตัวกรอง" : "ยังไม่มีประวัติขนย้าย กดบันทึกขนย้ายเพื่อเริ่มต้น"}</td></tr>}</tbody></table></div>
      </section>
    </div>
  </section></main>;
}
