"use client";

import Link from "next/link";
import LetterGlitchBackground from "@/components/backgrounds/LetterGlitchBackground";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <LetterGlitchBackground />
      </div>

      {/* Top Bar */}
      <header className="flex justify-between items-center px-10 py-6">
        <h1 className="font-serif text-3xl tracking-tight text-white">
          FaceID
        </h1>

        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-full px-5 py-2 text-white border border-white/30 backdrop-blur-md hover:bg-white/10 transition"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="rounded-full px-5 py-2 text-black bg-white hover:bg-white/80 transition font-medium"
          >
            Register
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center text-center min-h-[80vh] px-6">
        <div className="max-w-2xl p-10 rounded-3xl border border-white/30 shadow-2xl bg-black/50 ">
          <h2 className="font-serif text-6xl tracking-tighter text-white mb-6">
            Secure Face Recognition
          </h2>

          <p className="text-white/80 text-lg mb-8">
            A modern authentication system powered by computer vision and AI.
            Fast, secure, and seamless identity verification.
          </p>

          <div className="flex justify-center gap-6">
            <Link
              href="/register"
              className="rounded-full px-8 py-3 bg-white text-black font-serif text-xl hover:scale-105 transition"
            >
              Get Started
            </Link>

            <Link
              href="/login"
              className="rounded-full px-8 py-3 border border-white/40 text-white font-serif text-xl hover:bg-white/10 transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
