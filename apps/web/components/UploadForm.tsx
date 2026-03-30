"use client";

import { useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const ACCEPTED = ".mp3,.m4a,.aac,.ogg,.flac,.wav,audio/*";

export default function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setStatus(null);
    setIsError(false);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/tracks/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setIsError(true);
        setStatus((data as { error: string }).error ?? "Upload failed");
      } else {
        setStatus(`Uploaded "${(data as { title: string }).title}"`);
        onUploaded();
      }
    } catch {
      setIsError(true);
      setStatus("Network error — upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  return (
    <div className="space-y-2">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          uploading
            ? "border-zinc-700 bg-zinc-900 cursor-wait opacity-60"
            : isDragging
              ? "border-zinc-400 bg-zinc-800 cursor-copy"
              : "border-zinc-700 hover:border-zinc-500 bg-zinc-900 cursor-pointer"
        }`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <p className="text-zinc-400 text-sm">
          {uploading ? (
            "Uploading…"
          ) : (
            <>
              Drop an audio file here or{" "}
              <span className="text-white underline">click to browse</span>
            </>
          )}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>

      {status && (
        <p className={`text-sm ${isError ? "text-red-400" : "text-green-400"}`}>
          {status}
        </p>
      )}
    </div>
  );
}
