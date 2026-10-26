const paths: Record<string, string> = {
  sheets: '<path d="M8 4H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3"/><rect x="8" y="2" width="12" height="13" rx="1.5"/><path d="M11 6h6M11 9h4"/>',
  check: '<path d="m5 11 4 4L19 5"/>',
  soundOff: '<path d="m10 4-5 4H2v6h3l5 4V4ZM15 8l5 6M20 8l-5 6"/>',
  soundOn: '<path d="m10 4-5 4H2v6h3l5 4V4ZM14 7a6 6 0 0 1 0 8M17 4a10 10 0 0 1 0 14"/>',
  focus: '<path d="M8 3H3v5M14 3h5v5M19 14v5h-5M8 19H3v-5"/>',
  expand: '<path d="M3 8h5V3M19 8h-5V3M14 19v-5h5M8 19v-5H3"/>',
  more: '<circle cx="4" cy="11" r="1" fill="currentColor"/><circle cx="11" cy="11" r="1" fill="currentColor"/><circle cx="18" cy="11" r="1" fill="currentColor"/>',
  chevron: '<path d="m7 13 4-4 4 4"/>',
  plus: '<path d="M11 4v14M4 11h14"/>',
  close: '<path d="m5 5 12 12M17 5 5 17"/>',
  download: '<path d="M11 3v11m-5-5 5 5 5-5M4 15v4h14v-4"/>',
  upload: '<path d="M11 15V4m-5 5 5-5 5 5M4 15v4h14v-4"/>',
  copy: '<rect x="8" y="7" width="11" height="13" rx="1.5"/><path d="M14 4V2H3v13h2"/>',
  return: '<path d="M18 4v7H4m5-5-5 5 5 5"/>',
  device: '<rect x="3" y="3" width="16" height="12" rx="1.5"/><path d="M11 15v4M7 19h8"/>',
  trash: '<path d="M3 6h16M8 6V3h6v3M5 6l1 13h10l1-13M9 9v7M13 9v7"/>',
};
export function icon(name: string) { return `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.more}</svg>`; }
export function mountIcons(root: ParentNode = document) { root.querySelectorAll<HTMLElement>('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon!)); }
