"use client";

export default function WebcamPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-10">
      <h1 className="text-5xl font-serif text-white mb-6">Live Camera</h1>
      <div className="border-4 border-white rounded-2xl overflow-hidden">
        <img
          src="http://localhost:5001/video_feed"
          alt="Live Camera Feed"
          className="w-[640px] h-[480px] object-cover"
        />
      </div>
    </div>
  );
}
