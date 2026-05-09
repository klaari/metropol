"use client";

import TrackList from "@/components/TrackList";
import { useState } from "react";
import { HStack, Text, VStack } from "@/components/ui";

type SortOption = "date" | "title" | "bpm";
const SORT_LABELS: Record<SortOption, string> = {
  date: "Date Added",
  title: "Title A–Z",
  bpm: "BPM",
};

export default function LibraryPage() {
  const [sort, setSort] = useState<SortOption>("date");

  return (
    <VStack gap="lg" pad="lg" className="max-w-3xl w-full mx-auto">
      <VStack gap="xs">
        <Text variant="eyebrow" tone="muted">
          Your library
        </Text>
        <HStack justify="between" align="end">
          <Text variant="titleLg">Library</Text>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="appearance-none bg-paper-raised text-ink-soft text-caption font-semibold pl-md pr-lg py-xs rounded-full cursor-pointer focus:outline-none border-hair border-paper-edge"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-sm top-1/2 -translate-y-1/2 text-ink-muted text-[10px]">
              ▾
            </span>
          </div>
        </HStack>
      </VStack>

      <TrackList sort={sort} />
    </VStack>
  );
}
