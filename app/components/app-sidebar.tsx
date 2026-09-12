"use client";
import { useAuth } from "../auth-context";

export type SidebarSection = "dashboard" | "machineries" | "rentals" | "service" | "repairs" | "transfers" | "disposals" | "users";

export default function AppSidebar({ active }: { active: SidebarSection }) {
  const { user, logout } = useAuth();
  // Use native document navigation: the hosted client router can stall module changes.
  const link = (path: string, section: SidebarSection, icon: string, label: string) => <a className={active === section ? "active" : ""} aria-current={active === section ? "page" : undefined} href={path}><span>{icon}</span> {label}</a>;
  return <aside className="sidebar app-sidebar"><div className="brand"><div className="brand-mark">ทล.</div><div><strong>ศูนย์สร้างทางขอนแก่น</strong><span>กรมทางหลวง</span></div></div><nav aria-label="เมนูหลัก">{link("/", "dashboard", "▦", "ภาพรวม")}{link("/machineries", "machineries", "▣", "บัญชีเครื่องจักร")}{link("/rentals", "rentals", "↔", "ระบบเช่า")}{link("/service", "service", "◷", "Service")}{link("/repairs", "repairs", "⌁", "ซ่อมบำรุง")}{link("/transfers", "transfers", "⇄", "ขนย้ายเครื่องจักร")}{link("/disposals", "disposals", "▧", "จำหน่ายเครื่องจักร")}<a href="#reports"><span>▤</span> รายงาน</a>{user?.role === "ADMIN" && link("/users", "users", "♙", "ผู้ใช้งาน")}</nav><div className="sidebar-bottom"><div className="profile"><div className="avatar">{user?.displayName.slice(0, 1) ?? "ผ"}</div><div><strong>{user?.displayName ?? "ผู้ใช้งาน"}</strong><span>{user?.role === "ADMIN" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"}</span></div></div><button className="logout-link" onClick={() => void logout()}>ออกจากระบบ</button></div></aside>;
}
