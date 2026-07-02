import { describe, expect, it } from "vitest";
import {
  formatTorznabInput,
  normalizeTorznabUrl,
  parseTorznabInput,
  torznabSearchUrl,
} from "./torznab";

const JACKETT_ALL = "/api/v2.0/indexers/all/results/torznab/api";

describe("normalizeTorznabUrl", () => {
  it("expands a bare Jackett base into the aggregate feed", () => {
    expect(normalizeTorznabUrl("http://127.0.0.1:9117")).toBe(
      `http://127.0.0.1:9117${JACKETT_ALL}`,
    );
  });

  it("adds a scheme when the user omits it", () => {
    expect(normalizeTorznabUrl("127.0.0.1:9117")).toBe(
      `http://127.0.0.1:9117${JACKETT_ALL}`,
    );
  });

  it("strips a trailing slash before appending", () => {
    expect(normalizeTorznabUrl("http://127.0.0.1:9117/")).toBe(
      `http://127.0.0.1:9117${JACKETT_ALL}`,
    );
  });

  it("leaves an existing Torznab API url untouched", () => {
    const full = `http://host:9117${JACKETT_ALL}`;
    expect(normalizeTorznabUrl(full)).toBe(full);
  });

  it("leaves a Prowlarr-style api url untouched", () => {
    expect(normalizeTorznabUrl("http://host:9696/1/api")).toBe("http://host:9696/1/api");
  });

  it("removes an embedded apikey query param", () => {
    expect(normalizeTorznabUrl(`http://host:9117${JACKETT_ALL}?apikey=secret`)).toBe(
      `http://host:9117${JACKETT_ALL}`,
    );
  });

  it("returns empty for blank or unparseable input", () => {
    expect(normalizeTorznabUrl("")).toBe("");
    expect(normalizeTorznabUrl("   ")).toBe("");
    expect(normalizeTorznabUrl("http://")).toBe("");
  });
});

describe("parseTorznabInput", () => {
  it("splits url and api key on whitespace", () => {
    expect(parseTorznabInput("http://127.0.0.1:9117 abc123")).toEqual({
      name: "Jackett",
      url: `http://127.0.0.1:9117${JACKETT_ALL}`,
      apiKey: "abc123",
    });
  });

  it("accepts a url with no key", () => {
    expect(parseTorznabInput("http://127.0.0.1:9117")).toEqual({
      name: "Jackett",
      url: `http://127.0.0.1:9117${JACKETT_ALL}`,
      apiKey: "",
    });
  });

  it("pulls the key out of an embedded apikey param", () => {
    const parsed = parseTorznabInput(`http://host:9117${JACKETT_ALL}?apikey=embedded`);
    expect(parsed).toEqual({
      name: "Jackett",
      url: `http://host:9117${JACKETT_ALL}`,
      apiKey: "embedded",
    });
  });

  it("preserves the api key verbatim after the first whitespace", () => {
    expect(parseTorznabInput("http://127.0.0.1:9117   key-with-dashes_and.dots")).toEqual({
      name: "Jackett",
      url: `http://127.0.0.1:9117${JACKETT_ALL}`,
      apiKey: "key-with-dashes_and.dots",
    });
  });

  it("returns null for empty input", () => {
    expect(parseTorznabInput("")).toBeNull();
    expect(parseTorznabInput("   ")).toBeNull();
  });
});

describe("formatTorznabInput", () => {
  it("round-trips url and key", () => {
    expect(formatTorznabInput([{ name: "Jackett", url: "http://x/api", apiKey: "k" }])).toBe(
      "http://x/api k",
    );
  });

  it("omits an empty key", () => {
    expect(formatTorznabInput([{ name: "Jackett", url: "http://x/api", apiKey: "" }])).toBe(
      "http://x/api",
    );
  });

  it("is empty for no endpoints", () => {
    expect(formatTorznabInput([])).toBe("");
  });
});

describe("torznabSearchUrl", () => {
  it("builds a t=search query with the api key", () => {
    const url = torznabSearchUrl(
      { name: "Jackett", url: `http://host:9117${JACKETT_ALL}`, apiKey: "KEY" },
      "big buck bunny",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("apikey")).toBe("KEY");
    expect(parsed.searchParams.get("t")).toBe("search");
    expect(parsed.searchParams.get("q")).toBe("big buck bunny");
  });

  it("omits apikey when the endpoint has none", () => {
    const url = torznabSearchUrl(
      { name: "Native", url: "http://host/torznab/api", apiKey: "" },
      "query",
    );
    expect(new URL(url).searchParams.has("apikey")).toBe(false);
  });
});
