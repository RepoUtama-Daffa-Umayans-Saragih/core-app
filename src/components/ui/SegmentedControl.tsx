"use client";

import React from "react";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  icon?: React.ElementType;
}

export interface SegmentedControlProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export default function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
  fullWidth = false,
  disabled = false,
}: SegmentedControlProps<T>) {
  const isSm = size === "sm";

  return (
    <div
      role="tablist"
      className={`inline-flex items-center bg-[#EEF2F6] p-0.5 rounded-lg border border-[#D8E0EA]/70 select-none ${
        fullWidth ? "w-full" : ""
      } ${className}`}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        const Icon = opt.icon;

        return (
          <button
            key={String(opt.value)}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`
              inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-150
              ${fullWidth ? "flex-1" : ""}
              ${isSm ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}
              ${
                isActive
                  ? "bg-white text-[#0F172A] shadow-xs font-semibold"
                  : "text-[#556578] hover:text-[#0F172A] hover:bg-white/50"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {Icon && <Icon className={`shrink-0 ${isSm ? "w-3 h-3" : "w-3.5 h-3.5"}`} />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
