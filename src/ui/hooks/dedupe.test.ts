import { describe, expect, it } from "vitest";
import { dedupe } from "./useConcurrentSearch";
import type { TorrentResult } from "../../sources/types";

const HASH = "abcdef0123456789abcdef0123456789abcdef01";

function result(overrides: Partial<TorrentResult>): TorrentResult {
  return {
    infoHash: HASH,
    name: "Same Torrent",
    sizeBytes: 1,
    seeders: 0,
    leechers: 0,
    source: "knaben",
    magnet: `magnet:?xt=urn:btih:${HASH}`,
    ...overrides,
  };
}

describe("dedupe", () => {
  it("keeps the higher-seeder copy", () => {
    const out = dedupe([result({ seeders: 5, source: "knaben" }), result({ seeders: 50, source: "torrentscsv" })]);
    expect(out).toHaveLength(1);
    expect(out[0]!.seeders).toBe(50);
    expect(out[0]!.source).toBe("torrentscsv");
  });

  it("preserves the kind when a kind-less copy wins on seeders", () => {
    const out = dedupe([
      result({ seeders: 5, kind: "music", source: "knaben" }),
      result({ seeders: 50, source: "torrentscsv" }),
    ]);
    expect(out[0]!.seeders).toBe(50);
    expect(out[0]!.kind).toBe("music");
  });

  it("backfills the kind when a kind-carrying copy loses on seeders", () => {
    const out = dedupe([
      result({ seeders: 50, source: "torrentscsv" }),
      result({ seeders: 5, kind: "ebook", source: "knaben" }),
    ]);
    expect(out[0]!.seeders).toBe(50);
    expect(out[0]!.kind).toBe("ebook");
  });

  it("does not overwrite an existing kind with a different one", () => {
    const out = dedupe([
      result({ seeders: 50, kind: "movie", source: "torznab" }),
      result({ seeders: 5, kind: "ebook", source: "knaben" }),
    ]);
    expect(out[0]!.kind).toBe("movie");
  });
});
