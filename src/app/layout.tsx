import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { CoreProvider } from "@/context/CoreContext";
import { ToastProvider } from "@/components/ToastProvider";
import Navbar from "@/components/Navbar";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "C.O.R.E. — Clearance Optimization & Routing Engine",
  description: "Emergency Vehicle Traffic Clearance System — Huawei ICT Competition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${plusJakarta.variable} ${ibmPlexMono.variable}`}>
      <body className="bg-[#F4F6F8] text-[#0F172A] font-sans antialiased min-h-screen">
        <CoreProvider>
          <ToastProvider>
            <Navbar />
            <main className="pt-14 min-h-screen">
              {children}
            </main>
          </ToastProvider>
        </CoreProvider>
      </body>
    </html>
  );
}
