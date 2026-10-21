"use client";

import { useState } from "react";
import Modal from "./Modal";

export default function ConfirmDialog({
  message,
  onConfirm,
  onClose,
  confirmLabel = "წაშლა",
  busyLabel = "იშლება...",
  cancelLabel = "გაუქმება",
}: {
  message: string;
  confirmLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="დადასტურება" onClose={onClose}>
      <p className="text-slate-700">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          {cancelLabel}
        </button>
        <button
          className="btn-danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
          }}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
