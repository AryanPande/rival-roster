const shapes={
  library:'<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v12M7 13h6m-6 3h4"/>',
  mute:'<path d="M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/>',
  sound:'<path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m2-15a3 3 0 0 1 0 6m1 3a4 4 0 0 1 3 4v2"/>',
  swords:'<path d="m3 3 5 1 11 12-3 3L4 8 3 3Zm12 15 4-4m-1 5 2 2 1-1-2-2M21 3l-5 1-4 5M9 13l-4 4m-1-3 5 5m-4-1-2 2 1 1 2-2"/>',
  hammer:'<path d="m10 5 3-3 7 7-3 3m-7-7 7 7m-7-7L7 8l7 7 3-3M11 12l-7 7a1.5 1.5 0 0 0 2 2l7-7m2 7h7"/>',
  link:'<path d="M10 13a4 4 0 0 0 6 .4l4-4a4 4 0 0 0-5.6-5.6L12 6m2 5a4 4 0 0 0-6-.4l-4 4a4 4 0 0 0 5.6 5.6L12 18"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>', check:'<path d="m4 12 5 5L20 6"/>',
  bolt:'<path d="m14 2-9 12h6l-1 8 9-12h-6l1-8Z"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 11 6-4m-6 6 6 4"/>',
  trophy:'<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v2a5 5 0 0 0 4 5m10-7h4v2a5 5 0 0 1-4 5m-5 3v5m-4 1h8"/>',
};
export const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${shapes[name]||''}</svg>`;
