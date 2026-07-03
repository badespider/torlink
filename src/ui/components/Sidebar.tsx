import { Box, Text, useInput } from "ink";
import { useStore, useQueueItems, CATEGORIES, type Section } from "../store";
import { windowStart, wrapStep } from "../move";
import { ACCENT_RAMP, COLOR, GUTTER, ICON, RULE } from "../theme";

interface NavItem {
  key: Section;
  label: string;
}

const LIBRARY: NavItem[] = [
  { key: "downloads", label: "Downloads" },
  { key: "seeding", label: "Seeding" },
];

const BADGED = (key: Section): boolean => key === "downloads" || key === "seeding";

const BADGE_W = " (00)".length;

const FILTERS: NavItem[] = CATEGORIES.map((c) => ({
  key: c.key as Section,
  label: c.label,
}));
const GROUPS: NavItem[][] = [FILTERS, LIBRARY];
const NAV: NavItem[] = GROUPS.flat();

export const RAIL_WIDTH =
  GUTTER + Math.max(...NAV.map((n) => n.label.length + (BADGED(n.key) ? BADGE_W : 0)));

export function Sidebar() {
  const { section, setSection, region, setRegion, queue, listRows } = useStore();
  const focused = region === "sidebar";
  useQueueItems(queue);
  const active = queue.activeCount;
  const seeding = queue.seedingCount;

  const nav = NAV;
  const idx = Math.max(0, nav.findIndex((n) => n.key === section));

  // On short terminals the full filter list plus the library rows can exceed
  // the body height, which would clip Downloads/Seeding off the bottom. Keep
  // the library pinned and window the filters around the selection instead;
  // arrow keys still walk the full list, and the window follows.
  const gap = listRows >= FILTERS.length + LIBRARY.length + 1 ? 1 : 0;
  const filterRows = Math.max(1, Math.min(FILTERS.length, listRows - LIBRARY.length - gap));
  const filterSel = Math.max(0, FILTERS.findIndex((n) => n.key === section));
  const fStart = windowStart(filterSel, FILTERS.length, filterRows);
  const groups: NavItem[][] = [FILTERS.slice(fStart, fStart + filterRows), LIBRARY];

  useInput(
    (input, key) => {
      if (key.upArrow || input === "k") setSection(nav[wrapStep(idx, -1, nav.length)]!.key);
      else if (key.downArrow || input === "j") setSection(nav[wrapStep(idx, 1, nav.length)]!.key);
      else if (key.return) setRegion("content");
    },
    { isActive: focused },
  );

  return (
    <Box flexDirection="column" width={RAIL_WIDTH} marginRight={1}>
      {groups.map((items, gi) => (
        <Box key={gi} flexDirection="column" marginTop={gi > 0 ? gap : 0}>
          {items.map((item) => {
            const selected = item.key === section;
            return (
              <Box key={item.key}>
                <Box width={GUTTER} flexShrink={0}>
                  {selected ? (
                    <Text color={focused ? ACCENT_RAMP[1] : RULE} bold={focused}>
                      {ICON.bar}
                    </Text>
                  ) : null}
                </Box>
                <Text
                  color={selected ? (focused ? COLOR.accent : COLOR.alt) : undefined}
                  dimColor={!selected}
                  bold={selected && focused}
                >
                  {item.label}
                </Text>
                {(() => {
                  const n = item.key === "downloads" ? active : item.key === "seeding" ? seeding : 0;
                  return n > 0 ? (
                    <Box flexShrink={0}>
                      <Text dimColor>{` (${n})`}</Text>
                    </Box>
                  ) : null;
                })()}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
