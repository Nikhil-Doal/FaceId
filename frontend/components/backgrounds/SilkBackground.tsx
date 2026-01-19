"use client";

import Silk from "@/components/Silk";

export default function SilkBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <Silk
        speed={4}
        scale={0.75}
        noiseIntensity={10}
        color="#1900ff"
        rotation={75}
      />
    </div>
  );
}
