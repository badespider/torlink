import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/config", () => ({ loadConfig: vi.fn(), getLoadedConfig: vi.fn(() => null) }));
vi.mock("./torrentFile", () => ({ magnetFromTorrentBuffer: vi.fn() }));

import { loadConfig } from "../config/config";
import { magnetFromTorrentBuffer } from "./torrentFile";
import { torznab } from "./torznab";

const ENDPOINT = { name: "Jackett", url: "http://host:9117/api", apiKey: "k" };

function wrap(items: string): string {
  return `<rss xmlns:torznab="http://torznab.com/schemas/2015/feed"><channel>${items}</channel></rss>`;
}

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

const mockedLoadConfig = vi.mocked(loadConfig);
const mockedMagnetFromBuffer = vi.mocked(magnetFromTorrentBuffer);

beforeEach(() => {
  mockedLoadConfig.mockResolvedValue({
    downloadDir: "/tmp",
    trackers: [],
    torznab: [ENDPOINT],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("torznab.search", () => {
  it("returns [] without hitting the network when no endpoint is configured", async () => {
    mockedLoadConfig.mockResolvedValue({ downloadDir: "/tmp", trackers: [], torznab: [] });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await torznab.search("anything")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns [] for an empty query without hitting the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await torznab.search("   ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("builds a magnet from an infohash-only item and dedupes by highest seeders", async () => {
    const xml = wrap(`
      <item>
        <title>Dup Low</title>
        <torznab:attr name="seeders" value="5"/>
        <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/>
      </item>
      <item>
        <title>Dup High</title>
        <torznab:attr name="seeders" value="50"/>
        <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/>
      </item>
      <item>
        <title>Hash Only</title>
        <torznab:attr name="seeders" value="9"/>
        <torznab:attr name="infohash" value="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"/>
      </item>`);
    vi.stubGlobal("fetch", vi.fn(async () => xmlResponse(xml)));

    const results = await torznab.search("query");
    expect(results).toHaveLength(2);

    const dup = results.find((r) => r.infoHash === "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(dup!.seeders).toBe(50);
    expect(dup!.source).toBe("torznab");

    const hashOnly = results.find((r) => r.infoHash === "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    // finalize() synthesizes a magnet (with trackers) when only a hash is known.
    expect(hashOnly!.magnet).toContain("xt=urn:btih:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(hashOnly!.magnet).toContain("tr=");
  });

  it("resolves a .torrent-only item into a magnet via the torrent parser", async () => {
    const xml = wrap(`
      <item>
        <title>Private Release</title>
        <torznab:attr name="seeders" value="3"/>
        <link>http://tracker.example/dl/abc.torrent</link>
      </item>`);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes(".torrent")) return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        return xmlResponse(xml);
      }),
    );
    mockedMagnetFromBuffer.mockResolvedValue({
      infoHash: "cccccccccccccccccccccccccccccccccccccccc",
      name: "Private Release",
      magnet: "magnet:?xt=urn:btih:cccccccccccccccccccccccccccccccccccccccc",
    });

    const results = await torznab.search("query");
    expect(mockedMagnetFromBuffer).toHaveBeenCalledOnce();
    expect(results).toHaveLength(1);
    expect(results[0]!.infoHash).toBe("cccccccccccccccccccccccccccccccccccccccc");
  });

  it("returns partial results when one endpoint fails but another succeeds", async () => {
    mockedLoadConfig.mockResolvedValue({
      downloadDir: "/tmp",
      trackers: [],
      torznab: [
        { name: "Down", url: "http://down:9117/api", apiKey: "k" },
        { name: "Up", url: "http://up:9117/api", apiKey: "k" },
      ],
    });
    const okXml = wrap(`
      <item>
        <title>From Up</title>
        <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:dddddddddddddddddddddddddddddddddddddddd"/>
      </item>`);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("down") ? xmlResponse("", 404) : xmlResponse(okXml),
      ),
    );

    const results = await torznab.search("query");
    expect(results).toHaveLength(1);
    expect(results[0]!.infoHash).toBe("dddddddddddddddddddddddddddddddddddddddd");
  });

  it("throws when every endpoint fails and nothing comes back", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => xmlResponse("nope", 404)));
    await expect(torznab.search("query")).rejects.toThrow();
  });
});
