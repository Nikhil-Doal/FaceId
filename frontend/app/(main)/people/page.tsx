"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Silk from "@/components/Silk";

interface Acquaintance {
  id: string;
  name: string;
  relationship: string;
  image: string;  // Base64 image data
  added_at: string;
}

export default function PeoplePage() {
  const router = useRouter();
  const [acquaintances, setAcquaintances] = useState<Acquaintance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAcquaintances();
  }, []);

  const fetchAcquaintances = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("http://localhost:5000/api/acquaintances", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAcquaintances(data);
      } else if (response.status === 401) {
        localStorage.clear();
        router.push("/login");
      } else {
        setError("Failed to load connections");
      }
    } catch (err) {
      console.error("Error fetching acquaintances:", err);
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:5000/api/acquaintances/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setAcquaintances(acquaintances.filter((a) => a.id !== id));
      } else {
        setError("Failed to delete connection");
      }
    } catch (err) {
      console.error("Error deleting acquaintance:", err);
      setError("Failed to delete connection");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getRelationshipColor = (relationship: string) => {
    const colors: { [key: string]: string } = {
      Family: "#ff6b9d",
      Friend: "#4ecdc4",
      Colleague: "#95e1d3",
      Acquaintance: "#ffd93d",
      Other: "#a8a8a8",
    };
    return colors[relationship] || "#a8a8a8";
  };

  return (
    <div className="min-h-screen p-6">
      <div className="fixed inset-0 -z-10">
        <Silk
          color="#747474"
          scale={0.75}
          speed={4}
          noiseIntensity={20}
          rotation={75}
        />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-serif text-5xl tracking-tight text-white">
            My Connections
          </h1>
          <p className="text-white/60 text-sm mt-2">
            {acquaintances.length} {acquaintances.length === 1 ? "person" : "people"} registered
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href="/home"
            className="rounded-full px-6 py-2 text-white border border-white/30 hover:bg-white/10 transition font-serif"
          >
            ← Back to Home
          </Link>
          <Link
            href="/add"
            className="rounded-full px-6 py-2 bg-white text-black hover:bg-white/80 transition font-medium font-serif"
          >
            + Add Person
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-2xl px-6 py-4 text-center text-white">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-white/60 text-xl font-serif">Loading connections...</div>
        </div>
      ) : acquaintances.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center min-h-[400px] glass rounded-2xl bg-white/10 border border-white/30 p-12">
          <div className="text-white/30 text-8xl mb-6">👥</div>
          <h2 className="text-white font-serif text-3xl mb-3">No connections yet</h2>
          <p className="text-white/60 mb-6">Start by adding your first person</p>
          <Link
            href="/add"
            className="rounded-full px-8 py-3 bg-white text-black hover:bg-white/80 transition font-medium font-serif text-lg"
          >
            + Add First Person
          </Link>
        </div>
      ) : (
        /* Grid of Connections */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {acquaintances.map((person) => (
            <div
              key={person.id}
              className="glass rounded-2xl bg-white/10 border border-white/30 p-6 hover:bg-white/15 transition-all hover:scale-105 duration-300"
            >
              {/* Actual Face Image */}
              <div className="w-full aspect-square rounded-xl overflow-hidden border-2 border-white/20 mb-4 bg-black/50">
                {person.image ? (
                  <img
                    src={person.image}
                    alt={person.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-400/20 to-blue-400/20">
                            <span class="text-6xl text-white/40">${person.name.charAt(0).toUpperCase()}</span>
                          </div>
                        `;
                      }
                    }}
                  />
                ) : (
                  // Fallback for missing images
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-400/20 to-blue-400/20">
                    <span className="text-6xl text-white/40">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Name */}
              <h3 className="text-white font-serif text-2xl mb-2 truncate">
                {person.name}
              </h3>

              {/* Relationship Badge */}
              {person.relationship && (
                <div
                  className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-3"
                  style={{
                    backgroundColor: `${getRelationshipColor(person.relationship)}30`,
                    color: getRelationshipColor(person.relationship),
                    border: `2px solid ${getRelationshipColor(person.relationship)}`,
                  }}
                >
                  {person.relationship}
                </div>
              )}

              {/* Added Date */}
              <p className="text-white/40 text-xs mb-4">
                Added {formatDate(person.added_at)}
              </p>

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(person.id, person.name)}
                disabled={deletingId === person.id}
                className="w-full rounded-full px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition font-serif text-sm disabled:opacity-50"
              >
                {deletingId === person.id ? "Removing..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}