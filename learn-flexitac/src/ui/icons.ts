// 24x24 stroke icons (1.6 px, round caps). Drawn for this site; all use currentColor.
import type { IconId } from "../types";

const P: Record<IconId, string> = {
  grid: '<path d="M4 7h16M4 12h16M4 17h16M8 4v16M12 4v16M16 4v16"/><circle cx="12" cy="12" r="1.9" class="f"/>',
  layers: '<path d="m12 4 8.5 4.2L12 12.4 3.5 8.2z"/><path d="m3.5 12 8.5 4.2 8.5-4.2"/><path d="m3.5 15.8 8.5 4.2 8.5-4.2"/>',
  pulse: '<path d="M3 12h4l2-5 3 10 2.4-7 1.6 2H21"/>',
  touch: '<path d="M9.5 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1a1.5 1.5 0 0 1 3 0v1.5m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.6a5 5 0 0 1-4-2L5 15.5a1.5 1.5 0 0 1 2.3-2l2.2 2.2"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="1.2"/><path d="M10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5"/>',
  cable: '<path d="M4 6h7a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3h3"/><path d="M4 10h5a1 1 0 0 1 1 1v6a5 5 0 0 0 5 5"/><path d="M4 2h9a5 5 0 0 1 5 5v5a2 2 0 0 0 2 2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bolt: '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z"/>',
  wave: '<path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/>',
  byte: '<rect x="3.5" y="7" width="17" height="10" rx="1.5"/><path d="M7.5 10v4M10.5 10v4M13.5 10v4M16.5 10v4"/>',
  usb: '<path d="M12 3v14"/><path d="m9.5 5.5 2.5-2.5 2.5 2.5"/><path d="M12 13 8 10.5V8.5M12 15l4-2.5V10.5"/><rect x="6.5" y="7" width="3" height="2" rx=".4"/><circle cx="16" cy="9.5" r="1.1"/><circle cx="12" cy="19" r="2"/>',
  ruler: '<path d="M3.5 15.5 15.5 3.5l5 5-12 12z"/><path d="m7 12 2 2M10 9l1.5 1.5M13 6l2 2"/>',
  beam: '<path d="M4 5v14M20 5v14M8 5v6M8 13v6M12 5v6M12 13v6M16 5v6M16 13v6"/><path d="M4 12h16" stroke-dasharray="1.6 2.2"/>',
  mux: '<path d="M8 4.5 16 8v8l-8 3.5z"/><path d="M3 7h5M3 10h5M3 14h5M3 17h5M16 12h5"/>',
  shift: '<rect x="3" y="8" width="4.5" height="8" rx="1"/><rect x="9.75" y="8" width="4.5" height="8" rx="1"/><rect x="16.5" y="8" width="4.5" height="8" rx="1"/><path d="M5.25 5h13.5m-2-2 2 2-2 2"/>',
  flash: '<path d="M5 4h14v10H5z"/><path d="M9 20h6M12 14v6"/><path d="m11 6.5-2 4h3l-1 3"/>',
  heat: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/><rect x="9.2" y="9.2" width="5.6" height="5.6" class="f"/>',
  tools: '<path d="M14.5 6.5a3.5 3.5 0 0 0 4.6 4.6l-8.4 8.4a2.1 2.1 0 0 1-3-3l8.4-8.4a3.5 3.5 0 0 0-1.6-1.6z"/><path d="m4 4 3 3m-1.5 1.5L4 7"/>',
  book: '<path d="M12 6.5C10 5 7 4.5 3.5 4.7v13.6c3.5-.2 6.5.3 8.5 1.8 2-1.5 5-2 8.5-1.8V4.7C17 4.5 14 5 12 6.5zM12 6.5v13.6"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/>',
  glossary: '<path d="M6 3.5h11a1.5 1.5 0 0 1 1.5 1.5v15.5H7.5A2 2 0 0 1 5.5 18.5V4"/><path d="M5.5 18.5a2 2 0 0 1 2-2h11"/><path d="M9 8h6M9 11h4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".9" class="f"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" class="f"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.6"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  reset: '<path d="M4.5 10.5A8 8 0 1 1 6 17"/><path d="M4 5v5.8h5.8"/>',
  chevron: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
  photo: '<rect x="3.5" y="5" width="17" height="14" rx="1.6"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4"/>',
  // part icons (figures' parts.mjs): connector, PCB, resistor, gauge, film sheet, gold contacts
  plug: '<path d="M8.5 3.5v4M15.5 3.5v4"/><path d="M6 7.5h12v3a6 6 0 0 1-12 0z"/><path d="M12 16.5v4"/>',
  board: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.6"/><rect x="9" y="9.5" width="6" height="5" rx=".6"/><path d="M6.5 8.5h.01M17.5 15.5h.01M12 5.5v4M15 12h5.5"/>',
  resistor: '<path d="M3 12h3.5l1.5-3.5 2.5 7 2.5-7 2.5 7 1.5-3.5H21"/>',
  gauge: '<path d="M4.2 16.5a8.5 8.5 0 1 1 15.6 0"/><path d="m12 13.5 4-4.5"/><circle cx="12" cy="13.8" r="1.5" class="f"/><path d="M7 16.5h10"/>',
  film: '<path d="m3.5 9 8.5-4.5L20.5 9 12 13.5z"/><path d="M3.5 9v3.2L12 16.7l8.5-4.5V9"/><path d="m8 7.3 8.5 4.4" stroke-dasharray="1.5 2"/>',
  gold: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M7.5 8v8M10.5 8v8M13.5 8v8M16.5 8v8"/>',
  close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.5"/>',
  // Section 2 and 3 (and Fig 5's part icons): a fin finger, tape, a motor, a rail, a holder; a mouse, a spring, a
  // lattice of points, a loop, a bar chart, a robot arm, a "coming soon" clock-dot
  finger: '<path d="M8 3.5h5.5L19 20.5h-4.5L8 6.5z"/><path d="M10.2 8.5h3.6M11.4 12h3.8M12.6 15.5h4"/>',
  tape: '<circle cx="9.5" cy="10.5" r="6"/><circle cx="9.5" cy="10.5" r="2.4"/><path d="M15.5 10.5V18H21"/>',
  motor: '<rect x="5" y="7" width="12" height="12" rx="2"/><path d="M17 11h3v4h-3M11 7V4M8.5 4h5"/><circle cx="11" cy="13" r="2.2"/>',
  rail: '<path d="M3 15.5h18M3 18.5h18"/><rect x="6" y="9" width="5" height="6.5" rx="1"/><rect x="13" y="9" width="5" height="6.5" rx="1"/>',
  holder: '<path d="M5 4.5h14v5l-3 3H8l-3-3z"/><path d="M9 12.5v7M15 12.5v7"/><circle cx="9" cy="7" r=".9" class="f"/><circle cx="15" cy="7" r=".9" class="f"/>',
  mouse: '<rect x="6.5" y="3.5" width="11" height="17" rx="5.5"/><path d="M12 3.5v6M6.5 9.5h11"/>',
  spring: '<path d="M12 2.5v3l-4.5 1.5 9 2.5-9 2.5 9 2.5-9 2.5 4.5 1.5v3"/><path d="M7 21.5h10"/>',
  points: '<circle cx="5" cy="7" r="1.3" class="f"/><circle cx="12" cy="7" r="1.3" class="f"/><circle cx="19" cy="7" r="1.3" class="f"/><circle cx="5" cy="12" r="1.3" class="f"/><circle cx="12" cy="12" r="2.6"/><circle cx="19" cy="12" r="1.3" class="f"/><circle cx="5" cy="17" r="1.3" class="f"/><circle cx="12" cy="17" r="1.3" class="f"/><circle cx="19" cy="17" r="1.3" class="f"/>',
  loop: '<path d="M7.5 7.5A6.5 6.5 0 0 1 18.4 10"/><path d="M16.5 16.5A6.5 6.5 0 0 1 5.6 14"/><path d="m18.8 6.2-.4 3.8-3.8-.4M5.2 17.8l.4-3.8 3.8.4"/>',
  chart: '<path d="M4 4v16h16"/><rect x="7" y="12" width="3" height="5" rx=".5"/><rect x="12" y="8" width="3" height="9" rx=".5"/><rect x="17" y="5" width="3" height="12" rx=".5"/>',
  robot: '<path d="M4.5 20.5h8"/><path d="M8.5 20.5v-4l3-6 6-2.5"/><circle cx="11.5" cy="10.5" r="1.6"/><path d="m17.5 8 1.5-3M17.5 8l2.8 1.6"/>',
  soon: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.4 2.6"/><path d="M12 7.5V12l3 2"/>',
  // the language switch (sidebar, above Theme)
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M4.8 7.6h14.4M4.8 16.4h14.4"/><path d="M12 3.5c-2.4 2.3-3.6 5.1-3.6 8.5s1.2 6.2 3.6 8.5c2.4-2.3 3.6-5.1 3.6-8.5S14.4 5.8 12 3.5z"/>',
};

export function icon(id: IconId, cls = ""): string {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[id]}</svg>`;
}

/** Icon for a figure part's `icon` name; unknown names fall back to the info icon. */
export function partIcon(name: string, cls = ""): string {
  return icon((name in P ? name : "info") as IconId, cls);
}

/** The site mark: two drive lines crossing three sense lines, one lit crossing. */
export const LOGO = `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  <rect x="2.5" y="2.5" width="35" height="35" rx="7" class="logo-plate"/>
  <path d="M13 9v22M20 9v22M27 9v22" class="logo-sense"/>
  <path d="M9 15.5h22M9 24.5h22" class="logo-drive"/>
  <circle cx="20" cy="24.5" r="3.4" class="logo-dot"/>
</svg>`;
