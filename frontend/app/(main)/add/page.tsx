"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Silk from "@/components/Silk";
import FluidGlass from "@/components/FluidGlass";
import "./../../globals.css";

export default function AddAcquaintance() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    relationship: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageData(result);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!imageData) {
      setError("Please select an image");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      
      console.log("Token from localStorage:", token ? "exists" : "missing");
      
      if (!token) {
        console.log("No token found, redirecting to login");
        router.push("/login");
        return;
      }

      console.log("Sending request to add acquaintance...");

      const response = await fetch("http://localhost:5000/api/acquaintances/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          relationship: formData.relationship,
          image: imageData,
        }),
      });

      const data = await response.json();
      
      console.log("Response status:", response.status);
      console.log("Response data:", data);

      if (response.ok) {
        setSuccess(true);
        setFormData({ name: "", relationship: "" });
        setImagePreview(null);
        setImageData(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        
        console.log("Person added successfully, redirecting to home...");
        
        setTimeout(() => {
          router.push("/home");
        }, 1500);
      } else {
        setError(data.error || "Failed to add acquaintance");
      }
    } catch (err) {
      console.error("Add acquaintance error:", err);
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    
    <div className="min-h-screen flex flex-col items-center justify-center p-10">
        <div className="fixed inset-0 -z-10">
            <Silk 
            color="#ffffff"  // Your custom red color
            scale={0.75}
            speed={4}
            noiseIntensity={20}
            rotation={75}
            />
        </div>
      {/* Back button */}
      <Link
        href="/home"
        className="absolute top-6 left-6 text-white/60 hover:text-white transition font-serif text-sm"
      >
        ← Back to Home
      </Link>

      <h1 className="font-serif text-7xl mb-6 text-center tracking-tighter text-green-400">
        Add Person
      </h1>
      <form
        onSubmit={handleSubmit}
        className="glass w-1/3 p-6 flex flex-col gap-4 text-white rounded-2xl bg-white/10"
      >
        <FluidGlass
          mode="bar"
          barProps={{
            scale: 0.25,
            ior: 2,
            thickness: 3,
            transmission: 1,
            roughness: 0,
            chromaticAberration: 0.1,
            anisotropy: 0.01
          }}
        />

        {success && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-full px-4 py-2 text-center">
            ✓ Person added successfully! Redirecting...
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-full px-4 py-2 text-center text-sm">
            {error}
          </div>
        )}

        {/* Image Upload */}
        <div className="mt-4">
          {imagePreview ? (
            <div className="relative">
              <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-white/30">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageData(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="absolute top-2 right-2 px-3 py-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full text-xs font-bold transition-all"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="block w-full h-64 rounded-2xl border-2 border-dashed border-white/30 hover:border-white/50 bg-white/5 cursor-pointer transition-all">
              <div className="flex flex-col items-center justify-center h-full">
                <svg
                  className="w-16 h-16 text-white/30 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-white/60 text-sm mb-1">Click to upload photo</p>
                <p className="text-white/40 text-xs">PNG, JPG up to 5MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        <input
          type="text"
          placeholder="Full Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          className="rounded-full px-3 py-2 bg-white/10 border border-white/30 backdrop-blur-sm text-white font-serif text-xl"
        />

        <select
          value={formData.relationship}
          onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
          className="rounded-full px-3 py-2 bg-white/10 border border-white/30 backdrop-blur-sm text-white font-serif text-xl"
        >
          <option value="" className="bg-slate-900">Select Relationship (Optional)</option>
          <option value="Family" className="bg-slate-900">Family</option>
          <option value="Friend" className="bg-slate-900">Friend</option>
          <option value="Colleague" className="bg-slate-900">Colleague</option>
          <option value="Acquaintance" className="bg-slate-900">Acquaintance</option>
          <option value="Other" className="bg-slate-900">Other</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-white text-black px-6 py-2 font-medium font-serif text-xl mt-4 hover:bg-white/0 hover:text-white border border-white/30 transition-all duration-1000 disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add Person"}
        </button>
      </form>
    </div>
  );
}