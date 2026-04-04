"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function SettingsPage() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [cookieStatus, setCookieStatus] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const r = await fetch(`${API_URL}/cookies`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: { loaded: boolean } = await r.json();
        setCookieStatus(data.loaded);
      } catch {
        setCookieStatus(false);
      }
    })();
  }, [getToken]);

  async function uploadFile(file: File) {
    setStatusMessage(null);
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
        setStatusMessage((data as { error: string }).error ?? "Upload failed");
      } else {
        setCookieStatus(true);
        setStatusMessage("Cookies uploaded successfully");
      }
    } catch {
      setIsError(true);
      setStatusMessage("Network error — upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg">
      <h1 className="text-3xl font-bold text-white">Settings</h1>

      {/* Account */}
      {user && (
        <section>
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2 px-1">Account</p>
          <div className="rounded-2xl bg-zinc-950 divide-y divide-zinc-900 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              {user.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.imageUrl} alt="" className="w-9 h-9 rounded-full" />
              )}
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{user.fullName ?? user.username}</p>
                <p className="text-zinc-500 text-xs truncate">{user.primaryEmailAddress?.emailAddress}</p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="w-full text-left px-4 py-3.5 text-red-500 text-sm font-medium hover:bg-zinc-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </section>
      )}

      {/* YouTube */}
      <section>
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2 px-1">YouTube</p>
        <div className="rounded-2xl bg-zinc-950 divide-y divide-zinc-900 overflow-hidden">

          {/* Status row */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-white text-sm">Cookie status</span>
            {cookieStatus === null ? (
              <span className="text-zinc-600 text-sm">Checking…</span>
            ) : cookieStatus ? (
              <span className="text-green-400 text-sm font-medium">Active ✓</span>
            ) : (
              <span className="text-[#f5a623] text-sm font-medium">Not loaded</span>
            )}
          </div>

          {/* Upload row */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-900 transition-colors disabled:opacity-50"
          >
            <span className="text-white text-sm">
              {uploading ? "Uploading…" : "Upload cookies.txt"}
            </span>
            <span className="text-zinc-600 text-sm">›</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
          />
        </div>

        {statusMessage && (
          <p className={`text-xs mt-2 px-1 ${isError ? "text-red-400" : "text-green-400"}`}>
            {statusMessage}
          </p>
        )}

        <p className="text-xs text-zinc-700 mt-2 px-1 leading-relaxed">
          Needed to download YouTube content. Export from your browser using "Get cookies.txt LOCALLY" (Chrome) or Cookie Quick Manager (Firefox). Use an incognito window for longer-lasting cookies.
        </p>
      </section>
    </div>
  );
}
