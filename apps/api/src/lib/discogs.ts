import { env } from "./env";
import type { DiscogsMetadata } from "@aani/db";

const DISCOGS_API = "https://api.discogs.com";
const USER_AGENT = "Aani/1.0 +https://aani.cc";
const COLLECTION_FOLDER_ID = 1;

export type DiscogsSearchResult = {
  id: number;
  type: string;
  title: string;
  year?: string;
  thumb?: string;
  cover_image?: string;
  country?: string;
  format?: string[];
  label?: string[];
  catno?: string;
  genre?: string[];
  style?: string[];
  master_id?: number;
  master_url?: string;
  resource_url?: string;
  uri?: string;
  user_data?: { in_collection: boolean; in_wantlist: boolean };
};

export type DiscogsReleaseDetail = {
  id: number;
  title: string;
  year?: number;
  artists?: { name: string; anv?: string; join?: string }[];
  artists_sort?: string;
  labels?: { name: string; catno?: string }[];
  formats?: { name: string; descriptions?: string[] }[];
  country?: string;
  genres?: string[];
  styles?: string[];
  master_id?: number;
  thumb?: string;
  resource_url?: string;
  images?: { type: string; uri: string; uri150?: string; resource_url?: string }[];
};

export class DiscogsError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "DiscogsError";
  }
}

function ensureCredentials(): { token: string; username: string } {
  if (!env.discogsToken) {
    throw new DiscogsError("DISCOGS_TOKEN env var not configured", 503);
  }
  if (!env.discogsUsername) {
    throw new DiscogsError("DISCOGS_USERNAME env var not configured", 503);
  }
  return { token: env.discogsToken, username: env.discogsUsername };
}

async function discogsFetch<T = unknown>(
  path: string,
  init?: RequestInit & { allow404?: boolean },
): Promise<T | null> {
  const { token } = ensureCredentials();
  const headers: Record<string, string> = {
    Authorization: `Discogs token=${token}`,
    "User-Agent": USER_AGENT,
    Accept: "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (init?.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${DISCOGS_API}${path}`, { ...init, headers });
  if (res.status === 404 && init?.allow404) return null;
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body === "object" && "message" in body) {
        detail = String((body as { message: string }).message);
      }
    } catch {
      // ignore
    }
    throw new DiscogsError(`Discogs ${res.status}: ${detail}`, res.status);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

export async function searchReleases(query: string, perPage = 10) {
  const params = new URLSearchParams({
    q: query,
    type: "release",
    per_page: String(perPage),
  });
  const data = await discogsFetch<{ results: DiscogsSearchResult[] }>(
    `/database/search?${params.toString()}`,
  );
  return data?.results ?? [];
}

export async function getRelease(releaseId: string) {
  return discogsFetch<DiscogsReleaseDetail>(`/releases/${releaseId}`);
}

export function releaseToMetadata(
  release: DiscogsReleaseDetail,
): DiscogsMetadata {
  const labelEntry = release.labels?.[0];
  const cover = release.images?.find((i) => i.type === "primary") ??
    release.images?.[0];
  const artistName = release.artists?.length
    ? release.artists
        .map((a) => (a.anv?.trim() ? a.anv : a.name) + (a.join ? ` ${a.join}` : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    : null;
  return {
    releaseId: String(release.id),
    masterId: release.master_id ? String(release.master_id) : null,
    title: release.title ?? null,
    artist: artistName,
    year: typeof release.year === "number" && release.year > 0 ? release.year : null,
    label: labelEntry?.name ?? null,
    catalogNumber: labelEntry?.catno ?? null,
    country: release.country ?? null,
    format:
      release.formats?.flatMap((f) => [f.name, ...(f.descriptions ?? [])]) ??
      null,
    genres: release.genres ?? null,
    styles: release.styles ?? null,
    coverUrl: cover?.uri ?? null,
    thumbUrl: cover?.uri150 ?? release.thumb ?? null,
    resourceUrl: release.resource_url ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

export async function isInCollection(releaseId: string): Promise<boolean> {
  const { username } = ensureCredentials();
  const data = await discogsFetch<{ releases: { instance_id: number }[] }>(
    `/users/${encodeURIComponent(username)}/collection/releases/${encodeURIComponent(releaseId)}`,
    { allow404: true },
  );
  return !!data && Array.isArray(data.releases) && data.releases.length > 0;
}

export async function getCollectionInstances(releaseId: string) {
  const { username } = ensureCredentials();
  const data = await discogsFetch<{
    releases: { instance_id: number; folder_id: number }[];
  }>(
    `/users/${encodeURIComponent(username)}/collection/releases/${encodeURIComponent(releaseId)}`,
    { allow404: true },
  );
  return data?.releases ?? [];
}

export async function addToCollection(releaseId: string) {
  const { username } = ensureCredentials();
  return discogsFetch<{ instance_id: number; resource_url: string }>(
    `/users/${encodeURIComponent(username)}/collection/folders/${COLLECTION_FOLDER_ID}/releases/${encodeURIComponent(releaseId)}`,
    { method: "POST" },
  );
}

export async function removeFromCollection(releaseId: string) {
  const instances = await getCollectionInstances(releaseId);
  for (const instance of instances) {
    const { username } = ensureCredentials();
    await discogsFetch(
      `/users/${encodeURIComponent(username)}/collection/folders/${instance.folder_id}/releases/${encodeURIComponent(releaseId)}/instances/${instance.instance_id}`,
      { method: "DELETE" },
    );
  }
  return instances.length;
}

export async function getWantEntry(
  releaseId: string,
): Promise<{ inList: boolean; note: string | null }> {
  const { username } = ensureCredentials();
  const data = await discogsFetch<{ id: number; notes?: string | null }>(
    `/users/${encodeURIComponent(username)}/wants/${encodeURIComponent(releaseId)}`,
    { allow404: true },
  );
  if (!data) return { inList: false, note: null };
  return { inList: true, note: data.notes ?? null };
}

export async function putWant(releaseId: string, notes?: string | null) {
  const { username } = ensureCredentials();
  const body: Record<string, unknown> = {};
  if (notes !== undefined) body.notes = notes ?? "";
  return discogsFetch(
    `/users/${encodeURIComponent(username)}/wants/${encodeURIComponent(releaseId)}`,
    {
      method: "PUT",
      body: Object.keys(body).length ? JSON.stringify(body) : undefined,
    },
  );
}

export async function removeFromWantlist(releaseId: string) {
  const { username } = ensureCredentials();
  return discogsFetch(
    `/users/${encodeURIComponent(username)}/wants/${encodeURIComponent(releaseId)}`,
    { method: "DELETE" },
  );
}
