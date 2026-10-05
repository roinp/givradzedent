"use client";

import { useState } from "react";

export default function DraftNotice({ restored, onReset }: { restored: boolean; onReset: () => void }) {
  const [visible, setVisible] = useState(restored);
  if (!visible) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <span>↺ აღდგენილია შეუნახავი მონაცემები</span>
      <button
        type="button"
        className="font-medium underline hover:no-underline"
        onClick={() => {
          onReset();
          setVisible(false);
        }}
      >
        გასუფთავება
      </button>
    </div>
  );
}
