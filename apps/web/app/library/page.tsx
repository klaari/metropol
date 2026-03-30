"use client";

import { useState } from "react";
import TrackList from "@/components/TrackList";
import UploadForm from "@/components/UploadForm";

export default function LibraryPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Library</h1>
      <div className="mb-6">
        <UploadForm onUploaded={() => setRefreshKey((k) => k + 1)} />
      </div>
      <TrackList refreshKey={refreshKey} />
    </div>
  );
}
