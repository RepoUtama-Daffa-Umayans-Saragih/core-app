import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "deep-space":   "#F8FAFC",   // Background utama Slate-50
        "panel":        "#FFFFFF",   // Background card/sidebar, putih murni
        "accent":       "#2563EB",   // Biru modern Vercel/Linear
        "accent-soft":  "#E2E8F0",   // Border/hover state Slate-200
        "text-light":   "#0F172A",   // Teks utama Slate-900
        "text-muted":   "#64748B",   // Teks sekunder Slate-500
        "alert-red":    "#EF4444",   // Red-500
        "alert-yellow": "#F59E0B",   // Amber-500
        "neon-green":   "#10B981",   // Emerald-500
      },
      fontFamily: {
        sans:    ["Inter", "Roboto", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Inter", "Roboto", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        body:    ["Inter", "Roboto", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      animation: {
        "pulse-red":  "pulse-red 1s cubic-bezier(0.4,0,0.6,1) infinite",
        "glow":       "glow 2s ease-in-out infinite alternate",
        "slide-in":   "slideIn 0.3s ease-out",
        "flash-red":  "flash-red 0.4s ease-in-out 3",
      },
      keyframes: {
        "pulse-red": {
          "0%, 100%": { backgroundColor: "#FF4C4C22" },
          "50%":      { backgroundColor: "#FF4C4C66" },
        },
        glow: {
          from: { boxShadow: "0 1px 3px rgba(0,85,255,0.1)" },
          to:   { boxShadow: "0 4px 12px rgba(0,85,255,0.2)" },
        },
        slideIn: {
          from: { transform: "translateY(-8px)", opacity: "0" },
          to:   { transform: "translateY(0)",    opacity: "1" },
        },
        "flash-red": {
          "0%, 100%": { backgroundColor: "transparent" },
          "50%":      { backgroundColor: "rgba(255,76,76,0.15)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
