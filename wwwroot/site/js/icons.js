/* ============ 淡绿植物风细线图标 ============ */
const I = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICONS = {
  today: I('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8 14h3M8 17h6"/>'),
  book: I('<path d="M4 5.5c3-1.5 6-1.5 8 0v14c-2-1.5-5-1.5-8 0z"/><path d="M20 5.5c-3-1.5-6-1.5-8 0v14c2-1.5 5-1.5 8 0z"/><path d="M12 5.5v14"/>'),
  code: I('<path d="M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16"/>'),
  school: I('<path d="M3 10 12 4l9 6"/><path d="M5 10v9M19 10v9M3 20h18"/><path d="M9 20v-6h6v6"/>'),
  target: I('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  video: I('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>'),
  wallet: I('<path d="M4 7h14a2 2 0 0 1 2 2v10H6a2 2 0 0 1-2-2z"/><path d="M4 7V5a2 2 0 0 1 2-2h11v4"/><path d="M15 13h5"/><circle cx="15" cy="13" r=".8" fill="currentColor"/>'),
  news: I('<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  inbox: I('<path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 9l2-5h12l2 5"/><path d="M9 13h6"/>'),
  search: I('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>'),
  sparkles: I('<path d="M12 3c.6 4.5 2.5 6.4 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.6 6.4-2.5 7-7z"/><path d="M19 16c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3z"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  more: I('<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>'),
  check: I('<path d="M4 12.5 9 17.5 20 6.5"/>'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  edit: I('<path d="M4 20l4-1 11-11a2 2 0 0 0-3-3L5 16z"/><path d="M14 6l3 3"/>'),
  trash: I('<path d="M4 7h16M7 7l1 13h8l1-13M9 7V4h6v3M10 11v5M14 11v5"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 6 .4l2-2a4 4 0 0 0-5.7-5.7l-1.1 1.1"/><path d="M14 10a4 4 0 0 0-6-.4l-2 2a4 4 0 0 0 5.7 5.7l1.1-1.1"/>'),
  calendar: I('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
  clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>'),
  trend: I('<path d="M4 17l5-6 4 3 7-8"/><path d="M15 6h5v5"/>'),
  help: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1.2-1.5 2.5"/><circle cx="12" cy="17" r=".8" fill="currentColor"/>'),
  download: I('<path d="M12 4v11M8 11l4 4 4-4M4 19h16"/>'),
  upload: I('<path d="M12 16V5M8 9l4-4 4 4M4 19h16"/>'),
  refresh: I('<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>'),
  eye: I('<path d="M2.5 12c3-5 6-7 9.5-7s6.5 2 9.5 7c-3 5-6 7-9.5 7s-6.5-2-9.5-7z"/><circle cx="12" cy="12" r="3"/>'),
  undo: I('<path d="M4 9h9a6 6 0 0 1 0 12H8"/><path d="M8 5 4 9l4 4"/>'),
  star: I('<path d="M12 3l2.8 6 6.2.6-4.7 4.1 1.4 6.1-5.7-3.3-5.7 3.3 1.4-6.1L3 9.6l6.2-.6z"/>'),
  arrow: I('<path d="M4 12h15M14 7l5 5-5 5"/>'),
  tag: I('<path d="M4 5h7l9 9-6 6-9-9z"/><circle cx="8" cy="9" r="1"/>'),
  file: I('<path d="M14 3H6v18h12V7z"/><path d="M14 3v5h5"/>'),
  bilibili: I('<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7 6 3M16 7l2-4M10 11v5l4-2.5z"/>'),
  youtube: I('<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M10 9v6l5-3z"/>'),
  mooc: I('<path d="M5 19V7a3 3 0 0 1 3-3h11v12H8a3 3 0 0 0-3 3z"/><path d="M5 19a3 3 0 0 0 3 3h11v-6"/><path d="M9 9h6M9 12h4"/>')
};

function icon(name, cls = '') {
  return `<span class="icon ${cls}" style="display:inline-flex;align-items:center;justify-content:center">${ICONS[name] || ICONS.help}</span>`;
}
