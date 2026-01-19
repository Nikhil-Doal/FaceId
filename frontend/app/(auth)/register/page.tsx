"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Silk from "@/components/Silk";

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        
        // Redirect to dashboard or home
        router.push("/");
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      setError("Failed to connect to server");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Silk background */}
      <div className="absolute inset-0 -z-10">
        <Silk color="#7B7B81" scale={0.5} />
      </div>

      {/* Content on top */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-10">
        <h1 className="font-serif text-7xl mb-6 text-center tracking-tighter text-green-400">
          Register Page
        </h1>

        <form
          onSubmit={handleSubmit}
          className="glass w-1/4 p-6 flex flex-col gap-4 text-white rounded-2xl bg-white/10"
        >
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-full px-4 py-2 text-center">
              {error}
            </div>
          )}

          <input
            name="username"
            type="text"
            placeholder="Username"
            value={formData.username}
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            required
            className="rounded-full px-3 py-2 bg-white/10 border border-white/30 backdrop-blur-sm text-white font-serif text-xl mt-4"
          />

          <input
            name="email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
            className="rounded-full px-3 py-2 bg-white/10 border border-white/30 backdrop-blur-sm text-white font-serif text-xl"
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
            className="rounded-full px-3 py-2 bg-white/10 border border-white/30 backdrop-blur-sm text-white font-serif text-xl"
          />

          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
            required
            className="rounded-full px-3 py-2 bg-white/10 border border-white/30 backdrop-blur-sm text-white font-serif text-xl"
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-white text-black px-6 py-2 font-medium font-serif text-xl mt-4 mb-4 hover:bg-white/0 hover:text-white border border-white/30 hover:border-white transition-all duration-1000 disabled:opacity-50"
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>
      </div>
    </div>
  );
}