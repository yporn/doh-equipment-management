"use client";

import { createPortal } from "react-dom";
import "./transfer-report.css";

type ReportLocation = { kind: "DEPARTMENT" | "OTHER"; name: string };
type ReportItem = { machineryCode: string; from: ReportLocation; to: ReportLocation };
type ReportTrip = { id: string; transferDate: string; transporters: string[]; items: ReportItem[] };
const dateLabel = (value: string) => new Intl.DateTimeFormat("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${value}T00:00:00`));

export default function TransferReport({ records, criteria, onClose }: { records: ReportTrip[]; criteria: string; onClose: () => void }) {
  const rows = records.flatMap((record) => record.items.map((item, index) => ({ record, item, index })));
  const machineCount = new Set(records.flatMap((record) => record.items.map((item) => item.machineryCode))).size;
  return createPortal(<div className="transfer-report-backdrop"><section className="transfer-report-sheet" role="dialog" aria-modal="true" aria-labelledby="transfer-report-title">
    <div className="transfer-report-controls"><button type="button" className="primary" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button><button type="button" className="secondary" onClick={onClose}>ปิดรายงาน</button></div>
    <header className="transfer-report-heading"><img src="/doh-logo.png" alt="ตรากรมทางหลวง" className="transfer-report-logo" /><div><strong>กรมทางหลวง</strong><div>ศูนย์สร้างทางขอนแก่น</div></div><small>วันที่พิมพ์ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date())}</small></header>
    <h1 id="transfer-report-title">รายงานการขนย้ายเครื่องจักร</h1><p className="transfer-report-criteria">{criteria}</p><p>คัดเลือกรายการตามวันที่ขนย้าย • {records.length} เที่ยว • {rows.length} รายการ • {machineCount} เครื่อง</p>
    <table className="transfer-print-table"><colgroup><col style={{ width: "4%" }} /><col style={{ width: "12%" }} /><col style={{ width: "18%" }} /><col style={{ width: "16%" }} /><col style={{ width: "50%" }} /></colgroup>
      <thead><tr><th>ลำดับ</th><th>วันที่ขนย้าย</th><th>ขนย้ายโดย</th><th>เครื่องจักร</th><th>เส้นทาง</th></tr></thead>
      <tbody>{rows.map(({ record, item, index }, position) => <tr key={`${record.id}-${index}`}>
        <td>{position + 1}</td>
        <td>{dateLabel(record.transferDate)}</td>
        <td>{record.transporters.join(", ")}</td>
        <td><strong>{item.machineryCode}</strong></td>
        <td>{item.from.name}{item.from.kind === "OTHER" ? " (อื่นๆ)" : ""} → {item.to.name}{item.to.kind === "OTHER" ? " (อื่นๆ)" : ""}</td>
      </tr>)}{!rows.length && <tr><td colSpan={5}>ไม่พบรายการตามเงื่อนไขที่เลือก</td></tr>}</tbody>
    </table><footer>เอกสารจากระบบ DOH Equipment Management System</footer>
  </section></div>, document.body);
}
