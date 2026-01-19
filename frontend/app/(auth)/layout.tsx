"use client";

import Silk from "@/components/Silk";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      {/* Persistent Silk */}
      <div className="absolute inset-0 -z-10">
        <Silk color="#7B7B81" scale={0.5} />
      </div>

      {/* Page content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
