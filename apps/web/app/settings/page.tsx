"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function SettingsPage() {
  const { getToken } = useAuth();
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const r = await fetch(`${API_URL}/cookies`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: { loaded: boolean } = await r.json();
        setLoaded(data.loaded);
      } catch {
        setLoaded(false);
      }
    })();
  }, [getToken]);

  async function uploadFile(file: File) {
    setStatus(null);
    setIsError(false);

    const formData = new FormData();
    formData.append("cookies", file);

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/cookies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setIsError(true);
        setStatus((data as { error: string }).error ?? "Upload failed");
      } else {
        setLoaded(true);
        setStatus("Cookies uploaded successfully ✓");
      }
    } catch {
      setIsError(true);
      setStatus("Network error — upload failed");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-200">YouTube Cookies</h2>
        <p className="text-sm text-zinc-400">
          Upload a <code className="text-zinc-300">cookies.txt</code> file exported from your browser to enable
          downloading age-restricted or member-only YouTube content.
        </p>

        <div className="text-sm">
          {loaded === null ? (
            <span className="text-zinc-500">Checking status…</span>
          ) : loaded ? (
            <span className="text-green-400">Cookies loaded ✓</span>
          ) : (
            <span className="text-yellow-400">No cookies — YouTube downloads may fail</span>
          )}
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-zinc-400 bg-zinc-800"
              : "border-zinc-700 hover:border-zinc-500 bg-zinc-900"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <p className="text-zinc-400 text-sm">
            Drop <span className="text-white font-medium">cookies.txt</span> here or{" "}
            <span className="text-white underline">click to browse</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {status && (
          <p className={`text-sm ${isError ? "text-red-400" : "text-green-400"}`}>
            {status}
          </p>
        )}
      </section>
    </div>
  );
}
