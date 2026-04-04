"use client";

import TrackList from "@/components/TrackList";
import { useState } from "react";

type SortOption = "date" | "title" | "bpm";
const SORT_LABELS: Record<SortOption, string> = {
  date: "Date Added",
  title: "Title A–Z",
  bpm: "BPM",
};

export default function LibraryPage() {
  const [sort, setSort] = useState<SortOption>("date");

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <h1 className="text-3xl font-bold text-white">Library</h1>
        <div className="relative mb-0.5">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="appearance-none bg-zinc-900 text-zinc-400 text-xs font-medium pl-3 pr-6 py-1.5 rounded-full cursor-pointer focus:outline-none"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
              <option key={s} value={s}>{SORT_LABELS[s]}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-[10px]">▾</span>
        </div>
      </div>

      <TrackList sort={sort} />
    </div>
  );
}
