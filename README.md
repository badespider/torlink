<p align="center">
  <img src="preview/splash.svg" alt="torlink, curated torrents straight from your terminal" style="max-width: 832px; width: 100%; height: auto;">
</p>

Finding a torrent these days sucks. One site is a minefield of fake download buttons. Another hides the real link under a popup that spawns two more tabs. And after all that, half the results are dead, zero seeders.

torlink is a torrent finder that lives in your terminal, with zero setup and nothing to configure. One search checks a short, curated list of reputable sources at once, and whatever you pick downloads straight to your computer. The files are yours, saved to your downloads folder.

And it's not just movies and TV: torlink also searches **ebooks, audiobooks, music, and software** out of the box — no configuration — each with its own tab. Want even more reach, or your own private trackers? Connect a [Jackett](https://github.com/Jackett/Jackett) instance and one search hits hundreds of indexers; see [Search everything](#search-everything-jackett--torznab) below.

## Get started

All torlink needs is [Node](https://nodejs.org) (v22+). Install it with one command — the repo ships prebuilt, so there's nothing to clone or compile:

```sh
npm install -g https://github.com/badespider/torlink/archive/refs/heads/main.tar.gz
```

From then on, just type **`torlnk`** in any terminal — that's the whole daily routine. To update later, run the same install command again.

(`npx torlnk` also exists, but it runs the version published to npm, which can lag behind this repo — the Jackett "search everything" and the Music/Ebooks/Audiobooks/Software tabs land here first.)

torlink opens straight to a search bar: search for what you want, paste in a magnet link or a bare infohash, or press Enter on an empty box to browse the curated library. It's all keypresses — nothing to memorize — and `?` brings up the full list anytime. For the unlimited Jackett search, see [Search everything](#search-everything-jackett--torznab).

## Finding something

Type what you're looking for and press Enter. Results stream in from every source as they answer, tagged with size and how many people are sharing each one, so you can see what'll come down fast. Arrow to what you want and press `d` to save it.

The tabs down the left narrow a search to one type — Movies, TV, Anime, Games, Music, Ebooks, Audiobooks, and Software. Each result's `Src` tag shows where it came from, so you can tell a curated source from a meta-index at a glance.

<p align="center">
  <img src="preview/browse.svg" alt="torlink's browse view: the sidebar, the search bar, and merged results from every source" style="max-width: 832px; width: 100%; height: auto;">
</p>

## Your downloads

Active downloads sit up top with their progress, speed, and time left; when one finishes it drops into Recently downloaded just below, so the list stays tidy. Everything's still there when you come back, and anything interrupted picks up where it left off.

Downloads run in the background while you keep searching, so you can queue up as many as you want. They save to your downloads folder, and the Downloads pane keeps tabs on each one. Press `o` on any download (or any item in the Seeding tab) to open its folder in Finder. When something finishes it keeps seeding automatically so the next person can find it too, and the Seeding tab lets you pause or stop that anytime.

<p align="center">
  <img src="preview/downloads.svg" alt="torlink's Downloads pane: live progress on top, recently downloaded below" style="max-width: 832px; width: 100%; height: auto;">
</p>

## What it searches

Out of the box, with no setup:

| Category | Sources |
| --- | --- |
| Games | FitGirl |
| Movies | YTS, The Pirate Bay, 1337x |
| TV | EZTV, The Pirate Bay, 1337x |
| Anime | Nyaa, SubsPlease |
| Everything else (ebooks, audiobooks, music, software, …) | Knaben, Torrents-CSV |

The curated rows are hand-picked, single-purpose sources. Knaben and Torrents-CSV are open meta-indexes with plain JSON APIs; torlink reads each of their results' categories and sorts them into the Music, Ebooks, Audiobooks, and Software tabs. If a source is down, the search carries on without it, and torlink tells you which one is offline.

A note on trust: the curated Games tab comes from FitGirl alone, a repacker with a long track record, because games can run code. The meta-indexes aren't curated the same way — anything executable they return (software, games) deserves the same caution you'd give any download from an unknown source.

## Search everything (Jackett / Torznab)

Everything above works with zero setup. If you want even more — hundreds of trackers, or your own private ones — point torlink at a [Jackett](https://github.com/Jackett/Jackett) (or Prowlarr) instance and it will also search every indexer you've added there in one go. One extra source, effectively unlimited reach.

Press **`J`** inside torlink, paste your Jackett URL and API key, and press Enter:

```
http://127.0.0.1:9117  your-api-key
```

Results from those indexers show up merged into the **All** tab, tagged `JKT`, and on their own **Jackett** tab. torlink reads each result's category and sorts it, so once Jackett is connected you also get **Music**, **Ebooks**, **Audiobooks**, and **Software** tabs — search once, then flip to just the type you want. Full walkthrough, including how to stand up Jackett from scratch: [docs/infinity-search.md](docs/infinity-search.md).

A word of caution: unlike the curated list above, aggregated indexers aren't vetted, and they can return anything — including games and other executables. Treat those results with the same care you'd give any download from an unknown source.

## Contributing

To run or work on torlink locally:

1. Clone the repository and open the folder.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Run the development version:
   ```sh
   npm run dev
   ```
   Or build it and run the bundled version:
   ```sh
   npm run build
   npx torlnk
   ```

Before opening a PR, skim [CONTRIBUTING.md](CONTRIBUTING.md); it lays out the bar with examples from real merged PRs.

## Privacy

Your files stay on your disk, and nothing routes through a central server; torlink only talks to the torrent network directly. Once a download finishes it keeps seeding by default, sharing it back so the next person can find it just as easily. The network only works because people pass things along, and even a few minutes makes a real difference. If you'd rather not, opt out anytime: open the Seeding tab, press `p` to pause or stop any item, and press it again to pick it back up. Always your call.

## Star History

<a href="https://www.star-history.com/?repos=baairon%2Ftorlink&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=baairon/torlink&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=baairon/torlink&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=baairon/torlink&type=date&legend=top-left" />
 </picture>
</a>
