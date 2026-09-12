"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import AppSidebar from "../components/app-sidebar";
import { ConfirmActionButton, ConfirmSubmitButton } from "../components/confirm-action";

type Account = {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "STAFF";
  active: number;
};
export default function UsersPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  async function load() {
    const response = await fetch("/api/users");
    if (response.ok) setAccounts(await response.json());
    else setError((await response.json()).message ?? "ไม่สามารถโหลดบัญชีได้");
  }
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    fetch("/api/users").then(async (response) => {
      if (response.ok) setAccounts(await response.json());
      else setError((await response.json()).message ?? "ไม่สามารถโหลดบัญชีได้");
    });
  }, [user]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok)
      return setError(result.message ?? "ไม่สามารถเพิ่มบัญชีได้");
    setMessage(result.message ?? "สำเร็จ");
    setShowCreate(false);
    await load();
  }
  async function toggle(account: Account) {
    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: account.id, active: !account.active }),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok)
      return setError(result.message ?? "ไม่สามารถแก้ไขบัญชีได้");
    await load();
  }
  if (user?.role !== "ADMIN")
    return (
      <main className="access-denied">
        <h1>ไม่มีสิทธิ์เข้าถึง</h1>
        <p>เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการบัญชีผู้ใช้ได้</p>
        <a href="/">กลับหน้าหลัก</a>
      </main>
    );
  return (
    <main className="app-shell users-page">
      <AppSidebar active="users" />
      <section className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">ตั้งค่าระบบ</p>
            <h1>จัดการผู้ใช้งาน</h1>
          </div>
          <button
            className="primary"
            onClick={() => {
              setError("");
              setShowCreate(true);
            }}
          >
            ＋ เพิ่มผู้ใช้งาน
          </button>
        </header>
        <div className="content">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>บัญชีทั้งหมด</h2>
                <p>ผู้ดูแลระบบและเจ้าหน้าที่ที่เข้าใช้งานระบบได้</p>
              </div>
            </div>
            {error && <p className="page-error">{error}</p>}
            {message && <p className="success-message">{message}</p>}
            <div className="user-list">
              {accounts.map((account) => (
                <article key={account.id}>
                  <div className="avatar">
                    {account.displayName.slice(0, 1)}
                  </div>
                  <div>
                    <strong>{account.displayName}</strong>
                    <span>
                      @{account.username} ·{" "}
                      {account.role === "ADMIN" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"}
                    </span>
                  </div>
                  <span
                    className={`account-state ${account.active ? "active" : "inactive"}`}
                  >
                    {account.active ? "ใช้งาน" : "ปิดใช้งาน"}
                  </span>
                  <ConfirmActionButton className="secondary" tone={account.active ? "danger" : "primary"} title={account.active ? "ยืนยันการปิดบัญชี" : "ยืนยันการเปิดบัญชี"} message={`ต้องการ${account.active ? "ปิด" : "เปิด"}บัญชีของ ${account.displayName} ใช่หรือไม่?`} confirmLabel={account.active ? "ยืนยันการปิด" : "ยืนยันการเปิด"} disabled={account.id === user.id} onConfirm={() => toggle(account)}>
                    {account.active ? "ปิดบัญชี" : "เปิดบัญชี"}
                  </ConfirmActionButton>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
      {showCreate && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog">
            <button
              className="modal-close"
              onClick={() => setShowCreate(false)}
            >
              ×
            </button>
            <h2>เพิ่มผู้ใช้งาน</h2>
            <form onSubmit={create}>
              <div className="form-grid">
                <label className="wide">
                  ชื่อ-นามสกุล
                  <input name="displayName" required />
                </label>
                <label className="wide">
                  ชื่อผู้ใช้
                  <input
                    name="username"
                    required
                    minLength={4}
                    pattern="[A-Za-z0-9._-]+"
                  />
                </label>
                <label>
                  สิทธิ์
                  <select name="role" defaultValue="STAFF">
                    <option value="STAFF">เจ้าหน้าที่</option>
                    <option value="ADMIN">ผู้ดูแลระบบ</option>
                  </select>
                </label>
                <label>
                  รหัสผ่านเริ่มต้น
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={8}
                  />
                </label>
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowCreate(false)}
                >
                  ยกเลิก
                </button>
                <ConfirmSubmitButton title="ยืนยันการเพิ่มข้อมูล" message="ต้องการเพิ่มบัญชีผู้ใช้งานนี้เข้าสู่ระบบใช่หรือไม่?" confirmLabel="ยืนยันการเพิ่ม">บันทึกบัญชี</ConfirmSubmitButton>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
