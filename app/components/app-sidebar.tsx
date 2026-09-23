"use client";
import type { ReactNode } from "react";
import { useAuth } from "../auth-context";

export type SidebarSection = "dashboard" | "machineries" | "rentals" | "service" | "repairs" | "transfers" | "disposals" | "users";

const iconProps = { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
// One consistent outline icon per section — matched to what each page actually tracks, not decorative.
const NAV_ICONS: Record<SidebarSection, ReactNode> = {
  dashboard: <svg {...iconProps}><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" /></svg>,
  machineries: <svg {...iconProps}><path d="M9 3.5h6a1 1 0 0 1 1 1V6h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1V4.5a1 1 0 0 1 1-1Z" /><path d="M9 3.5h6V7H9z" /><path d="M8 12.5h8M8 16.5h8" /></svg>,
  rentals: <svg {...iconProps}><path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5" /><path d="M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5" /></svg>,
  service: <svg {...iconProps}><path d="M12 2.8c-3.3 4.7-5.5 7.9-5.5 10.7a5.5 5.5 0 0 0 11 0c0-2.8-2.2-6-5.5-10.7Z" /></svg>,
  repairs: <svg {...iconProps}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77Z" /></svg>,
  transfers: <svg {...iconProps}><path d="M4 4.5v5h5" /><path d="M20 19.5v-5h-5" /><path d="M5.3 15a7 7 0 0 0 12.1 3" /><path d="M18.7 9a7 7 0 0 0-12.1-3" /></svg>,
  disposals: <svg {...iconProps}><path d="M20.6 13.4 13 21a2 2 0 0 1-2.8 0L3.4 14.2A2 2 0 0 1 3 13V4a1 1 0 0 1 1-1h9a2 2 0 0 1 1.4.6l6.2 6.2a2 2 0 0 1 0 2.8Z" /><circle cx="8" cy="8" r="1.6" /></svg>,
  users: <svg {...iconProps}><circle cx="12" cy="8.2" r="3.7" /><path d="M4.5 20.5c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5" /></svg>,
};

export default function AppSidebar({ active }: { active: SidebarSection }) {
  const { user, logout } = useAuth();
  // Use native document navigation: the hosted client router can stall module changes.
  const link = (path: string, section: SidebarSection, label: string) => <a className={active === section ? "active" : ""} aria-current={active === section ? "page" : undefined} href={path}><span>{NAV_ICONS[section]}</span> {label}</a>;
  return <aside className="sidebar app-sidebar"><div className="sidebar-inner"><div className="brand"><div className="brand-mark">ทล.</div><div><strong>ศูนย์สร้างทางขอนแก่น</strong><span>กรมทางหลวง</span></div></div><nav aria-label="เมนูหลัก">{link("/", "dashboard", "ภาพรวม")}{link("/machineries", "machineries", "บัญชีเครื่องจักร")}{link("/rentals", "rentals", "ระบบเช่า")}{link("/service", "service", "Service")}{link("/repairs", "repairs", "ซ่อมบำรุง")}{link("/transfers", "transfers", "ขนย้ายเครื่องจักร")}{link("/disposals", "disposals", "จำหน่ายเครื่องจักร")}{user?.role === "ADMIN" && link("/users", "users", "ผู้ใช้งาน")}</nav><div className="sidebar-bottom"><div className="profile"><div className="avatar">{user?.displayName.slice(0, 1) ?? "ผ"}</div><div><strong>{user?.displayName ?? "ผู้ใช้งาน"}</strong><span>{user?.role === "ADMIN" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"}</span></div></div><button className="logout-link" onClick={() => void logout()}>ออกจากระบบ</button></div></div></aside>;
}
