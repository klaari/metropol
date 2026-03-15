"use client";

import DownloadForm from "@/components/DownloadForm";
import DownloadList from "@/components/DownloadList";
import { useState } from "react";
import type { DownloadJob } from "@metropol/types";

export default function DownloadsPage() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6">Downloads</h1>
        <DownloadForm onJobCreated={(job) => setJobs((prev) => [job, ...prev])} />
      </div>
      <DownloadList jobs={jobs} setJobs={setJobs} />
    </div>
  );
}
