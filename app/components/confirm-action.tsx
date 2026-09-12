"use client";
import { MouseEvent, ReactNode, useState } from "react";

type Tone = "primary" | "danger";
type CommonProps = { title: string; message: string; confirmLabel: string; tone?: Tone; disabled?: boolean; className?: string; children: ReactNode };

function ConfirmModal({ title, message, confirmLabel, tone = "primary", busy = false, onCancel, onConfirm }: { title: string; message: string; confirmLabel: string; tone?: Tone; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop confirm-action-backdrop"><section className="modal confirm-action-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-title"><div className={`confirm-action-icon ${tone}`}>{tone === "danger" ? "!" : "✓"}</div><h2 id="confirm-action-title">{title}</h2><p>{message}</p><div className="modal-actions"><button type="button" className="secondary" onClick={onCancel} disabled={busy}>ยกเลิก</button><button type="button" className={tone === "danger" ? "danger-button" : "primary"} onClick={onConfirm} disabled={busy}>{busy ? "กำลังดำเนินการ…" : confirmLabel}</button></div></section></div>;
}

export function ConfirmSubmitButton({ title, message, confirmLabel, tone, disabled, className = "primary", children }: CommonProps) {
  const [open, setOpen] = useState(false);
  function prepare(event: MouseEvent<HTMLButtonElement>) { const form = event.currentTarget.closest("form"); if (!form?.reportValidity()) return; setOpen(true); }
  function confirm(event: MouseEvent<HTMLButtonElement>) { const form = event.currentTarget.closest("form"); setOpen(false); form?.requestSubmit(); }
  return <><button type="button" className={className} disabled={disabled} onClick={prepare}>{children}</button>{open && <ConfirmModal title={title} message={message} confirmLabel={confirmLabel} tone={tone} onCancel={() => setOpen(false)} onConfirm={confirm} />}</>;
}

export function ConfirmActionButton({ title, message, confirmLabel, tone = "danger", disabled, className = "delete-button", children, onConfirm }: CommonProps & { onConfirm: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  async function confirm() { setBusy(true); try { await onConfirm(); setOpen(false); } finally { setBusy(false); } }
  return <><button type="button" className={className} disabled={disabled} onClick={() => setOpen(true)}>{children}</button>{open && <ConfirmModal title={title} message={message} confirmLabel={confirmLabel} tone={tone} busy={busy} onCancel={() => setOpen(false)} onConfirm={() => void confirm()} />}</>;
}
