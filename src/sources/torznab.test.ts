import { describe, expect, it } from "vitest";
import { parseTorznab } from "./torznab";

function wrap(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:torznab="http://torznab.com/schemas/2015/feed">
<channel>${items}</channel>
</rss>`;
}

describe("parseTorznab", () => {
  it("parses a standard Jackett item with a magneturl attr", () => {
    const xml = wrap(`
    <item>
      <title>Big Buck Bunny 1080p</title>
      <jackettindexer id="thepiratebay">The Pirate Bay</jackettindexer>
      <size>1500000000</size>
      <pubDate>Mon, 30 Jun 2025 12:00:00 +0000</pubDate>
      <link>http://127.0.0.1:9117/dl/thepiratebay/?jackett_apikey=x</link>
      <torznab:attr name="seeders" value="120"/>
      <torznab:attr name="peers" value="150"/>
      <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01&amp;dn=Big+Buck+Bunny"/>
    </item>`);
    const [r] = parseTorznab(xml);
    expect(r).toBeDefined();
    expect(r!.name).toBe("Big Buck Bunny 1080p [The Pirate Bay]");
    expect(r!.sizeBytes).toBe(1_500_000_000);
    expect(r!.seeders).toBe(120);
    // torznab "peers" is seeders + leechers, so leechers = 150 - 120.
    expect(r!.leechers).toBe(30);
    expect(r!.infoHash).toBe("abcdef0123456789abcdef0123456789abcdef01");
    expect(r!.magnet).toContain("magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01");
    // the &amp; entity is decoded back into a real &
    expect(r!.magnet).toContain("&dn=Big+Buck+Bunny");
  });

  it("handles value-first attr order, a direct leechers attr, and size as an attr", () => {
    const xml = wrap(`
    <item>
      <title>Some Show S01E01</title>
      <torznab:attr value="55" name="seeders"/>
      <torznab:attr name="leechers" value="5"/>
      <torznab:attr name="size" value="734003200"/>
      <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:1111111111111111111111111111111111111111"/>
    </item>`);
    const [r] = parseTorznab(xml);
    expect(r!.seeders).toBe(55);
    expect(r!.leechers).toBe(5);
    expect(r!.sizeBytes).toBe(734_003_200);
  });

  it("falls back to a magnet <link>", () => {
    const xml = wrap(`
    <item>
      <title>Movie</title>
      <link>magnet:?xt=urn:btih:2222222222222222222222222222222222222222&amp;dn=Movie</link>
      <torznab:attr name="seeders" value="10"/>
    </item>`);
    const [r] = parseTorznab(xml);
    expect(r!.infoHash).toBe("2222222222222222222222222222222222222222");
    expect(r!.magnet).toContain("urn:btih:2222222222222222222222222222222222222222");
    expect(r!.leechers).toBe(0);
  });

  it("falls back to a magnet <enclosure>", () => {
    const xml = wrap(`
    <item>
      <title>Enclosed</title>
      <enclosure url="magnet:?xt=urn:btih:3333333333333333333333333333333333333333" type="application/x-bittorrent"/>
      <torznab:attr name="seeders" value="3"/>
    </item>`);
    const [r] = parseTorznab(xml);
    expect(r!.infoHash).toBe("3333333333333333333333333333333333333333");
  });

  it("uses an infohash attr when there is no magnet, without a torrent url", () => {
    const xml = wrap(`
    <item>
      <title>Private</title>
      <link>http://tracker.example/download/xyz.torrent</link>
      <torznab:attr name="infohash" value="4444444444444444444444444444444444444444"/>
      <torznab:attr name="seeders" value="7"/>
    </item>`);
    const [r] = parseTorznab(xml);
    expect(r!.infoHash).toBe("4444444444444444444444444444444444444444");
    expect(r!.magnet).toBeUndefined();
    expect(r!.torrentUrl).toBeUndefined();
  });

  it("keeps a .torrent link for later resolution when nothing else identifies it", () => {
    const xml = wrap(`
    <item>
      <title>OnlyTorrent</title>
      <link>http://tracker.example/download/abc.torrent</link>
      <torznab:attr name="seeders" value="2"/>
    </item>`);
    const [r] = parseTorznab(xml);
    expect(r!.infoHash).toBeUndefined();
    expect(r!.magnet).toBeUndefined();
    expect(r!.torrentUrl).toBe("http://tracker.example/download/abc.torrent");
  });

  it("decodes CDATA titles and lowercases an uppercase infohash", () => {
    const xml = wrap(`
    <item>
      <title><![CDATA[Weird & Title]]></title>
      <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:ABCDEF0123456789ABCDEF0123456789ABCDEF01"/>
    </item>`);
    const [r] = parseTorznab(xml);
    expect(r!.name).toBe("Weird & Title");
    expect(r!.infoHash).toBe("abcdef0123456789abcdef0123456789abcdef01");
  });

  it("skips items with no title and parses every valid item", () => {
    const xml = wrap(`
    <item>
      <description>no title here</description>
      <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:5555555555555555555555555555555555555555"/>
    </item>
    <item>
      <title>Valid</title>
      <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:6666666666666666666666666666666666666666"/>
    </item>`);
    const results = parseTorznab(xml);
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("Valid");
  });

  it("returns an empty array for empty or channel-less xml", () => {
    expect(parseTorznab("")).toEqual([]);
    expect(parseTorznab("<rss><channel></channel></rss>")).toEqual([]);
  });

  it("rejects a too-short magnet infohash instead of emitting a malformed one", () => {
    const xml = wrap(`
    <item>
      <title>Truncated</title>
      <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:abc"/>
    </item>`);
    // No magnet, no infohash attr, no http link => the item is dropped entirely.
    expect(parseTorznab(xml)).toEqual([]);
  });

  it("rejects a too-short infohash attr", () => {
    const xml = wrap(`
    <item>
      <title>Bad Hash</title>
      <torznab:attr name="infohash" value="a"/>
    </item>`);
    expect(parseTorznab(xml)).toEqual([]);
  });

  it("parses single-quoted attributes", () => {
    const xml = wrap(`
    <item>
      <title>Single Quoted</title>
      <torznab:attr name='seeders' value='42'/>
      <torznab:attr name='magneturl' value='magnet:?xt=urn:btih:7777777777777777777777777777777777777777'/>
    </item>`);
    const [r] = parseTorznab(xml);
    expect(r!.seeders).toBe(42);
    expect(r!.infoHash).toBe("7777777777777777777777777777777777777777");
  });

  it("clamps negative seeders/peers so leechers never inflate", () => {
    const xml = wrap(`
    <item>
      <title>Weird Counts</title>
      <torznab:attr name="seeders" value="-10"/>
      <torznab:attr name="peers" value="100"/>
      <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:8888888888888888888888888888888888888888"/>
    </item>`);
    const [r] = parseTorznab(xml);
    expect(r!.seeders).toBe(0);
    expect(r!.leechers).toBe(100);
  });

  it("still parses a valid item that follows a self-closing <item/>", () => {
    const xml = wrap(`
    <item/>
    <item>
      <title>After Self Close</title>
      <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:9999999999999999999999999999999999999999"/>
    </item>`);
    const results = parseTorznab(xml);
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("After Self Close");
  });

  it("picks the magnet enclosure even when a non-magnet enclosure comes first", () => {
    const xml = wrap(`
    <item>
      <title>Multi Enclosure</title>
      <enclosure url="http://host/metadata.xml" type="text/xml"/>
      <enclosure url="magnet:?xt=urn:btih:1010101010101010101010101010101010101010" type="application/x-bittorrent"/>
    </item>`);
    const [r] = parseTorznab(xml);
    expect(r!.infoHash).toBe("1010101010101010101010101010101010101010");
  });

  const kindCase = (label: string, cats: string, expected: string, title = "Some Title"): void => {
    it(`classifies ${label} as "${expected}"`, () => {
      const catTags = cats
        .split(",")
        .map((c) => `<category>${c.trim()}</category>`)
        .join("");
      const xml = wrap(`
      <item>
        <title>${title}</title>
        ${catTags}
        <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01"/>
      </item>`);
      expect(parseTorznab(xml)[0]!.kind).toBe(expected);
    });
  };

  kindCase("an ebook (7020)", "7020", "ebook");
  kindCase("books (7000)", "7000", "ebook");
  kindCase("music (3010)", "3010", "music");
  kindCase("an audiobook by code (3030)", "3030", "audiobook");
  kindCase("an audiobook by title", "7020", "audiobook", "Dune Audiobook Unabridged");
  // The title hint must NOT override a clearly non-book/audio category.
  kindCase("software titled 'Audiobook'", "4030", "software", "Audiobook Editor Pro");
  kindCase("audiobook by title with no category", "", "audiobook", "Some Great Audiobook");
  kindCase("a movie (2040)", "2040", "movie");
  kindCase("tv (5040)", "5040", "tv");
  kindCase("anime (5070)", "5070", "anime");
  kindCase("software (4030)", "4030", "software");
  kindCase("a console game (1080)", "1080", "game");

  it("ignores indexer-specific custom category codes when classifying", () => {
    // 100467 is a custom (>99999) code; the standard 7020 should win.
    const xml = wrap(`
    <item>
      <title>Book With Custom Cats</title>
      <category>100467</category>
      <category>7020</category>
      <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01"/>
    </item>`);
    expect(parseTorznab(xml)[0]!.kind).toBe("ebook");
  });

  it("defaults to \"other\" when no standard category is present", () => {
    const xml = wrap(`
    <item>
      <title>Uncategorized</title>
      <category>100467</category>
      <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01"/>
    </item>`);
    expect(parseTorznab(xml)[0]!.kind).toBe("other");
  });
});
