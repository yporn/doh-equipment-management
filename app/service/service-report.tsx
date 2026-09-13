"use client";

import { createPortal } from "react-dom";
import "./service-report.css";

type ReportItem = { serviceType: string; description: string; quantity: number | null; unit: string | null };
type ReportService = { id: string; machineryCode: string; machineryName: string | null; serviceDate: string; documentNumber: string | null; provider: string | null; technician: string | null; items: ReportItem[] };
const thaiDate = (value: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
const itemLabel = (item: ReportItem) => item.quantity ? `${item.description} (${item.quantity.toLocaleString("th-TH")} ${item.unit ?? ""})` : item.description;

export default function ServiceReport({ records, criteria, onClose }: { records: ReportService[]; criteria: string; onClose: () => void }) {
  return createPortal(<div className="service-list-report-backdrop"><section className="service-list-report-sheet" role="dialog" aria-modal="true" aria-labelledby="service-list-report-title">
    <div className="service-list-report-controls"><button type="button" className="primary" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button><button type="button" className="secondary" onClick={onClose}>ปิดรายงาน</button></div>
    <header className="service-list-report-heading"><img src="/doh-logo.png" alt="ตรากรมทางหลวง" className="service-list-report-logo" /><div><strong>กรมทางหลวง</strong><div>ศูนย์สร้างทางขอนแก่น</div></div><small>วันที่พิมพ์ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date())}</small></header>
    <h1 id="service-list-report-title">รายงานประวัติ Service เครื่องจักร</h1><p className="service-list-report-criteria">{criteria}</p><p>คัดเลือกรายการตามวันที่ Service • {records.length} รายการ • {new Set(records.map(record => record.machineryCode)).size} เครื่อง</p>
    <table className="service-list-print-table"><colgroup><col style={{ width: "4%" }} /><col style={{ width: "11%" }} /><col style={{ width: "12%" }} /><col style={{ width: "15%" }} /><col style={{ width: "36%" }} /><col style={{ width: "11%" }} /><col style={{ width: "11%" }} /></colgroup>
      <thead><tr><th>ลำดับ</th><th>วันที่</th><th>เลขที่เอกสาร</th><th>เครื่องจักร</th><th>รายการ Service</th><th>ผู้ให้บริการ</th><th>ผู้ดำเนินการ</th></tr></thead>
      <tbody>{records.map((record, index) => <tr key={record.id}><td>{index + 1}</td><td>{thaiDate(record.serviceDate)}</td><td>{record.documentNumber ?? "—"}</td><td><strong>{record.machineryCode}</strong><br />{record.machineryName ?? ""}</td><td>{record.items.map(itemLabel).join(", ")}</td><td>{record.provider ?? "—"}</td><td>{record.technician ?? "—"}</td></tr>)}{!records.length && <tr><td colSpan={7}>ไม่พบรายการตามเงื่อนไขที่เลือก</td></tr>}</tbody>
    </table><footer>เอกสารจากระบบ DOH Equipment Management System</footer>
  </section></div>, document.body);
}
