export const AUTH_TIMEOUT_MS = 12_000;
const unavailable = "ไม่สามารถติดต่อระบบเข้าสู่ระบบได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่";

// Bound the whole request, including a response body that never finishes.
export async function authRequest(url, init = {}, { signal, timeoutMs = AUTH_TIMEOUT_MS, fetchImpl = fetch, allowUnauthorized = false } = {}) {
  const controller = new AbortController();
  let timer;
  let cancel;
  const interrupted = new Promise((_, reject) => {
    cancel = () => { reject(new DOMException("Cancelled", "AbortError")); controller.abort(); };
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => {
      reject(new Error("ตรวจสอบการเข้าสู่ระบบนานเกินไป กรุณาลองใหม่"));
      controller.abort();
    }, timeoutMs);
  });
  const request = async () => {
    if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
    let response;
    try { response = await fetchImpl(url, { ...init, cache: "no-store", signal: controller.signal }); }
    catch { throw new Error(unavailable); }
    if (allowUnauthorized && response.status === 401) return null;
    let data;
    try { data = await response.json(); } catch { throw new Error(unavailable); }
    if (!response.ok) throw new Error(response.status < 500 && typeof data?.message === "string" ? data.message : unavailable);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(unavailable);
    return data;
  };
  try { return await Promise.race([interrupted, request()]); }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export async function checkSession(options = {}) {
  const data = await authRequest("/api/auth/me", {}, { ...options, allowUnauthorized: true });
  if (data === null) return null;
  if (!data || typeof data.id !== "string" || !data.id || typeof data.username !== "string" ||
      typeof data.displayName !== "string" || !["ADMIN", "STAFF"].includes(data.role)) throw new Error(unavailable);
  return data;
}
