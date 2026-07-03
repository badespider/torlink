import { afterEach, describe, expect, it, vi } from "vitest";
import { torrentscsv } from "./torrentscsv";

const HASH = "8ce12deac386f65238f0501a0279254977f94270";

function stubFetch(torrents: unknown[]): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => new Response(JSON.stringify({ torrents }), { status: 200 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("torrentscsv.search", () => {
  it("returns [] for an empty query without fetching", async () => {
    const fn = stubFetch([]);
    expect(await torrentscsv.search("")).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("maps a torrent to a TorrentResult with no kind", async () => {
    stubFetch([
      {
        infohash: HASH,
        name: "Atomic Habits by James Clear EPUB",
        size_bytes: 4754037,
        created_unix: 1671059978,
        seeders: 188,
        leechers: 2,
      },
    ]);
    const [r] = await torrentscsv.search("atomic habits");
    expect(r).toMatchObject({
      infoHash: HASH,
      name: "Atomic Habits by James Clear EPUB",
      sizeBytes: 4754037,
      seeders: 188,
      leechers: 2,
      source: "torrentscsv",
      added: 1671059978,
    });
    expect(r!.kind).toBeUndefined();
    expect(r!.magnet).toContain(`xt=urn:btih:${HASH}`);
  });

  it("normalizes a base32 hash to hex", async () => {
    stubFetch([{ infohash: "A".repeat(32), name: "b32" }]);
    const [r] = await torrentscsv.search("q");
    expect(r!.infoHash).toBe("0".repeat(40));
  });

  it("skips invalid hashes and clamps negative counts", async () => {
    stubFetch([
      { infohash: "bad", name: "x" },
      { infohash: HASH, name: "y", seeders: -1, leechers: -9 },
    ]);
    const results = await torrentscsv.search("q");
    expect(results).toHaveLength(1);
    expect(results[0]!.seeders).toBe(0);
    expect(results[0]!.leechers).toBe(0);
  });

  it("encodes the query in the request url", async () => {
    const fn = stubFetch([]);
    await torrentscsv.search("hello world & more");
    expect(String(fn.mock.calls[0]![0])).toContain("q=hello%20world%20%26%20more");
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(torrentscsv.search("q")).rejects.toThrow();
  });
});
