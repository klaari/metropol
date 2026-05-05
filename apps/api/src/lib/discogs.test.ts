import "./discogs.test.setup";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  DiscogsError,
  addToCollection,
  getCollectionInstances,
  getRelease,
  getWantEntry,
  isInCollection,
  putWant,
  releaseToMetadata,
  removeFromCollection,
  removeFromWantlist,
  searchReleases,
} from "./discogs";

type RecordedCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
};

type Fixture = { status: number; body?: unknown; headers?: Record<string, string> };

let calls: RecordedCall[] = [];
let fixtureQueue: Fixture[] = [];
const realFetch = globalThis.fetch;

function queueResponse(fixture: Fixture) {
  fixtureQueue.push(fixture);
}

function readHeaders(init?: RequestInit): Record<string, string> {
  const out: Record<string, string> = {};
  const h = init?.headers;
  if (!h) return out;
  if (h instanceof Headers) {
    h.forEach((v, k) => (out[k.toLowerCase()] = v));
  } else if (Array.isArray(h)) {
    for (const [k, v] of h) out[String(k).toLowerCase()] = String(v);
  } else {
    for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = String(v);
  }
  return out;
}

beforeEach(() => {
  calls = [];
  fixtureQueue = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const headers = readHeaders(init);
    const body = init?.body == null ? null : String(init.body);
    calls.push({ url, method, headers, body });
    const fixture = fixtureQueue.shift();
    if (!fixture) {
      throw new Error(`Unexpected fetch (no fixture queued): ${method} ${url}`);
    }
    return new Response(
      fixture.body === undefined ? null : JSON.stringify(fixture.body),
      { status: fixture.status, headers: fixture.headers },
    );
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (fixtureQueue.length > 0) {
    const remaining = JSON.stringify(fixtureQueue);
    fixtureQueue = [];
    throw new Error(`Unused fixtures left over: ${remaining}`);
  }
});

describe("auth + transport", () => {
  test("every request carries Discogs token + UA header", async () => {
    queueResponse({ status: 200, body: { results: [] } });
    await searchReleases("anything");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.headers.authorization).toBe("Discogs token=test-token");
    expect(calls[0]!.headers["user-agent"]).toMatch(/Aani/);
  });

  test("non-OK responses throw DiscogsError with status", async () => {
    queueResponse({ status: 500, body: { message: "boom" } });
    await expect(searchReleases("x")).rejects.toBeInstanceOf(DiscogsError);
  });

  test("404 raises unless allow404 is set", async () => {
    queueResponse({ status: 404, body: { message: "Release not found" } });
    await expect(getRelease("999999")).rejects.toBeInstanceOf(DiscogsError);
  });
});

describe("read-only endpoints", () => {
  test("searchReleases sends type=release + per_page", async () => {
    queueResponse({ status: 200, body: { results: [{ id: 1, title: "x" }] } });
    const out = await searchReleases("daft punk", 5);
    expect(out).toHaveLength(1);
    expect(calls[0]!.url).toContain("/database/search?");
    expect(calls[0]!.url).toContain("q=daft+punk");
    expect(calls[0]!.url).toContain("type=release");
    expect(calls[0]!.url).toContain("per_page=5");
    expect(calls[0]!.method).toBe("GET");
  });

  test("getRelease GETs /releases/{id}", async () => {
    queueResponse({ status: 200, body: { id: 42, title: "rel" } });
    const out = await getRelease("42");
    expect(out?.id).toBe(42);
    expect(calls[0]!.url).toContain("/releases/42");
    expect(calls[0]!.method).toBe("GET");
  });

  test("isInCollection true when releases array non-empty", async () => {
    queueResponse({
      status: 200,
      body: { releases: [{ instance_id: 7, folder_id: 1 }] },
    });
    expect(await isInCollection("100")).toBe(true);
    expect(calls[0]!.url).toContain("/users/kair/collection/releases/100");
    expect(calls[0]!.method).toBe("GET");
  });

  test("isInCollection false on 404", async () => {
    queueResponse({ status: 404 });
    expect(await isInCollection("100")).toBe(false);
  });

  test("isInCollection false when releases array empty", async () => {
    queueResponse({ status: 200, body: { releases: [] } });
    expect(await isInCollection("100")).toBe(false);
  });

  test("getWantEntry 404 → not in list, no note", async () => {
    queueResponse({ status: 404 });
    expect(await getWantEntry("100")).toEqual({ inList: false, note: null });
  });

  test("getWantEntry 200 with notes returns the note", async () => {
    queueResponse({
      status: 200,
      body: { id: 100, notes: "ostettu Helsingistä" },
    });
    expect(await getWantEntry("100")).toEqual({
      inList: true,
      note: "ostettu Helsingistä",
    });
  });

  test("getWantEntry 200 without notes returns null note", async () => {
    queueResponse({ status: 200, body: { id: 100 } });
    expect(await getWantEntry("100")).toEqual({ inList: true, note: null });
  });
});

describe("add operations", () => {
  test("addToCollection POSTs to folder 1, no body", async () => {
    queueResponse({
      status: 201,
      body: { instance_id: 99, resource_url: "x" },
    });
    await addToCollection("12345");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toMatch(
      /\/users\/kair\/collection\/folders\/1\/releases\/12345$/,
    );
    // No JSON body needed for adds — Discogs doesn't require any payload.
    expect(calls[0]!.body).toBeNull();
  });

  test("addToCollection encodes weird release IDs", async () => {
    queueResponse({ status: 201, body: { instance_id: 1, resource_url: "x" } });
    await addToCollection("a/b c");
    expect(calls[0]!.url).toContain("/releases/a%2Fb%20c");
  });
});

describe("putWant — wantlist add/update", () => {
  test("with no note → PUT with no body (does not touch existing notes)", async () => {
    queueResponse({ status: 200, body: { id: 100 } });
    await putWant("100");
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.url).toMatch(/\/users\/kair\/wants\/100$/);
    expect(calls[0]!.body).toBeNull();
  });

  test("with note string → PUT with notes set", async () => {
    queueResponse({ status: 200, body: { id: 100 } });
    await putWant("100", "haluan 12 inch");
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.body).not.toBeNull();
    expect(JSON.parse(calls[0]!.body!)).toEqual({ notes: "haluan 12 inch" });
  });

  test("with note=null → explicit clear (notes='')", async () => {
    queueResponse({ status: 200, body: { id: 100 } });
    await putWant("100", null);
    expect(calls[0]!.method).toBe("PUT");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ notes: "" });
  });

  test("never sends rating field", async () => {
    queueResponse({ status: 200, body: { id: 100 } });
    await putWant("100", "x");
    const body = JSON.parse(calls[0]!.body!);
    expect(body).not.toHaveProperty("rating");
  });
});

describe("destructive operations", () => {
  test("removeFromWantlist sends DELETE on the right URL, no body", async () => {
    queueResponse({ status: 204 });
    await removeFromWantlist("100");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("DELETE");
    expect(calls[0]!.url).toMatch(/\/users\/kair\/wants\/100$/);
    expect(calls[0]!.body).toBeNull();
  });

  test("removeFromCollection on empty collection makes ZERO DELETE calls", async () => {
    // GET returns 404 → no instances → nothing to delete
    queueResponse({ status: 404 });
    const removed = await removeFromCollection("100");
    expect(removed).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("GET");
  });

  test("removeFromCollection on empty releases array makes ZERO DELETE calls", async () => {
    queueResponse({ status: 200, body: { releases: [] } });
    const removed = await removeFromCollection("100");
    expect(removed).toBe(0);
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(0);
  });

  test("removeFromCollection deletes each instance with the GET'd folder_id + instance_id", async () => {
    queueResponse({
      status: 200,
      body: {
        releases: [
          { instance_id: 7, folder_id: 1 },
          { instance_id: 9, folder_id: 5 },
        ],
      },
    });
    queueResponse({ status: 204 });
    queueResponse({ status: 204 });

    const removed = await removeFromCollection("100");
    expect(removed).toBe(2);

    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url).toMatch(/\/users\/kair\/collection\/releases\/100$/);

    expect(calls[1]!.method).toBe("DELETE");
    expect(calls[1]!.url).toMatch(
      /\/users\/kair\/collection\/folders\/1\/releases\/100\/instances\/7$/,
    );

    expect(calls[2]!.method).toBe("DELETE");
    expect(calls[2]!.url).toMatch(
      /\/users\/kair\/collection\/folders\/5\/releases\/100\/instances\/9$/,
    );
  });

  test("removeFromCollection NEVER hardcodes folder 1 for the DELETE", async () => {
    // Regression guard: if a release is in a non-default folder, we must
    // delete from THAT folder, not folder 1.
    queueResponse({
      status: 200,
      body: { releases: [{ instance_id: 42, folder_id: 99 }] },
    });
    queueResponse({ status: 204 });

    await removeFromCollection("100");
    expect(calls[1]!.url).toMatch(/\/folders\/99\//);
    expect(calls[1]!.url).not.toMatch(/\/folders\/1\//);
  });

  test("getCollectionInstances returns [] on 404 (release never collected)", async () => {
    queueResponse({ status: 404 });
    expect(await getCollectionInstances("100")).toEqual([]);
  });
});

describe("releaseToMetadata", () => {
  test("maps Discogs release shape into our DiscogsMetadata", async () => {
    const meta = releaseToMetadata({
      id: 12345,
      master_id: 67890,
      title: "On A Journey",
      year: 1996,
      country: "Germany",
      artists: [{ name: "Kelli Hand", anv: "K. Hand", join: "" }],
      labels: [{ name: "!K7 Records", catno: "!K7R001LP" }],
      formats: [{ name: "Vinyl", descriptions: ["LP", "Album"] }],
      genres: ["Electronic"],
      styles: ["Detroit Techno"],
      images: [
        {
          type: "primary",
          uri: "https://img/big.jpg",
          uri150: "https://img/thumb.jpg",
        },
      ],
      thumb: "https://img/fallback.jpg",
      resource_url: "https://api.discogs.com/releases/12345",
    });

    expect(meta.releaseId).toBe("12345");
    expect(meta.masterId).toBe("67890");
    expect(meta.year).toBe(1996);
    expect(meta.label).toBe("!K7 Records");
    expect(meta.catalogNumber).toBe("!K7R001LP");
    expect(meta.country).toBe("Germany");
    expect(meta.genres).toEqual(["Electronic"]);
    expect(meta.styles).toEqual(["Detroit Techno"]);
    expect(meta.coverUrl).toBe("https://img/big.jpg");
    expect(meta.thumbUrl).toBe("https://img/thumb.jpg");
    expect(meta.artist).toContain("K. Hand");
    expect(typeof meta.fetchedAt).toBe("string");
  });

  test("falls back to thumb when no images[]", async () => {
    const meta = releaseToMetadata({
      id: 1,
      title: "x",
      thumb: "https://img/fallback.jpg",
    });
    expect(meta.thumbUrl).toBe("https://img/fallback.jpg");
    expect(meta.coverUrl).toBeNull();
  });

  test("year 0 / negative is dropped", async () => {
    const meta = releaseToMetadata({ id: 1, title: "x", year: 0 });
    expect(meta.year).toBeNull();
  });
});

