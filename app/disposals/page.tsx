"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppSidebar from "../components/app-sidebar";
import { ConfirmActionButton, ConfirmSubmitButton } from "../components/confirm-action";
import { disposalLabels, matchesDisposal } from "../../lib/disposals.mjs";
import { fiscalYearOf } from "../../lib/rental-history.mjs";

type Status = keyof typeof disposalLabels;
type Machine = { code: string; name: string; condition: string; status: string; currentDepartment: string | null };
type Disposal = {
  id: string; machineryCode: string; machineryName: string | null; currentDepartment: string | null;
  proposedDate: string; reason: string; responsiblePerson: string; status: Status;
  updatedAt: string;
  machinery: { typeCode: string | null; brand: string; model: string | null; engineModel: string | null; registrationNumber: string | null; serialNumber: string; owningDepartment: string | null; purchasePrice: number | null; note: string | null } | null;
  approvalDate: string | null; note: string | null;
};
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateLabel = (date: string | null) => date ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(`${date}T00:00:00`)) : "—";

export default function DisposalsPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [records, setRecords] = useState<Disposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Disposal | null>(null);
  const [selected, setSelected] = useState<Disposal | null>(null);
  const [status, setStatus] = useState<Status>("AWAITING_DISPOSAL");
  const [machineCode, setMachineCode] = useState("");
  const [proposedDate, setProposedDate] = useState(today);

  async function loadData() {
    try {
      const [machineResponse, recordResponse] = await Promise.all([fetch("/api/machineries"), fetch("/api/disposals")]);
      if (!machineResponse.ok || !recordResponse.ok) throw new Error("ไม่สามารถโหลดข้อมูลจำหน่ายได้ กรุณาลองใหม่");
      setMachines(await machineResponse.json()); setRecords(await recordResponse.json());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถโหลดข้อมูลได้"); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    // Fetch initial records; state updates occur after the network response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const filtered = useMemo(() => records.filter(record => matchesDisposal(record, { query, status: statusFilter, fiscalYear })), [records, query, statusFilter, fiscalYear]);
  const years = useMemo(() => [...new Set(records.map(record => fiscalYearOf(record.proposedDate)))].sort((a, b) => b - a), [records]);
  const choices = machines.filter(machine => machine.status !== "RENTED" && !["W", "M"].includes(machine.condition) && !records.some(record => record.machineryCode === machine.code));
  const selectedMachine = machines.find(machine => machine.code === machineCode);
  const uncaptured = choices.filter(machine => machine.condition === "AWAITING_DISPOSAL" || machine.condition === "DISPOSAL_APPROVED").length;

  function openForm(record: Disposal | null = null, approve = false) {
    setEditing(record); setSelected(null); setError(""); setNotice("");
    setMachineCode(record?.machineryCode ?? ""); setProposedDate(record?.proposedDate ?? today());
    setStatus(approve ? "DISPOSAL_APPROVED" : record?.status ?? "AWAITING_DISPOSAL"); setShowForm(true);
  }
  function chooseMachine(code: string) {
    setMachineCode(code);
    if (machines.find(machine => machine.code === code)?.condition === "DISPOSAL_APPROVED") setStatus("DISPOSAL_APPROVED");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/disposals", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: editing?.id, machineryCode: machineCode, proposedDate, status,
          reason: form.get("reason"), responsiblePerson: form.get("responsiblePerson"),
          approvalDate: form.get("approvalDate"), note: form.get("note") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถบันทึกได้");
      setShowForm(false); setEditing(null); setNotice("บันทึกรายการและปรับสถานะในบัญชีเครื่องจักรแล้ว"); setLoading(true); await loadData();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกได้"); }
    finally { setSaving(false); }
  }

  async function deleteRecord(record: Disposal) {
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/disposals", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: record.id, updatedAt: record.updatedAt }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถลบรายการได้");
      setSelected(null); setEditing(null); setShowForm(false);
      setNotice("ลบรายการจำหน่ายและคืนเครื่องจักรเข้าบัญชีแล้ว ประวัติ Service และซ่อมบำรุงยังอยู่ครบ");
      setLoading(true); await loadData();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถลบรายการได้"); }
    finally { setSaving(false); }
  }

  async function markDisposed(record: Disposal) {
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/disposals", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: record.id, action: "DISPOSE" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถบันทึกจำหน่ายแล้วได้");
      setSelected(null); setNotice("บันทึกจำหน่ายแล้ว เครื่องจักรถูกนำออกจากบัญชีเครื่องจักร โดยเก็บข้อมูลไว้ในระบบจำหน่าย");
      setLoading(true); await loadData();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกได้"); }
    finally { setSaving(false); }
  }

  return <main className="app-shell"><AppSidebar active="disposals" />
    <section className="main-area disposal-page">
      <header className="topbar"><div><p className="eyebrow">รอจำหน่าย → อนุมัติจำหน่าย → จำหน่ายแล้ว</p><h1>ระบบจำหน่ายเครื่องจักร</h1></div><button className="primary" disabled={loading || saving} onClick={() => openForm()}>＋ บันทึกเสนอจำหน่าย</button></header>
      <div className="content service-content">
        <section className="stats-grid service-stats disposal-stats">{Object.entries(disposalLabels).map(([value, label]) => <article className="stat-card" key={value}><span>{label}</span><strong>{records.filter(record => record.status === value).length.toLocaleString("th-TH")}</strong><small>รายการในระบบจำหน่าย</small></article>)}</section>
        {notice && <p className="disposal-notice" role="status">{notice}</p>}
        {uncaptured > 0 && <p className="data-warning">บัญชีเครื่องจักรมีสถานะรอจำหน่าย/อนุมัติจำหน่ายอีก {uncaptured} เครื่องที่ยังไม่ได้บันทึกข้อมูลในระบบนี้ สามารถเลือกเครื่องจักรเพื่อบันทึกข้อมูลเดิมได้</p>}
        <section className="panel"><div className="panel-heading"><div><h2>รายการจำหน่ายเครื่องจักร</h2><p>ปีงบประมาณอ้างอิงวันที่เสนอจำหน่าย (ตุลาคม–กันยายน) · เก็บประวัติเครื่องจักรไว้</p></div></div>
          <div className="service-history-filters disposal-filters">
            <label>ค้นหา<input aria-label="ค้นหารายการจำหน่าย" value={query} onChange={event => setQuery(event.target.value)} placeholder="หมายเลขเครื่องจักร / ชื่อ / ผู้รับผิดชอบ" /></label>
            <label>ปีงบประมาณ<select value={fiscalYear} onChange={event => setFiscalYear(event.target.value)}><option value="">ทุกปีงบประมาณ</option>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
            <label>สถานะ<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(disposalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button type="button" onClick={() => { setQuery(""); setFiscalYear(""); setStatusFilter(""); }}>ล้างตัวกรอง</button>
          </div>
          {error && !showForm && <div className="page-error" role="alert">{error} <button type="button" className="secondary" disabled={loading} onClick={() => { setError(""); setLoading(true); void loadData(); }}>ลองใหม่</button></div>}
          <p className="rental-filter-summary" role="status">{loading ? "กำลังโหลดข้อมูล…" : `พบ ${filtered.length} จาก ${records.length} รายการ`}</p>
          <div className="table-wrap"><table><thead><tr><th>วันที่เสนอ</th><th>หมายเลขเครื่องจักร</th><th>หน่วยงาน / โครงการ</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>
            {filtered.map(record => <tr key={record.id}><td>{dateLabel(record.proposedDate)}</td><td><strong className="machine-code">{record.machineryCode}</strong><span className="muted">{record.machineryName ?? "—"}</span></td><td>{record.currentDepartment ?? "—"}</td><td><strong>{record.responsiblePerson}</strong></td><td><span className={`status status-condition-${record.status}`}>{disposalLabels[record.status]}</span>{record.approvalDate && <span className="muted">{dateLabel(record.approvalDate)}</span>}</td><td><div className="service-row-actions"><button type="button" className="secondary compact-action" onClick={() => setSelected(record)}>รายละเอียด</button>{record.status === "AWAITING_DISPOSAL" && <><button type="button" className="secondary compact-action" disabled={saving} onClick={() => openForm(record)}>แก้ไข</button><button type="button" className="secondary compact-action" disabled={saving} onClick={() => openForm(record, true)}>บันทึกอนุมัติ</button></>}{record.status === "DISPOSAL_APPROVED" && <ConfirmActionButton tone="primary" className="secondary compact-action" title="ยืนยันจำหน่ายแล้ว" message={`ยืนยันว่าเครื่องจักร ${record.machineryCode} จำหน่ายแล้ว? เครื่องจักรจะไม่แสดงในบัญชีเครื่องจักร แต่ยังเก็บข้อมูลและประวัติในระบบจำหน่าย`} confirmLabel="ยืนยันจำหน่ายแล้ว" disabled={saving || loading} onConfirm={() => markDisposed(record)}>จำหน่ายแล้ว</ConfirmActionButton>}<ConfirmActionButton className="danger-button compact-action" title="ยืนยันลบรายการจำหน่าย" message={`ลบรายการจำหน่ายของ ${record.machineryCode} และคืนเครื่องจักรเข้าบัญชีใช่หรือไม่? จะลบเฉพาะรายการจำหน่ายนี้โดยไม่มีปุ่มกู้คืน แต่ยังเก็บข้อมูลเครื่องจักร ประวัติ Service และซ่อมบำรุงไว้`} confirmLabel="ลบและคืนเข้าบัญชี" disabled={saving || loading} onConfirm={() => deleteRecord(record)}>ลบข้อมูล</ConfirmActionButton></div></td></tr>)}
          </tbody></table>{!loading && !filtered.length && <div className="empty-state"><strong>{records.length ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีรายการจำหน่าย"}</strong><span>เลือกบันทึกเสนอจำหน่ายเพื่อเริ่มต้น หรือล้างตัวกรองเพื่อดูรายการทั้งหมด</span></div>}</div>
        </section>
      </div>
    </section>
    {showForm && <div className="modal-backdrop"><section className="modal service-modal" role="dialog" aria-modal="true" aria-labelledby="disposal-form-title">
      <button type="button" className="modal-close" aria-label="ปิดแบบฟอร์ม" disabled={saving} onClick={() => setShowForm(false)}>×</button>
      <h2 id="disposal-form-title">{editing ? "แก้ไข / บันทึกอนุมัติจำหน่าย" : "บันทึกเสนอจำหน่าย"}</h2>
      <form onSubmit={save}><div className="form-grid">
        <label className="wide">หมายเลขเครื่องจักร<input required list="disposal-machineries" value={machineCode} readOnly={!!editing} onChange={event => chooseMachine(event.target.value)} placeholder="เลือกหรือพิมพ์หมายเลขเครื่องจักร" autoComplete="off" /><datalist id="disposal-machineries">{choices.map(machine => <option key={machine.code} value={machine.code}>{machine.name}</option>)}</datalist></label>
        {selectedMachine && <p className="wide disposal-machine-summary">{selectedMachine.name} · {selectedMachine.currentDepartment ?? "—"}</p>}
        <label>วันที่เสนอจำหน่าย<input name="proposedDate" type="date" required value={proposedDate} onChange={event => setProposedDate(event.target.value)} /></label>
        <label className="wide">เหตุผลที่เสนอจำหน่าย<textarea name="reason" required maxLength={4000} defaultValue={editing?.reason ?? ""} /></label>
        <label>ผู้รับผิดชอบ<input name="responsiblePerson" required maxLength={4000} defaultValue={editing?.responsiblePerson ?? ""} /></label>
        <label>สถานะ<select value={status} onChange={event => setStatus(event.target.value as Status)}>{Object.entries(disposalLabels).filter(([value]) => value !== "DISPOSED").map(([value, label]) => <option key={value} value={value} disabled={value === "AWAITING_DISPOSAL" && selectedMachine?.condition === "DISPOSAL_APPROVED"}>{label}</option>)}</select></label>
        {status === "DISPOSAL_APPROVED" && <>
          <label>วันที่อนุมัติ<input name="approvalDate" type="date" min={proposedDate} required defaultValue={editing?.approvalDate ?? today()} /></label>
        </>}
        <label className="wide">หมายเหตุ<textarea name="note" maxLength={4000} defaultValue={editing?.note ?? ""} /></label>
      </div><p className="detail-note">บันทึกแล้วจะปรับสถานะบัญชีเครื่องจักรและระงับการเช่าใหม่ เมื่ออนุมัติแล้วสามารถบันทึก “จำหน่ายแล้ว” เพื่อนำออกจากบัญชีเครื่องจักร โดยยังเก็บข้อมูลไว้ในระบบจำหน่าย</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary" disabled={saving} onClick={() => setShowForm(false)}>ยกเลิก</button><ConfirmSubmitButton title="ยืนยันบันทึกจำหน่าย" message={status === "DISPOSAL_APPROVED" ? "ยืนยันบันทึกสถานะอนุมัติจำหน่าย? รายการนี้จะไม่สามารถแก้ไขหรือย้อนสถานะได้" : "ต้องการบันทึกและเปลี่ยนสถานะเครื่องจักรเป็นรอจำหน่ายใช่หรือไม่?"} confirmLabel="ยืนยันบันทึก" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}</ConfirmSubmitButton></div></form>
    </section></div>}
    {selected && <div className="modal-backdrop"><section className="modal detail-modal disposal-detail" role="dialog" aria-modal="true" aria-labelledby="disposal-detail-title"><h2 id="disposal-detail-title">รายละเอียดจำหน่าย</h2><span className={`status status-condition-${selected.status}`}>{disposalLabels[selected.status]}</span><dl>
      {[["เครื่องจักร", `${selected.machineryCode} — ${selected.machineryName ?? ""}`], ["หน่วยงาน / โครงการ", selected.currentDepartment], ["วันที่เสนอจำหน่าย", dateLabel(selected.proposedDate)], ["เหตุผล", selected.reason], ["ผู้รับผิดชอบ", selected.responsiblePerson], ["วันที่อนุมัติ", dateLabel(selected.approvalDate)], ["หมายเหตุ", selected.note], ["บันทึกจำหน่ายแล้วเมื่อ", selected.status === "DISPOSED" ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(selected.updatedAt)) : "—"], ["รหัสประเภท", selected.machinery?.typeCode], ["ยี่ห้อ / รุ่น", [selected.machinery?.brand, selected.machinery?.model].filter(Boolean).join(" / ")], ["รุ่นเครื่องยนต์", selected.machinery?.engineModel], ["ทะเบียน", selected.machinery?.registrationNumber], ["เลขตัวถัง / หมายเลขประจำเครื่อง", selected.machinery?.serialNumber], ["หน่วยงานเจ้าของ", selected.machinery?.owningDepartment], ["ราคาซื้อ", selected.machinery?.purchasePrice?.toLocaleString("th-TH")], ["หมายเหตุเครื่องจักร", selected.machinery?.note]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}
      </dl><div className="modal-actions"><button type="button" className="secondary" onClick={() => setSelected(null)}>ปิด</button></div></section></div>}
  </main>;
}
