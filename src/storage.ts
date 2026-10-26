export interface Draft { id: string; title: string; text: string; created: number; updated: number; }
export interface Store { version: 1; drafts: Draft[]; activeId: string; theme: 'quiet' | 'atelier'; sound: boolean; fontSize: number; }
const KEY = 'type-writing-room-v1';
export function newDraft(): Draft { const now = Date.now(); return { id: (crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('')), title: '', text: '', created: now, updated: now }; }
export function initialStore(): Store { const draft = newDraft(); return { version: 1, drafts: [draft], activeId: draft.id, theme: 'quiet', sound: false, fontSize: 22 }; }
export function loadStore(): { store: Store; error: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { store: initialStore(), error: false };
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.drafts)) throw new Error('Invalid writing data');
    const drafts: Draft[] = parsed.drafts.filter((d: Draft) => d && typeof d.id === 'string' && typeof d.title === 'string' && typeof d.text === 'string' && Number.isFinite(d.created) && Number.isFinite(d.updated));
    if (!drafts.length) throw new Error('No valid drafts');
    return { store: { version: 1, drafts, activeId: drafts.some(d => d.id === parsed.activeId) ? parsed.activeId : drafts[0].id, theme: parsed.theme === 'atelier' ? 'atelier' : 'quiet', sound: parsed.sound === true, fontSize: Math.min(30, Math.max(16, Number(parsed.fontSize) || 22)) }, error: false };
  } catch { return { store: initialStore(), error: true }; }
}
export function persistStore(store: Store): boolean { try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch { return false; } }
