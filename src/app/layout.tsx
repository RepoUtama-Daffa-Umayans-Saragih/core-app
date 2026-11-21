import type { Metadata } from "next";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { CoreProvider } from "@/context/CoreContext";
import { ToastProvider } from "@/components/ToastProvider";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "C.O.R.E. — Clearance Optimization & Routing Engine",
  description: "Emergency Vehicle Traffic Clearance System — Huawei ICT Competition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-deep-space text-text-light font-body antialiased">
        <CoreProvider>
          <ToastProvider>
            <Navbar />
            <main className="pt-16 min-h-screen">
              {children}
            </main>
          </ToastProvider>
        </CoreProvider>
      </body>
    </html>
  );
}
