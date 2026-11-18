"use client";

import React from "react";
import type { DispatchCode } from "@/context/CoreContext";

export type BadgeStatus =
  | DispatchCode
  | "STANDBY"
  | "IDLE"
  | "OFFLINE"
  | "EDGE_ONLINE";

export interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
  prefix?: string;
  size?: "sm" | "md";
  showDot?: boolean;
  className?: string;
}

export default function StatusBadge({
  status,
  label,
  prefix,
  size = "md",
  showDot = true,
  className = "",
}: StatusBadgeProps) {
  let bg = "bg-[#EEF2F6]";
  let text = "text-[#556578]";
  let border = "border-[#D8E0EA]";
  let dotColor = "bg-[#738396]";
  let defaultLabel = "STANDBY";

  switch (status) {
    case "CODE_RED":
      bg = "bg-[#FEF2F2]";
      text = "text-[#991B1B]";
      border = "border-[#C81E1E]/30";
      dotColor = "bg-[#C81E1E]";
      defaultLabel = "CODE RED";
      break;

    case "DISPATCHED_WAITING":
      bg = "bg-[#FEF3C7]";
      text = "text-[#92400E]";
      border = "border-[#B45309]/30";
      dotColor = "bg-[#B45309]";
      defaultLabel = "MENUNGGU DRIVER";
      break;

    case "CODE_YELLOW":
      bg = "bg-[#FEF3C7]";
      text = "text-[#92400E]";
      border = "border-[#B45309]/30";
      dotColor = "bg-[#B45309]";
      defaultLabel = "CODE YELLOW";
      break;

    case "EN_ROUTE":
      bg = "bg-[#ECFDF5]";
      text = "text-[#065F46]";
      border = "border-[#0F766E]/30";
      dotColor = "bg-[#0F766E]";
      defaultLabel = "EN ROUTE";
      break;

    case "ARRIVED":
      bg = "bg-[#ECFDF5]";
      text = "text-[#065F46]";
      border = "border-[#0F766E]/30";
      dotColor = "bg-[#0F766E]";
      defaultLabel = "TIBA";
      break;

    case "EDGE_ONLINE":
      bg = "bg-[#ECFDF5]";
      text = "text-[#065F46]";
      border = "border-[#0F766E]/30";
      dotColor = "bg-[#0F766E]";
      defaultLabel = "EDGE ONLINE";
      break;

    case "STANDBY":
    case "IDLE":
    default:
      bg = "bg-[#EEF2F6]";
      text = "text-[#556578]";
      border = "border-[#D8E0EA]";
      dotColor = "bg-[#738396]";
      defaultLabel = "STANDBY";
      break;
  }

  const displayText = label || defaultLabel;
  const isSm = size === "sm";

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium select-none
        ${bg} ${text} ${border}
        ${isSm ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}
        ${className}
      `}
    >
      {showDot && (
        <span
          className={`shrink-0 rounded-full ${dotColor} ${
            isSm ? "w-1.5 h-1.5" : "w-1.5 h-1.5"
          }`}
        />
      )}
      <span className="tracking-wide uppercase font-semibold">
        {prefix ? `${prefix} · ` : ""}
        {displayText}
      </span>
    </span>
  );
}
