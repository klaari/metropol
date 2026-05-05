import { and, desc, eq, lt, sql } from "drizzle-orm";
import {
  type Database,
  discogsUserReleases,
  type DiscogsMetadata,
  type DiscogsUserReleaseType,
} from "@aani/db";
import { env } from "./env";

const DISCOGS_API = "https://api.discogs.com";
const USER_AGENT = "Aani/1.0 +https://aani.cc";
const COLLECTION_FOLDER_ID = 1;
// Read folder 0 = "All", which Discogs uses for the union of every folder.
const ALL_FOLDER_ID = 0;
const PER_PAGE = 100;
// Throttle paged reads when the per-minute window starts running thin. The
// authenticated ceiling is 60 req/min; a single full sync of ~95 pages comes
// in just under that without any delay, but we slow down once the server
// reports we're nearly out of budget so we don't trip the 429.
const RATE_LIMIT_LOW_WATERMARK = 5;
const RATE_LIMIT_BACKOFF_MS = 1500;
const RATE_LIMIT_429_BACKOFF_MS = 60_000;

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

async function discogsRequest<T = unknown>(
  path: string,
  init?: RequestInit & { allow404?: boolean },
): Promise<{ data: T | null; response: Response }> {
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
  const response = await fetch(`${DISCOGS_API}${path}`, { ...init, headers });
  if (response.status === 404 && init?.allow404) {
    return { data: null, response };
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (body && typeof body === "object" && "message" in body) {
        detail = String((body as { message: string }).message);
      }
    } catch {
      // ignore
    }
    throw new DiscogsError(`Discogs ${response.status}: ${detail}`, response.status);
  }
  if (response.status === 204) {
    return { data: null, response };
  }
  return { data: (await response.json()) as T, response };
}

async function discogsFetch<T = unknown>(
  path: string,
  init?: RequestInit & { allow404?: boolean },
): Promise<T | null> {
  const { data } = await discogsRequest<T>(path, init);
  return data;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function rateLimitDelay(response: Response): Promise<void> {
  const remainingHeader = response.headers.get("X-Discogs-Ratelimit-Remaining");
  if (!remainingHeader) return;
  const remaining = Number(remainingHeader);
  if (Number.isFinite(remaining) && remaining <= RATE_LIMIT_LOW_WATERMARK) {
    await sleep(RATE_LIMIT_BACKOFF_MS);
  }
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

// ---------------------------------------------------------------------------
// Mirror sync — paginate the user's collection + wantlist into Postgres so we
// can do local search and scope-filtered matching without paging Discogs on
// every request.
// ---------------------------------------------------------------------------

export type DiscogsBasicInfo = {
  id: number;
  title?: string;
  year?: number;
  thumb?: string;
  cover_image?: string;
  formats?: { name?: string; descriptions?: string[] }[];
  labels?: { name?: string; catno?: string }[];
  artists?: { name?: string; anv?: string; join?: string }[];
  genres?: string[];
  styles?: string[];
};

export type DiscogsCollectionItem = {
  id: number;
  instance_id?: number;
  folder_id?: number;
  date_added?: string;
  notes?: { field_id: number; value: string }[];
  basic_information?: DiscogsBasicInfo;
};

export type DiscogsWantlistItem = {
  id: number;
  date_added?: string;
  notes?: string | null;
  basic_information?: DiscogsBasicInfo;
};

type Pagination = {
  page: number;
  pages: number;
  per_page: number;
  items: number;
};

type CollectionPage = {
  pagination: Pagination;
  releases: DiscogsCollectionItem[];
};

type WantlistPage = {
  pagination: Pagination;
  wants: DiscogsWantlistItem[];
};

/**
 * Iterate every page of a user's collection or wantlist. Discogs sorts by
 * `added desc` so callers doing an incremental sync can stop pulling pages
 * once they hit a `date_added` they've already mirrored locally.
 */
export async function* paginateUserList<T extends DiscogsCollectionItem | DiscogsWantlistItem>(
  kind: "collection" | "wantlist",
): AsyncGenerator<T> {
  const { username } = ensureCredentials();
  const basePath = kind === "collection"
    ? `/users/${encodeURIComponent(username)}/collection/folders/${ALL_FOLDER_ID}/releases`
    : `/users/${encodeURIComponent(username)}/wants`;
  const itemsKey = kind === "collection" ? "releases" : "wants";

  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const params = new URLSearchParams({
      per_page: String(PER_PAGE),
      page: String(page),
      sort: "added",
      sort_order: "desc",
    });
    let attempt = 0;
    let result: { data: CollectionPage | WantlistPage | null; response: Response };
    while (true) {
      try {
        result = await discogsRequest<CollectionPage | WantlistPage>(
          `${basePath}?${params.toString()}`,
        );
        break;
      } catch (err) {
        if (err instanceof DiscogsError && err.status === 429 && attempt < 3) {
          attempt += 1;
          await sleep(RATE_LIMIT_429_BACKOFF_MS);
          continue;
        }
        throw err;
      }
    }
    if (!result.data) return;
    const items = (result.data as Record<string, unknown>)[itemsKey] as T[] | undefined;
    if (items) {
      for (const item of items) yield item;
    }
    totalPages = result.data.pagination?.pages ?? page;
    await rateLimitDelay(result.response);
    page += 1;
  }
}

function joinArtists(artists?: DiscogsBasicInfo["artists"]): string | null {
  if (!artists?.length) return null;
  return artists
    .map((a) => {
      const name = (a.anv?.trim() ? a.anv : a.name) ?? "";
      return a.join ? `${name} ${a.join}` : name;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function firstLabel(info?: DiscogsBasicInfo): { label: string | null; catno: string | null } {
  const entry = info?.labels?.[0];
  return {
    label: entry?.name ?? null,
    catno: entry?.catno ?? null,
  };
}

function formatString(info?: DiscogsBasicInfo): string | null {
  if (!info?.formats?.length) return null;
  return info.formats
    .flatMap((f) => [f.name, ...(f.descriptions ?? [])])
    .filter((s): s is string => !!s)
    .join(", ") || null;
}

function buildSearchText(parts: (string | number | null | undefined)[]): string {
  return parts
    .filter((v): v is string | number => v != null && String(v).trim().length > 0)
    .map((v) => String(v))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

type ReleaseRowInput = {
  userId: string;
  releaseId: string;
  type: DiscogsUserReleaseType;
  artist: string | null;
  title: string | null;
  label: string | null;
  catalogNumber: string | null;
  year: number | null;
  format: string | null;
  thumbUrl: string | null;
  coverUrl: string | null;
  folderId: number | null;
  instanceId: number | null;
  notes: string | null;
  dateAdded: Date | null;
  searchText: string;
  raw: unknown;
};

export function collectionItemToRow(
  userId: string,
  item: DiscogsCollectionItem,
): ReleaseRowInput {
  const info = item.basic_information;
  const artist = joinArtists(info?.artists);
  const { label, catno } = firstLabel(info);
  const year = typeof info?.year === "number" && info.year > 0 ? info.year : null;
  const noteField = item.notes?.find((n) => n.value)?.value ?? null;
  return {
    userId,
    releaseId: String(info?.id ?? item.id),
    type: "collection",
    artist,
    title: info?.title ?? null,
    label,
    catalogNumber: catno,
    year,
    format: formatString(info),
    thumbUrl: info?.thumb ?? null,
    coverUrl: info?.cover_image ?? null,
    folderId: item.folder_id ?? null,
    instanceId: item.instance_id ?? null,
    notes: noteField,
    dateAdded: parseDate(item.date_added),
    searchText: buildSearchText([artist, info?.title, label, catno, year]),
    raw: item,
  };
}

export function wantlistItemToRow(
  userId: string,
  item: DiscogsWantlistItem,
): ReleaseRowInput {
  const info = item.basic_information;
  const artist = joinArtists(info?.artists);
  const { label, catno } = firstLabel(info);
  const year = typeof info?.year === "number" && info.year > 0 ? info.year : null;
  return {
    userId,
    releaseId: String(info?.id ?? item.id),
    type: "wantlist",
    artist,
    title: info?.title ?? null,
    label,
    catalogNumber: catno,
    year,
    format: formatString(info),
    thumbUrl: info?.thumb ?? null,
    coverUrl: info?.cover_image ?? null,
    folderId: null,
    instanceId: null,
    notes: item.notes ?? null,
    dateAdded: parseDate(item.date_added),
    searchText: buildSearchText([artist, info?.title, label, catno, year]),
    raw: item,
  };
}

export function metadataToRow(
  userId: string,
  type: DiscogsUserReleaseType,
  metadata: DiscogsMetadata,
  extras: {
    folderId?: number | null;
    instanceId?: number | null;
    notes?: string | null;
    dateAdded?: Date | null;
  } = {},
): ReleaseRowInput {
  const formatStr = metadata.format?.length
    ? metadata.format.join(", ")
    : null;
  return {
    userId,
    releaseId: metadata.releaseId,
    type,
    artist: metadata.artist ?? null,
    title: metadata.title ?? null,
    label: metadata.label ?? null,
    catalogNumber: metadata.catalogNumber ?? null,
    year: metadata.year ?? null,
    format: formatStr,
    thumbUrl: metadata.thumbUrl ?? null,
    coverUrl: metadata.coverUrl ?? null,
    folderId: extras.folderId ?? null,
    instanceId: extras.instanceId ?? null,
    notes: extras.notes ?? null,
    dateAdded: extras.dateAdded ?? null,
    searchText: buildSearchText([
      metadata.artist,
      metadata.title,
      metadata.label,
      metadata.catalogNumber,
      metadata.year,
    ]),
    raw: { metadata },
  };
}

async function upsertReleaseRow(db: Database, row: ReleaseRowInput) {
  await db
    .insert(discogsUserReleases)
    .values({
      userId: row.userId,
      releaseId: row.releaseId,
      type: row.type,
      artist: row.artist,
      title: row.title,
      label: row.label,
      catalogNumber: row.catalogNumber,
      year: row.year,
      format: row.format,
      thumbUrl: row.thumbUrl,
      coverUrl: row.coverUrl,
      folderId: row.folderId,
      instanceId: row.instanceId,
      notes: row.notes,
      dateAdded: row.dateAdded,
      searchText: row.searchText,
      raw: row.raw,
    })
    .onConflictDoUpdate({
      target: [
        discogsUserReleases.userId,
        discogsUserReleases.releaseId,
        discogsUserReleases.type,
      ],
      set: {
        artist: row.artist,
        title: row.title,
        label: row.label,
        catalogNumber: row.catalogNumber,
        year: row.year,
        format: row.format,
        thumbUrl: row.thumbUrl,
        coverUrl: row.coverUrl,
        folderId: row.folderId,
        instanceId: row.instanceId,
        notes: row.notes,
        dateAdded: row.dateAdded,
        searchText: row.searchText,
        raw: row.raw,
        syncedAt: new Date(),
      },
    });
}

export async function upsertReleaseRowExternal(
  db: Database,
  row: ReleaseRowInput,
) {
  return upsertReleaseRow(db, row);
}

export async function deleteUserRelease(
  db: Database,
  userId: string,
  releaseId: string,
  type: DiscogsUserReleaseType,
) {
  await db
    .delete(discogsUserReleases)
    .where(
      and(
        eq(discogsUserReleases.userId, userId),
        eq(discogsUserReleases.releaseId, releaseId),
        eq(discogsUserReleases.type, type),
      ),
    );
}

async function latestDateAdded(
  db: Database,
  userId: string,
  type: DiscogsUserReleaseType,
): Promise<Date | null> {
  const [row] = await db
    .select({ dateAdded: discogsUserReleases.dateAdded })
    .from(discogsUserReleases)
    .where(
      and(
        eq(discogsUserReleases.userId, userId),
        eq(discogsUserReleases.type, type),
      ),
    )
    .orderBy(desc(discogsUserReleases.dateAdded))
    .limit(1);
  return row?.dateAdded ?? null;
}

export type SyncProgress = {
  phase: "collection" | "wantlist";
  collection: number;
  wantlist: number;
};

export type SyncResult = {
  collection: number;
  wantlist: number;
  durationMs: number;
};

/**
 * Mirror the user's Discogs collection + wantlist into Postgres.
 *
 * Full sync (default): pulls every page and prunes any local rows that weren't
 * touched (so deletions on Discogs.com propagate). Costs roughly 1 request per
 * 100 items.
 *
 * Incremental sync: stops pulling once the most recent page contains items we
 * already have locally. Cheap (typically 1 request) but does NOT detect
 * deletions — those are caught by the next full sync.
 */
export async function syncDiscogsForUser(
  db: Database,
  userId: string,
  opts: {
    incremental?: boolean;
    onProgress?: (p: SyncProgress) => void | Promise<void>;
  } = {},
): Promise<SyncResult> {
  const start = Date.now();
  const startedAt = new Date();
  let collection = 0;
  let wantlist = 0;

  const collectionCutoff = opts.incremental
    ? await latestDateAdded(db, userId, "collection")
    : null;
  for await (const item of paginateUserList<DiscogsCollectionItem>("collection")) {
    if (collectionCutoff && parseDate(item.date_added) && parseDate(item.date_added)! <= collectionCutoff) {
      break;
    }
    await upsertReleaseRow(db, collectionItemToRow(userId, item));
    collection += 1;
    if (collection % 50 === 0) {
      await opts.onProgress?.({ phase: "collection", collection, wantlist });
    }
  }
  await opts.onProgress?.({ phase: "collection", collection, wantlist });

  const wantlistCutoff = opts.incremental
    ? await latestDateAdded(db, userId, "wantlist")
    : null;
  for await (const item of paginateUserList<DiscogsWantlistItem>("wantlist")) {
    if (wantlistCutoff && parseDate(item.date_added) && parseDate(item.date_added)! <= wantlistCutoff) {
      break;
    }
    await upsertReleaseRow(db, wantlistItemToRow(userId, item));
    wantlist += 1;
    if (wantlist % 50 === 0) {
      await opts.onProgress?.({ phase: "wantlist", collection, wantlist });
    }
  }
  await opts.onProgress?.({ phase: "wantlist", collection, wantlist });

  if (!opts.incremental) {
    // Prune anything we didn't re-touch this run — those releases were removed
    // on Discogs.com.
    await db
      .delete(discogsUserReleases)
      .where(
        and(
          eq(discogsUserReleases.userId, userId),
          lt(discogsUserReleases.syncedAt, startedAt),
        ),
      );
  }

  return { collection, wantlist, durationMs: Date.now() - start };
}

// ---------------------------------------------------------------------------
// Local search + auto-match
// ---------------------------------------------------------------------------

export type LocalSearchScope = "collection" | "wantlist" | "any";

export type LocalSearchHit = {
  releaseId: string;
  type: DiscogsUserReleaseType;
  artist: string | null;
  title: string | null;
  label: string | null;
  catalogNumber: string | null;
  year: number | null;
  format: string | null;
  thumbUrl: string | null;
  coverUrl: string | null;
  score: number;
};

export async function searchLocalReleases(
  db: Database,
  userId: string,
  query: string,
  opts: { scope?: LocalSearchScope; limit?: number } = {},
): Promise<LocalSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const scope = opts.scope ?? "any";

  const scopeFilter = scope === "any"
    ? undefined
    : eq(discogsUserReleases.type, scope);

  const score = sql<number>`similarity(${discogsUserReleases.searchText}, ${trimmed})`;

  const rows = await db
    .select({
      releaseId: discogsUserReleases.releaseId,
      type: discogsUserReleases.type,
      artist: discogsUserReleases.artist,
      title: discogsUserReleases.title,
      label: discogsUserReleases.label,
      catalogNumber: discogsUserReleases.catalogNumber,
      year: discogsUserReleases.year,
      format: discogsUserReleases.format,
      thumbUrl: discogsUserReleases.thumbUrl,
      coverUrl: discogsUserReleases.coverUrl,
      score,
    })
    .from(discogsUserReleases)
    .where(
      and(
        eq(discogsUserReleases.userId, userId),
        scopeFilter,
        sql`${discogsUserReleases.searchText} % ${trimmed}`,
      ),
    )
    .orderBy(desc(score))
    .limit(limit);

  return rows;
}
