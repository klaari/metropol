"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function SettingsPage() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [uploading, setUploading] = useState(false);
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
    setUploading(true);

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
        setStatus("Cookies uploaded successfully");
      }
    } catch {
      setIsError(true);
      setStatus("Network error — upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="px-4 py-6 space-y-8 max-w-lg">
      <h1 className="text-3xl font-bold text-white">Settings</h1>

      {/* YouTube Cookies */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">YouTube Cookies</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Upload a <code className="text-zinc-300">cookies.txt</code> file from your browser to authenticate YouTube downloads.
          Use a browser extension like "Get cookies.txt LOCALLY" to export your YouTube cookies.
        </p>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-sm">Status:</span>
          {loaded === null ? (
            <span className="text-zinc-500 text-sm italic">Checking…</span>
          ) : loaded ? (
            <span className="text-green-400 text-sm font-semibold">Cookies loaded ✓</span>
          ) : (
            <span className="text-[#f5a623] text-sm font-semibold">No cookies — downloads may fail</span>
          )}
        </div>

        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full bg-white text-black text-base font-semibold py-3.5 rounded-xl disabled:opacity-60 hover:bg-zinc-100 transition-colors"
        >
          {uploading ? "Uploading…" : "Upload cookies.txt"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={handleFileChange}
        />

        {status && (
          <p className={`text-sm text-center ${isError ? "text-red-400" : "text-green-400"}`}>
            {status}
          </p>
        )}
      </section>

      {/* Sign Out */}
      <section>
        <button
          onClick={() => signOut()}
          className="w-full border border-zinc-800 text-red-500 text-base font-semibold py-3.5 rounded-xl hover:border-zinc-700 transition-colors"
        >
          Sign Out
        </button>
      </section>
    </div>
  );
}
