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
        "deep-space":   "#F4F6F8",
        "panel":        "#FFFFFF",
        "accent":       "#0055FF",
        "accent-soft":  "#E0E4E8",
        "text-light":   "#1A1A1A",
        "text-muted":   "#666666",
        "alert-red":    "#FF4C4C",
        "alert-yellow": "#FF9800",
        "neon-green":   "#00C853",
      },
      fontFamily: {
        sans:    ["Roboto", "sans-serif"],
        display: ["Roboto", "sans-serif"],
        body:    ["Roboto", "sans-serif"],
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
          from: { boxShadow: "0 0 10px rgba(0,85,255,0.2)" },
          to:   { boxShadow: "0 0 25px rgba(0,85,255,0.4)" },
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
