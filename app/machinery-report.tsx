"use client";

import { createPortal } from "react-dom";
import "./machinery-report.css";

type ReportMachine = { code: string; typeCode: string | null; name: string; brand: string; model: string | null; currentDepartment: string; renterDepartment?: string | null; condition: string; status: string };
const conditionLabel: Record<string, string> = { W: "W — เช่าใช้งาน", M: "M — ขอใช้งาน", AVAILABLE: "พร้อมใช้งาน (ว่าง)", DAMAGED: "ชำรุด", MAINTENANCE: "ซ่อมบำรุง", AWAITING_DISPOSAL: "รอจำหน่าย", DISPOSAL_APPROVED: "อนุมัติจำหน่าย" };

export default function MachineryReport({ records, criteria, onClose }: { records: ReportMachine[]; criteria: string; onClose: () => void }) {
  return createPortal(<div className="machinery-report-backdrop"><section className="machinery-report-sheet" role="dialog" aria-modal="true" aria-labelledby="machinery-report-title">
    <div className="machinery-report-controls"><button type="button" className="primary" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button><button type="button" className="secondary" onClick={onClose}>ปิดรายงาน</button></div>
    <header className="machinery-report-heading"><img src="/doh-logo.png" alt="ตรากรมทางหลวง" className="machinery-report-logo" /><div><strong>กรมทางหลวง</strong><div>ศูนย์สร้างทางขอนแก่น</div></div><small>วันที่พิมพ์ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date())}</small></header>
    <h1 id="machinery-report-title">รายงานบัญชีเครื่องจักร</h1><p className="machinery-report-criteria">{criteria}</p><p>คัดเลือกตามตัวกรองที่ใช้งานอยู่ • {records.length} รายการ</p>
    <table className="machinery-print-table"><colgroup><col style={{ width: "4%" }} /><col style={{ width: "12%" }} /><col style={{ width: "8%" }} /><col style={{ width: "26%" }} /><col style={{ width: "18%" }} /><col style={{ width: "18%" }} /><col style={{ width: "14%" }} /></colgroup>
      <thead><tr><th>ลำดับ</th><th>หมายเลขเครื่องจักร</th><th>รหัสประเภท</th><th>รายละเอียด</th><th>หน่วยงาน/โครงการที่อยู่</th><th>หน่วยงาน/โครงการที่เช่า</th><th>สถานะ</th></tr></thead>
      <tbody>{records.map((record, index) => <tr key={record.code}><td>{index + 1}</td><td><strong>{record.code}</strong></td><td>{record.typeCode ?? "—"}</td><td>{record.name}<br />{[record.brand, record.model].filter(Boolean).join(" ")}</td><td>{record.currentDepartment}</td><td>{record.renterDepartment || "—"}</td><td>{conditionLabel[record.condition] ?? record.condition}</td></tr>)}{!records.length && <tr><td colSpan={7}>ไม่พบรายการตามเงื่อนไขที่เลือก</td></tr>}</tbody>
    </table><footer>เอกสารจากระบบ DOH Equipment Management System</footer>
  </section></div>, document.body);
}
