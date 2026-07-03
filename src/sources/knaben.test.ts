import { afterEach, describe, expect, it, vi } from "vitest";
import { kindFromCategories, knaben } from "./knaben";

const HASH = "b2b58c79a36d9e23bbafc7171b965473e6d5d4a1";

function hit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Some Release",
    hash: HASH.toUpperCase(),
    bytes: 1000,
    seeders: 10,
    peers: 3,
    date: "2026-05-10T07:25:00+00:00",
    categoryId: [3001000, 3000000],
    ...overrides,
  };
}

function stubFetch(hits: unknown[]): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => new Response(JSON.stringify({ hits }), { status: 200 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("kindFromCategories", () => {
  it("maps Knaben families to kinds", () => {
    expect(kindFromCategories([1003000, 1000000])).toBe("audiobook");
    expect(kindFromCategories([9001000, 10000000])).toBe("ebook");
    expect(kindFromCategories([1002000, 1000000])).toBe("music");
    expect(kindFromCategories([3001000, 3000000])).toBe("movie");
    expect(kindFromCategories([6001000])).toBe("anime");
    expect(kindFromCategories([2001000, 2000000])).toBe("tv");
    expect(kindFromCategories([5001000])).toBe("xxx");
    expect(kindFromCategories([7009000])).toBe("game");
    expect(kindFromCategories([4001000, 4000000])).toBe("game");
    expect(kindFromCategories([4002000, 4000000])).toBe("software");
    expect(kindFromCategories([10000000])).toBe("other");
    expect(kindFromCategories([])).toBe("other");
  });
});

describe("knaben.search", () => {
  it("returns [] for an empty query without fetching", async () => {
    const fn = stubFetch([]);
    expect(await knaben.search("  ")).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("maps a hit to a TorrentResult", async () => {
    stubFetch([hit()]);
    const [r] = await knaben.search("query");
    expect(r).toMatchObject({
      infoHash: HASH,
      name: "Some Release",
      sizeBytes: 1000,
      seeders: 10,
      leechers: 3,
      source: "knaben",
      kind: "movie",
    });
    expect(r!.added).toBe(Math.floor(Date.parse("2026-05-10T07:25:00+00:00") / 1000));
  });

  it("prefers the provided magnet and falls back to building one", async () => {
    stubFetch([
      hit({ magnetUrl: `magnet:?xt=urn:btih:${HASH}&dn=x` }),
      hit({ hash: "1111111111111111111111111111111111111111", magnetUrl: null }),
    ]);
    const [a, b] = await knaben.search("query");
    expect(a!.magnet).toBe(`magnet:?xt=urn:btih:${HASH}&dn=x`);
    expect(b!.magnet).toContain("xt=urn:btih:1111111111111111111111111111111111111111");
    expect(b!.magnet).toContain("tr=");
  });

  it("skips hits with missing or invalid hashes and clamps negative counts", async () => {
    stubFetch([
      hit({ hash: "nope" }),
      hit({ hash: undefined }),
      hit({ seeders: -5, peers: -2 }),
    ]);
    const results = await knaben.search("query");
    expect(results).toHaveLength(1);
    expect(results[0]!.seeders).toBe(0);
    expect(results[0]!.leechers).toBe(0);
  });

  it("sends the exact-match search request", async () => {
    const fn = stubFetch([]);
    await knaben.search("the query");
    const body = JSON.parse((fn.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.search_type).toBe("100%");
    expect(body.query).toBe("the query");
    expect(body.hide_unsafe).toBe(true);
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    await expect(knaben.search("query")).rejects.toThrow();
  });
});
