"use client";

import TrackList from "@/components/TrackList";

export default function LibraryPage() {
  return (
    <div className="px-0">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-3xl font-bold text-white">Library</h1>
      </div>
      <TrackList />
    </div>
  );
}
