export const MODULES = ["machineries", "rentals", "service", "repairs", "transfers", "disposals"];
export const ACTIONS = ["read", "edit", "delete"];

export const MODULE_LABELS = {
  machineries: "บัญชีเครื่องจักร",
  rentals: "ระบบเช่า",
  service: "Service",
  repairs: "ซ่อมบำรุง",
  transfers: "ขนย้ายเครื่องจักร",
  disposals: "จำหน่ายเครื่องจักร",
};

export const ACTION_LABELS = { read: "ดู", edit: "เพิ่ม/แก้ไข", delete: "ลบ" };

/** Every module defaults to fully open so existing accounts keep working exactly as before until an admin explicitly restricts something. */
export function defaultPermissions() {
  return Object.fromEntries(MODULES.map((module) => [module, { read: true, edit: true, delete: true }]));
}

/** Fills in any missing module/action with the open default, so a partially-saved or legacy permissions object still behaves safely. */
export function normalizePermissions(raw) {
  const result = {};
  for (const module of MODULES) {
    const entry = raw && typeof raw === "object" ? raw[module] : null;
    result[module] = {
      read: entry?.read !== false,
      edit: entry?.edit !== false,
      delete: entry?.delete !== false,
    };
  }
  return result;
}

/** @param {{role: string, permissions?: unknown}|null} user */
export function hasPermission(user, module, action) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return normalizePermissions(user.permissions)[module]?.[action] === true;
}
