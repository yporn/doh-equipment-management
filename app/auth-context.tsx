"use client";
/* eslint-disable @next/next/no-img-element */
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { authRequest, checkSession } from "../lib/auth-request.mjs";

type User = { id: string; username: string; displayName: string; role: "ADMIN" | "STAFF" };
const AuthContext = createContext<{ user: User | null; logout: () => Promise<void> }>({ user: null, logout: async () => {} });
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname === "/login";
  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<"checking" | "ready" | "error">("checking");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void checkSession({ signal: controller.signal }).then((current: User | null) => {
      if (!active) return;
      setUser(current);
      setPhase("ready");
      // Use full navigation so authentication cannot stall on a client-router transition.
      if (!current && !isPublic) window.location.replace("/login");
      else if (current && isPublic) window.location.replace("/");
    }).catch((caught: unknown) => {
      if (!active) return;
      setUser(null);
      setError(caught instanceof Error ? caught.message : "ไม่สามารถตรวจสอบการเข้าสู่ระบบได้");
      setPhase("error");
    });
    return () => { active = false; controller.abort(); };
  }, [isPublic, attempt]);

  function retry() { setUser(null); setError(""); setPhase("checking"); setAttempt(value => value + 1); }
  async function logout() {
    try {
      await authRequest("/api/auth/logout", { method: "POST" });
      setUser(null);
      window.location.replace("/login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถออกจากระบบได้");
      setPhase("error");
    }
  }
  if (phase !== "ready" || (!isPublic && !user) || (isPublic && user)) return (
    <main className="auth-loading"><section className="auth-status-card">
      <img src="/doh-logo.png" alt="กรมทางหลวง" />
      {phase === "error" ? <>
        <h1>ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ</h1>
        <p role="alert">{error}</p>
        <button type="button" className="primary" onClick={retry}>ลองใหม่</button>
      </> : <p role="status">{phase === "checking" ? "กำลังตรวจสอบการเข้าสู่ระบบ…" : "กำลังเปลี่ยนหน้า…"}</p>}
      <a className="auth-login-link" href="/login">ไปหน้าเข้าสู่ระบบ</a>
    </section></main>
  );
  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}
