"use client";

import { createPortal } from "react-dom";
import "./rental-report.css";
import "./report-brand.css";

type ReportRental = { id: string; machineryCode: string; machineryName: string | null; renterName: string; rentalMode: "W" | "M"; startDate: string; expectedReturnDate: string; duration: number; rateType: string; totalAmount: number; note: string | null };
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${value}T00:00:00`)) : "—";
const money = (value: number) => value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const units: Record<string, string> = { DAILY: "วัน", WEEKLY: "สัปดาห์", MONTHLY: "เดือน", YEARLY: "ปี" };

export default function RentalReport({ records, criteria, onClose }: { records: ReportRental[]; criteria: string; onClose: () => void }) {
  const total = records.reduce((sum, record) => sum + record.totalAmount, 0);
  return createPortal(<div className="rental-report-backdrop"><section className="rental-report-sheet" role="dialog" aria-modal="true" aria-labelledby="rental-report-title">
    <div className="rental-report-controls"><button type="button" className="primary" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button><button type="button" className="secondary" onClick={onClose}>ปิดรายงาน</button></div>
    <header className="rental-report-heading"><img src="/doh-logo.png" alt="ตรากรมทางหลวง" className="rental-report-logo" /><div><strong>กรมทางหลวง</strong><div>ศูนย์สร้างทางขอนแก่น</div></div><small>วันที่พิมพ์ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date())}</small></header>
    <h1 id="rental-report-title">รายงานการเช่าเครื่องจักร</h1><p className="rental-report-criteria">{criteria}</p><p>คัดเลือกรายการตามวันเริ่มเช่า • {records.length} รายการ • {new Set(records.map(record => record.machineryCode)).size} เครื่อง</p>
    <p className="rental-report-note">ยอดรวมเป็นค่าเช่าตลอดระยะเวลาที่บันทึก ไม่ใช่ค่าเช่าเฉลี่ยเฉพาะเดือน และไม่ใช่ยอดรับชำระ</p>
    <table className="rental-print-table"><colgroup><col style={{ width: "4%" }} /><col style={{ width: "18%" }} /><col style={{ width: "21%" }} /><col style={{ width: "10%" }} /><col style={{ width: "9%" }} /><col style={{ width: "9%" }} /><col style={{ width: "8%" }} /><col style={{ width: "11%" }} /><col style={{ width: "10%" }} /></colgroup>
      <thead><tr><th>ลำดับ</th><th>เครื่องจักร</th><th>หน่วยงาน/โครงการที่เช่า</th><th>ประเภท</th><th>เริ่มเช่า</th><th>วันสิ้นสุด</th><th>ระยะเวลา</th><th>ค่าเช่ารวม (บาท)</th><th>หมายเหตุ</th></tr></thead>
      <tbody>{records.map((record, index) => <tr key={record.id}><td>{index + 1}</td><td><strong>{record.machineryCode}</strong><br />{record.machineryName ?? ""}</td><td>{record.renterName}</td><td>{record.rentalMode === "W" ? "W-เช่าใช้งาน" : "M-ขอใช้งาน"}</td><td>{dateLabel(record.startDate)}</td><td>{dateLabel(record.expectedReturnDate)}</td><td>{record.duration} {units[record.rateType]}</td><td className="rental-report-money">{money(record.totalAmount)}</td><td>{record.note ?? "—"}</td></tr>)}{!records.length && <tr><td colSpan={9}>ไม่พบรายการตามเงื่อนไขที่เลือก</td></tr>}</tbody>
    </table><p className="rental-report-total">รวมค่าเช่าตามรายการ {money(total)} บาท</p><footer>เอกสารจากระบบ DOH Equipment Management System</footer>
  </section></div>, document.body);
}
