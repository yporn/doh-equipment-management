"use client";

import { createPortal } from "react-dom";
import "./repair-report.css";

type ReportRepair = { id: string; machineryCode: string; machineryName: string | null; repairDate: string; workSystems: string[]; repairType: "SELF" | "OUTSOURCED" | null; reporter: string; status: "WAITING" | "WAITING_PARTS" | "IN_PROGRESS" | "COMPLETED" };
const statusLabels: Record<string, string> = { WAITING: "รอตรวจสอบ", WAITING_PARTS: "รออะไหล่", IN_PROGRESS: "กำลังซ่อม", COMPLETED: "ซ่อมเสร็จ" };
const thaiDate = (value: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));

export default function RepairReport({ records, criteria, onClose }: { records: ReportRepair[]; criteria: string; onClose: () => void }) {
  return createPortal(<div className="repair-report-backdrop"><section className="repair-report-sheet" role="dialog" aria-modal="true" aria-labelledby="repair-report-title">
    <div className="repair-report-controls"><button type="button" className="primary" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button><button type="button" className="secondary" onClick={onClose}>ปิดรายงาน</button></div>
    <header className="repair-report-heading"><img src="/doh-logo.png" alt="ตรากรมทางหลวง" className="repair-report-logo" /><div><strong>กรมทางหลวง</strong><div>ศูนย์สร้างทางขอนแก่น</div></div><small>วันที่พิมพ์ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date())}</small></header>
    <h1 id="repair-report-title">รายงานงานซ่อมบำรุงเครื่องจักร</h1><p className="repair-report-criteria">{criteria}</p><p>คัดเลือกรายการตามวันที่เข้าซ่อม • {records.length} รายการ • {new Set(records.map(record => record.machineryCode)).size} เครื่อง</p>
    <table className="repair-print-table"><colgroup><col style={{ width: "4%" }} /><col style={{ width: "10%" }} /><col style={{ width: "18%" }} /><col style={{ width: "24%" }} /><col style={{ width: "10%" }} /><col style={{ width: "16%" }} /><col style={{ width: "12%" }} /></colgroup>
      <thead><tr><th>ลำดับ</th><th>วันที่เข้าซ่อม</th><th>เครื่องจักร</th><th>งานซ่อม</th><th>ประเภท</th><th>ผู้แจ้ง</th><th>สถานะ</th></tr></thead>
      <tbody>{records.map((record, index) => <tr key={record.id}><td>{index + 1}</td><td>{thaiDate(record.repairDate)}</td><td><strong>{record.machineryCode}</strong><br />{record.machineryName ?? ""}</td><td>{record.workSystems.join(", ")}</td><td>{record.repairType === "SELF" ? "ซ่อมเอง" : record.repairType === "OUTSOURCED" ? "จ้างซ่อม" : "—"}</td><td>{record.reporter}</td><td>{statusLabels[record.status]}</td></tr>)}{!records.length && <tr><td colSpan={7}>ไม่พบรายการตามเงื่อนไขที่เลือก</td></tr>}</tbody>
    </table><footer>เอกสารจากระบบ DOH Equipment Management System</footer>
  </section></div>, document.body);
}
