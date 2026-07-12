"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { updateOrderStatus } from "@/lib/actions/orders";
import type { OrderStatus } from "@/types";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/types";
import { VALID_TRANSITIONS } from "@/lib/orders/status-transitions";

const COLOR_CLASSES: Record<string, string> = {
  warning: "bg-warning/10 border-warning/30 text-warning",
  success: "bg-success/10 border-success/30 text-success",
  info:    "bg-info/10 border-info/30 text-info",
  danger:  "bg-danger/10 border-danger/30 text-danger",
  neutral: "bg-dark-alt border-dark-border text-muted",
};

interface Props {
  currentStatus: OrderStatus;
  orderId?: string;
  onStatusChange?: (newStatus: OrderStatus) => Promise<void> | void;
}

export const OrderStatusSelect = ({ currentStatus, orderId, onStatusChange }: Props) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const next = VALID_TRANSITIONS[currentStatus];

  const currentClasses =
    COLOR_CLASSES[ORDER_STATUS_COLORS[currentStatus]] ??
    "bg-dark-alt border-dark-border text-muted";

  const handleSelect = (status: OrderStatus) => {
    setOpen(false);

    startTransition(async () => {
      if (orderId) {
        await updateOrderStatus(orderId, status);
        router.refresh();
      } else if (onStatusChange) {
        await onStatusChange(status);
      }
    });
  };

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${currentClasses} ${isPending ? "opacity-60" : ""}`}
    >
      {isPending && <Loader2 size={12} className="animate-spin" />}
      {ORDER_STATUS_LABELS[currentStatus]}
    </span>
  );

  if (next.length === 0) return badge;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-60 ${currentClasses}`}
      >
        {isPending && <Loader2 size={12} className="animate-spin" />}
        {ORDER_STATUS_LABELS[currentStatus]}
        <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-dark-surface border border-dark-border rounded-xl shadow-xl overflow-hidden min-w-44">
            {next.map((status) => (
              <button
                key={status}
                onClick={() => handleSelect(status)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-xs font-medium text-dark-text hover:bg-dark-hover transition-colors"
              >
                <Check size={12} className="text-accent opacity-0 group-hover:opacity-100" />
                {ORDER_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
