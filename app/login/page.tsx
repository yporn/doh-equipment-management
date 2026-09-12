"use client";
/* eslint-disable @next/next/no-img-element */
import { FormEvent, useEffect, useState } from "react";
import { authRequest } from "../../lib/auth-request.mjs";

export default function LoginPage() {
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void authRequest("/api/auth/status", {}, { signal: controller.signal }).then(data => {
      if (typeof data?.setupRequired !== "boolean") throw new Error("ข้อมูลสถานะระบบไม่ถูกต้อง กรุณาลองใหม่");
      if (active) setSetupRequired(data.setupRequired);
    }).catch((caught: unknown) => {
      if (active) setLoadError(caught instanceof Error ? caught.message : "ไม่สามารถโหลดสถานะระบบได้");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt]);
  function retry() { setLoadError(""); setLoading(true); setAttempt(value => value + 1); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const endpoint = setupRequired ? "/api/auth/setup" : "/api/auth/login";
    const body = setupRequired ? { username: form.get("username"), displayName: form.get("displayName"), password: form.get("password") } : { username: form.get("username"), password: form.get("password") };
    try {
      await authRequest(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      window.location.href = "/";
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถเข้าสู่ระบบได้"); }
    finally { setSaving(false); }
  }
  return <main className="login-page"><section className="login-card">
    <img src="/doh-logo.png" alt="ตรากรมทางหลวง" /><p className="login-agency">กรมทางหลวง</p><h1>ศูนย์สร้างทางขอนแก่น</h1><p className="login-subtitle">DOH Equipment Management System</p>
    {loading ? <p role="status">กำลังโหลด…</p> : loadError ? <div><p className="form-error" role="alert">{loadError}</p><button type="button" className="primary" onClick={retry}>ลองใหม่</button></div> : <form onSubmit={submit}>
      {setupRequired && <><div className="setup-notice"><strong>ตั้งค่าระบบครั้งแรก</strong><span>สร้างบัญชีผู้ดูแลระบบคนแรก</span></div><label>ชื่อ-นามสกุล<input name="displayName" required autoComplete="name" /></label></>}
      <label>ชื่อผู้ใช้<input name="username" required minLength={4} pattern="[A-Za-z0-9._-]+" autoComplete="username" placeholder="ภาษาอังกฤษอย่างน้อย 4 ตัว" /></label>
      <label>รหัสผ่าน<input name="password" type="password" required minLength={8} autoComplete={setupRequired ? "new-password" : "current-password"} placeholder="อย่างน้อย 8 ตัว" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary" disabled={saving}>{saving ? "กำลังดำเนินการ…" : setupRequired ? "สร้างผู้ดูแลและเริ่มใช้งาน" : "เข้าสู่ระบบ"}</button>
    </form>}
  </section></main>;
}
