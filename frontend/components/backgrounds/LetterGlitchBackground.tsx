"use client";

import LetterGlitch from "@/components/LetterGlitch";

export default function LetterGlitchBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <LetterGlitch 
        glitchColors={['#2c2c2c', '#00ff22b2', '#446469']}
        outerVignette={false}
        centerVignette={true} />
    </div>
  );
}