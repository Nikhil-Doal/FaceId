"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Silk from "@/components/Silk";

interface Face {
  bbox: [number, number, number, number];
  name: string;
  relation?: string;
  confidence: number;
}

interface TrackedFace {
  id: string;
  bbox: [number, number, number, number];
  name: string;
  relation?: string;
  confidence: number;
  lastSeen: number;
  smoothedBbox: [number, number, number, number];
}

const WIDTH = 640;
const HEIGHT = 480;

// Smoothing parameters
const SMOOTHING_FACTOR = 0.3;
const TRACKING_THRESHOLD = 80;
const FACE_TIMEOUT = 1000;
const MIN_CONFIDENCE_CHANGE = 0.05;

export default function HomePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faces, setFaces] = useState<TrackedFace[]>([]);
  const trackedFacesRef = useRef<Map<string, TrackedFace>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [username, setUsername] = useState<string>("");
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    const storedToken = localStorage.getItem("token");
    
    if (!storedToken) {
      router.push("/login");
      return;
    }
    
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, [router]);

  useEffect(() => {
    let stream: MediaStream;

    navigator.mediaDevices
      .getUserMedia({ 
        video: { width: WIDTH, height: HEIGHT, frameRate: { ideal: 30 } } 
      })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsConnected(true);
        }
      })
      .catch((err) => {
        setError("Camera access denied");
        console.error("Camera error:", err);
      });

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const calculateDistance = useCallback((bbox1: number[], bbox2: number[]) => {
    const center1X = (bbox1[0] + bbox1[2]) / 2;
    const center1Y = (bbox1[1] + bbox1[3]) / 2;
    const center2X = (bbox2[0] + bbox2[2]) / 2;
    const center2Y = (bbox2[1] + bbox2[3]) / 2;
    return Math.sqrt(Math.pow(center1X - center2X, 2) + Math.pow(center1Y - center2Y, 2));
  }, []);

  const smoothBbox = useCallback((
    current: [number, number, number, number],
    target: [number, number, number, number],
    factor: number
  ): [number, number, number, number] => {
    return [
      current[0] + (target[0] - current[0]) * factor,
      current[1] + (target[1] - current[1]) * factor,
      current[2] + (target[2] - current[2]) * factor,
      current[3] + (target[3] - current[3]) * factor,
    ];
  }, []);

  const trackFaces = useCallback((newFaces: Face[]) => {
    const now = Date.now();
    const updatedTracked = new Map(trackedFacesRef.current);
    const matched = new Set<string>();
    
    for (const newFace of newFaces) {
      let bestMatch: { id: string; distance: number } | null = null;

      for (const [id, tracked] of updatedTracked.entries()) {
        if (matched.has(id)) continue;
        const distance = calculateDistance(newFace.bbox, tracked.bbox);
        if (distance < TRACKING_THRESHOLD && (!bestMatch || distance < bestMatch.distance)) {
          bestMatch = { id, distance };
        }
      }

      if (bestMatch) {
        const existing = updatedTracked.get(bestMatch.id)!;
        const smoothedBbox = smoothBbox(existing.smoothedBbox, newFace.bbox, SMOOTHING_FACTOR);
        const shouldUpdateIdentity = 
          newFace.name !== existing.name ||
          Math.abs(newFace.confidence - existing.confidence) > MIN_CONFIDENCE_CHANGE;

        updatedTracked.set(bestMatch.id, {
          ...existing,
          bbox: newFace.bbox,
          smoothedBbox,
          name: shouldUpdateIdentity ? newFace.name : existing.name,
          relation: shouldUpdateIdentity ? newFace.relation : existing.relation,
          confidence: shouldUpdateIdentity 
            ? newFace.confidence 
            : existing.confidence + (newFace.confidence - existing.confidence) * 0.2,
          lastSeen: now,
        });
        matched.add(bestMatch.id);
      } else {
        const newId = `face_${now}_${Math.random().toString(36).substr(2, 9)}`;
        updatedTracked.set(newId, {
          id: newId,
          bbox: newFace.bbox,
          smoothedBbox: newFace.bbox,
          name: newFace.name,
          relation: newFace.relation,
          confidence: newFace.confidence,
          lastSeen: now,
        });
      }
    }

    for (const [id, tracked] of updatedTracked.entries()) {
      if (now - tracked.lastSeen > FACE_TIMEOUT) {
        updatedTracked.delete(id);
      }
    }

    trackedFacesRef.current = updatedTracked;
    setFaces(Array.from(updatedTracked.values()));
  }, [calculateDistance, smoothBbox]);

  const scanFaces = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || isScanning) return;

    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, WIDTH, HEIGHT);
    const image = canvas.toDataURL("image/jpeg", 0.5);
    setIsScanning(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("http://localhost:5000/api/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ image }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.clear();
          router.push("/login");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        trackFaces(data);
      }
      setLastScanTime(new Date());
      setError(null);
    } catch (err) {
      console.error("Recognition error:", err);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, router, trackFaces]);

  useEffect(() => {
    if (isConnected) {
      scanIntervalRef.current = setInterval(scanFaces, 600);
    }
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [isConnected, scanFaces]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  const getConfidenceColor = useCallback((confidence: number) => {
    if (confidence >= 0.7) return "#00ff88";
    if (confidence >= 0.5) return "#00d4ff";
    if (confidence >= 0.3) return "#ffa500";
    return "#ff4757";
  }, []);

  const knownFaces = faces.filter((f) => f.name !== "Unknown");
  const unknownFaces = faces.filter((f) => f.name === "Unknown");

  return (
    <div className="min-h-screen flex flex-col p-6">
      <div className="fixed inset-0 -z-10">
        <Silk 
          color="#747474"
          scale={0.75}
          speed={10}
          noiseIntensity={20}
          rotation={75}
        />
      </div>
      <nav className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="font-serif text-4xl tracking-tight text-white">FaceID System</h1>
          <p className="text-white/60 text-sm mt-1">
            Welcome, <span className="text-green-400">{username}</span>
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/people" className="rounded-full px-6 py-2 text-white border border-white/30 hover:bg-white/10 transition font-serif">
            👥 View People
          </Link>
          <Link href="/add" className="rounded-full px-6 py-2 bg-white text-black hover:bg-white/80 transition font-medium font-serif">
            + Add Person
          </Link>
          <button onClick={handleLogout} className="rounded-full px-6 py-2 text-white border border-white/30 hover:bg-white/10 transition font-serif">
            Logout
          </button>
        </div>
      </nav>

      <div className="flex gap-6 flex-1 items-stretch">
        {/* Video Container - Maximum height, maintain aspect ratio */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative h-full" style={{ aspectRatio: '4/3', maxHeight: '100%' }}>
            <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/30 bg-black/50 backdrop-blur-sm">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full"
                style={{ objectFit: 'cover' }}
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Bounding boxes overlay */}
              <div className="absolute inset-0">
                {faces.map((f) => {
                  const [x1, y1, x2, y2] = f.smoothedBbox;
                  const color = getConfidenceColor(f.confidence);
                  const isKnown = f.name !== "Unknown";
                  const videoElement = videoRef.current;
                  if (!videoElement) return null;

                  // Simple direct mapping - backend sends 640x480 coords
                  const containerWidth = videoElement.clientWidth;
                  const containerHeight = videoElement.clientHeight;
                  
                  const scaleX = containerWidth / WIDTH;
                  const scaleY = containerHeight / HEIGHT;

                  return (
                    <div
                      key={f.id}
                      className="absolute pointer-events-none"
                      style={{
                        left: `${x1 * scaleX}px`,
                        top: `${y1 * scaleY}px`,
                        width: `${(x2 - x1) * scaleX}px`,
                        height: `${(y2 - y1) * scaleY}px`,
                        transition: 'all 0.15s ease-out',
                      }}
                    >
                      <div className="absolute inset-0 rounded" style={{
                        border: `3px solid ${color}`,
                        boxShadow: `0 0 20px ${color}60, inset 0 0 20px ${color}20`,
                      }} />
                      <div className="absolute -top-1 -left-1 w-4 h-4" style={{ borderLeft: `3px solid ${color}`, borderTop: `3px solid ${color}` }} />
                      <div className="absolute -top-1 -right-1 w-4 h-4" style={{ borderRight: `3px solid ${color}`, borderTop: `3px solid ${color}` }} />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4" style={{ borderLeft: `3px solid ${color}`, borderBottom: `3px solid ${color}` }} />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4" style={{ borderRight: `3px solid ${color}`, borderBottom: `3px solid ${color}` }} />

                      <div className="absolute -top-14 left-0 right-0 flex flex-col items-center gap-1">
                        <div className="px-4 py-2 rounded-full text-sm font-bold tracking-wider whitespace-nowrap backdrop-blur-md" style={{
                          backgroundColor: `${color}30`,
                          border: `2px solid ${color}`,
                          color: isKnown ? "#fff" : "#ff4757",
                        }}>
                          {isKnown ? (
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                              {f.name.toUpperCase()}
                              {f.relation && <span className="opacity-70">• {f.relation}</span>}
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              UNKNOWN
                            </span>
                          )}
                        </div>
                        <div className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-black/70" style={{ color }}>
                          {(f.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="font-mono">{isConnected ? "CONNECTED" : "DISCONNECTED"}</span>
                  </div>
                  <span className="font-mono">TRACKING: {faces.length} • SMOOTH</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Panel */}
        <div className="w-80 glass rounded-2xl bg-white/10 border border-white/30 p-6 flex flex-col">
          <h2 className="text-white font-serif text-2xl mb-4">Detection Stats</h2>
          {lastScanTime && (
            <p className="text-white/60 text-xs mb-6 font-mono">Last scan: {lastScanTime.toLocaleTimeString()}</p>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/5 rounded-xl p-4 text-center border border-white/20">
              <div className="text-3xl font-bold text-green-400">{knownFaces.length}</div>
              <div className="text-xs text-white/60 mt-1 tracking-wider">KNOWN</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center border border-white/20">
              <div className="text-3xl font-bold text-red-400">{unknownFaces.length}</div>
              <div className="text-xs text-white/60 mt-1 tracking-wider">UNKNOWN</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {faces.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-white/30 text-5xl mb-3">👤</div>
                <p className="text-white/60 text-sm">No faces detected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {faces.map((f) => {
                  const color = getConfidenceColor(f.confidence);
                  return (
                    <div key={f.id} className="rounded-xl p-4 border bg-white/5 hover:bg-white/10 transition-all" style={{ borderColor: `${color}40` }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-bold text-white">{f.name}</div>
                          {f.relation && <div className="text-white/60 text-xs mt-1">{f.relation}</div>}
                        </div>
                        <div className="text-xs font-mono px-2 py-1 rounded font-bold" style={{ backgroundColor: `${color}20`, color }}>
                          {(f.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{
                          width: `${f.confidence * 100}%`,
                          backgroundColor: color,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-xl p-3">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}