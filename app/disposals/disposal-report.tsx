"use client";

import { createPortal } from "react-dom";
import "./disposal-report.css";

type ReportDisposal = { id: string; machineryCode: string; machineryName: string | null; currentDepartment: string | null; proposedDate: string; reason: string; responsiblePerson: string; approvalDate: string | null; status: "AWAITING_DISPOSAL" | "DISPOSAL_APPROVED" | "DISPOSED" };
const disposalLabels: Record<string, string> = { AWAITING_DISPOSAL: "รอจำหน่าย", DISPOSAL_APPROVED: "อนุมัติจำหน่าย", DISPOSED: "จำหน่ายแล้ว" };
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)) : "—";

export default function DisposalReport({ records, criteria, onClose }: { records: ReportDisposal[]; criteria: string; onClose: () => void }) {
  return createPortal(<div className="disposal-list-report-backdrop"><section className="disposal-list-report-sheet" role="dialog" aria-modal="true" aria-labelledby="disposal-list-report-title">
    <div className="disposal-list-report-controls"><button type="button" className="primary" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button><button type="button" className="secondary" onClick={onClose}>ปิดรายงาน</button></div>
    <header className="disposal-list-report-heading"><img src="/doh-logo.png" alt="ตรากรมทางหลวง" className="disposal-list-report-logo" /><div><strong>กรมทางหลวง</strong><div>ศูนย์สร้างทางขอนแก่น</div></div><small>วันที่พิมพ์ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date())}</small></header>
    <h1 id="disposal-list-report-title">รายงานการจำหน่ายเครื่องจักร</h1><p className="disposal-list-report-criteria">{criteria}</p><p>คัดเลือกรายการตามวันที่เสนอจำหน่าย • {records.length} รายการ</p>
    <table className="disposal-list-print-table"><colgroup><col style={{ width: "4%" }} /><col style={{ width: "10%" }} /><col style={{ width: "18%" }} /><col style={{ width: "14%" }} /><col style={{ width: "22%" }} /><col style={{ width: "12%" }} /><col style={{ width: "10%" }} /><col style={{ width: "10%" }} /></colgroup>
      <thead><tr><th>ลำดับ</th><th>วันที่เสนอ</th><th>เครื่องจักร</th><th>หน่วยงาน/โครงการ</th><th>เหตุผล</th><th>ผู้รับผิดชอบ</th><th>วันที่อนุมัติ</th><th>สถานะ</th></tr></thead>
      <tbody>{records.map((record, index) => <tr key={record.id}><td>{index + 1}</td><td>{dateLabel(record.proposedDate)}</td><td><strong>{record.machineryCode}</strong><br />{record.machineryName ?? ""}</td><td>{record.currentDepartment ?? "—"}</td><td>{record.reason}</td><td>{record.responsiblePerson}</td><td>{dateLabel(record.approvalDate)}</td><td>{disposalLabels[record.status]}</td></tr>)}{!records.length && <tr><td colSpan={8}>ไม่พบรายการตามเงื่อนไขที่เลือก</td></tr>}</tbody>
    </table><footer>เอกสารจากระบบ DOH Equipment Management System</footer>
  </section></div>, document.body);
}
