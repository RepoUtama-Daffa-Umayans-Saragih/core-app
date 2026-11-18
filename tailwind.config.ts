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
        "deep-space":   "#0B0227",   // Latar belakang utama
        "panel":        "#1F027F",   // Cards, sidebars
        "accent":       "#495AEE",   // Tombol aktif, rute
        "accent-soft":  "#929BEC",   // Hover, border, teks sekunder
        "text-light":   "#DCE2F4",   // Tipografi utama
        "alert-red":    "#FF4C4C",   // Code Red / darurat
        "alert-yellow": "#FFC107",   // Code Yellow
        "neon-green":   "#00FF9C",   // Lampu hijau simulasi
      },
      fontFamily: {
        display: ["Orbitron", "sans-serif"],
        body:    ["Inter", "sans-serif"],
      },
      animation: {
        "pulse-red":  "pulse-red 1s cubic-bezier(0.4,0,0.6,1) infinite",
        "glow":       "glow 2s ease-in-out infinite alternate",
        "slide-in":   "slideIn 0.3s ease-out",
        "flash-red":  "flash-red 0.4s ease-in-out 3",
      },
      keyframes: {
        "pulse-red": {
          "0%, 100%": { backgroundColor: "#FF4C4C33" },
          "50%":      { backgroundColor: "#FF4C4C99" },
        },
        glow: {
          from: { boxShadow: "0 0 10px #495AEE66" },
          to:   { boxShadow: "0 0 25px #495AEEBB, 0 0 50px #495AEE44" },
        },
        slideIn: {
          from: { transform: "translateY(-8px)", opacity: "0" },
          to:   { transform: "translateY(0)",    opacity: "1" },
        },
        "flash-red": {
          "0%, 100%": { backgroundColor: "transparent" },
          "50%":      { backgroundColor: "#FF4C4C33" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
