import "./discogs.test.setup";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  collectionItemToRow,
  metadataToRow,
  paginateUserList,
  wantlistItemToRow,
  type DiscogsCollectionItem,
  type DiscogsWantlistItem,
} from "./discogs";

type RecordedCall = {
  url: string;
  method: string;
  body: string | null;
};

type Fixture = { status: number; body?: unknown; headers?: Record<string, string> };

let calls: RecordedCall[] = [];
let fixtureQueue: Fixture[] = [];
const realFetch = globalThis.fetch;

function queueResponse(fixture: Fixture) {
  fixtureQueue.push(fixture);
}

beforeEach(() => {
  calls = [];
  fixtureQueue = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const body = init?.body == null ? null : String(init.body);
    calls.push({ url, method, body });
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

describe("paginateUserList — collection", () => {
  test("yields every item across all pages, sorted added desc", async () => {
    queueResponse({
      status: 200,
      body: {
        pagination: { page: 1, pages: 2, per_page: 100, items: 3 },
        releases: [
          { id: 1, basic_information: { id: 1, title: "A" } },
          { id: 2, basic_information: { id: 2, title: "B" } },
        ],
      },
    });
    queueResponse({
      status: 200,
      body: {
        pagination: { page: 2, pages: 2, per_page: 100, items: 3 },
        releases: [{ id: 3, basic_information: { id: 3, title: "C" } }],
      },
    });

    const out: DiscogsCollectionItem[] = [];
    for await (const item of paginateUserList<DiscogsCollectionItem>(
      "collection",
    )) {
      out.push(item);
    }
    expect(out.map((r) => r.basic_information?.title)).toEqual(["A", "B", "C"]);

    // Check the URL shape: folder 0 (all), per_page=100, sort=added desc.
    expect(calls[0]!.url).toContain(
      "/users/kair/collection/folders/0/releases?",
    );
    expect(calls[0]!.url).toContain("per_page=100");
    expect(calls[0]!.url).toContain("page=1");
    expect(calls[0]!.url).toContain("sort=added");
    expect(calls[0]!.url).toContain("sort_order=desc");

    expect(calls[1]!.url).toContain("page=2");
  });

  test("stops after a single page when pagination.pages = 1", async () => {
    queueResponse({
      status: 200,
      body: {
        pagination: { page: 1, pages: 1, per_page: 100, items: 1 },
        releases: [{ id: 7, basic_information: { id: 7, title: "only" } }],
      },
    });
    let count = 0;
    for await (const _ of paginateUserList("collection")) count += 1;
    expect(count).toBe(1);
    expect(calls).toHaveLength(1);
  });
});

describe("paginateUserList — wantlist", () => {
  test("reads from the `wants` array under /users/{u}/wants", async () => {
    queueResponse({
      status: 200,
      body: {
        pagination: { page: 1, pages: 1, per_page: 100, items: 2 },
        wants: [
          { id: 10, basic_information: { id: 10, title: "want-A" } },
          { id: 11, basic_information: { id: 11, title: "want-B" } },
        ],
      },
    });
    const out: DiscogsWantlistItem[] = [];
    for await (const item of paginateUserList<DiscogsWantlistItem>("wantlist")) {
      out.push(item);
    }
    expect(out.map((r) => r.basic_information?.title)).toEqual([
      "want-A",
      "want-B",
    ]);
    expect(calls[0]!.url).toContain("/users/kair/wants?");
  });

  test("an empty wants array on page 1 ends the generator (no extra calls)", async () => {
    queueResponse({
      status: 200,
      body: {
        pagination: { page: 1, pages: 1, per_page: 100, items: 0 },
        wants: [],
      },
    });
    const out: DiscogsWantlistItem[] = [];
    for await (const item of paginateUserList<DiscogsWantlistItem>("wantlist")) {
      out.push(item);
    }
    expect(out).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});

describe("collectionItemToRow", () => {
  test("flattens basic_information into a row, derives search_text", () => {
    const row = collectionItemToRow("user_abc", {
      id: 12345,
      instance_id: 55,
      folder_id: 1,
      date_added: "2024-06-01T12:00:00-07:00",
      basic_information: {
        id: 12345,
        title: "Selected Ambient Works",
        year: 1992,
        thumb: "https://i/t.jpg",
        cover_image: "https://i/c.jpg",
        artists: [{ name: "Aphex Twin" }],
        labels: [{ name: "R&S Records", catno: "AMB 3922" }],
        formats: [{ name: "Vinyl", descriptions: ["LP", "Album"] }],
      },
    });
    expect(row.userId).toBe("user_abc");
    expect(row.releaseId).toBe("12345");
    expect(row.type).toBe("collection");
    expect(row.artist).toBe("Aphex Twin");
    expect(row.title).toBe("Selected Ambient Works");
    expect(row.label).toBe("R&S Records");
    expect(row.catalogNumber).toBe("AMB 3922");
    expect(row.year).toBe(1992);
    expect(row.format).toBe("Vinyl, LP, Album");
    expect(row.thumbUrl).toBe("https://i/t.jpg");
    expect(row.coverUrl).toBe("https://i/c.jpg");
    expect(row.folderId).toBe(1);
    expect(row.instanceId).toBe(55);
    expect(row.dateAdded).toBeInstanceOf(Date);
    expect(row.searchText).toContain("Aphex Twin");
    expect(row.searchText).toContain("Selected Ambient Works");
    expect(row.searchText).toContain("AMB 3922");
    expect(row.searchText).toContain("1992");
  });

  test("year 0 / negative is dropped", () => {
    const row = collectionItemToRow("u", {
      id: 1,
      basic_information: { id: 1, title: "x", year: 0 },
    });
    expect(row.year).toBeNull();
  });
});

describe("wantlistItemToRow", () => {
  test("notes come from the top-level wantlist `notes` string, not basic_info", () => {
    const row = wantlistItemToRow("user_abc", {
      id: 999,
      date_added: "2024-01-01T00:00:00Z",
      notes: "second copy please",
      basic_information: {
        id: 999,
        title: "want-title",
        artists: [{ name: "Some Artist" }],
      },
    });
    expect(row.type).toBe("wantlist");
    expect(row.notes).toBe("second copy please");
    expect(row.folderId).toBeNull();
    expect(row.instanceId).toBeNull();
    expect(row.dateAdded?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("metadataToRow — push-on-write mapper from track-level metadata", () => {
  test("flattens DiscogsMetadata into the row shape (format array → comma string)", () => {
    const row = metadataToRow("user_abc", "collection", {
      releaseId: "42",
      title: "On A Journey",
      artist: "K. Hand",
      label: "!K7 Records",
      catalogNumber: "!K7R001LP",
      year: 1996,
      format: ["Vinyl", "LP", "Album"],
      coverUrl: "https://i/c.jpg",
      thumbUrl: "https://i/t.jpg",
      fetchedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(row.releaseId).toBe("42");
    expect(row.type).toBe("collection");
    expect(row.format).toBe("Vinyl, LP, Album");
    expect(row.searchText).toContain("K. Hand");
    expect(row.searchText).toContain("On A Journey");
    expect(row.searchText).toContain("!K7R001LP");
    expect(row.searchText).toContain("1996");
  });

  test("extras (folder_id / instance_id / notes) flow through", () => {
    const row = metadataToRow(
      "u",
      "wantlist",
      {
        releaseId: "1",
        title: "x",
        fetchedAt: "2024-01-01T00:00:00.000Z",
      },
      { notes: "from-discogs" },
    );
    expect(row.notes).toBe("from-discogs");
  });
});
