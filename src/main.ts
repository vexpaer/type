import './style.css';
import './atelier.css';
import { icon, mountIcons } from './icons';
import { loadStore, newDraft, persistStore, type Draft } from './storage';
import { getStats, safeFilename } from './stats.js';
import { TypingAudio } from './audio';
import type { Typewriter, CaretLayout } from './typewriter';
import { IMPACT_MS } from './mechanics.js';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const editor = $<HTMLTextAreaElement>('editor');
const title = $<HTMLInputElement>('page-title');
const themePicker = $('theme-picker'), menu = $('options-menu'), drawer = $('drafts-drawer');
const themeButton = $('theme-button'), moreButton = $('more-button'), draftsButton = $('drafts-button');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const loaded = loadStore();
let store = loaded.store;
let machine: Typewriter | null = null;
let machineLoading: Promise<void> | null = null;
let saveTimer = 0, writingTimer = 0, toastTimer = 0;
let composing = false, focused = false;
let pendingDelete: string | null = null;
let deleteTimer = 0;
let switching = false;
let shiftLatched = false, capsLatched = false;
let compositionFeedback = 0;
const audio = new TypingAudio();
audio.enabled = store.sound;

mountIcons();
function active(): Draft { return store.drafts.find(d => d.id === store.activeId)!; }
function toast(message: string) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible');
  toastTimer = window.setTimeout(() => $('toast').classList.remove('visible'), 3000);
}
function save() {
  clearTimeout(saveTimer);
  const success = persistStore(store);
  $('save-status').classList.toggle('unsaved', !success);
  $('save-status').innerHTML = `${icon(success ? 'check' : 'device')}<span>${success ? 'Saved on this device' : 'Not saved · download a copy'}</span>`;
  return success;
}
function capture() {
  if(active().title !== title.value || active().text !== editor.value) { active().title = title.value; active().text = editor.value; active().updated = Date.now(); }
  document.title = `${title.value.trim() || 'Untitled'} — type.`;
}
function scheduleSave() {
  capture(); clearTimeout(saveTimer);
  $('save-status').innerHTML = '<span>Saving…</span>';
  saveTimer = window.setTimeout(save, 300);
}
function updateStats() {
  const stats = getStats(editor.value);
  $('word-count').textContent = `${stats.words.toLocaleString()} ${stats.words === 1 ? 'word' : 'words'}`;
  $('character-count').textContent = `${stats.characters.toLocaleString()} ${stats.characters === 1 ? 'character' : 'characters'}`;
  $('reading-time').textContent = `${stats.reading} min read`;
}
function resizeEditor(followCaret = false) {
  const pageInner = document.querySelector<HTMLElement>('.page-inner')!;
  const previousScroll = pageInner.scrollTop;
  editor.style.height = 'auto'; editor.style.height = `${Math.max(editor.scrollHeight, store.theme === 'atelier' ? 140 : 280)}px`;
  pageInner.scrollTop = previousScroll;
  if (followCaret) requestAnimationFrame(keepCaretVisible);
}
function measureCaret() {
  // Native wrapping, CJK width and text size all contribute to the visual column.
  const mirror = document.createElement('div');
  const computed = getComputedStyle(editor);
  for (const property of ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'padding', 'border', 'box-sizing', 'tab-size', 'word-spacing']) mirror.style.setProperty(property, computed.getPropertyValue(property));
  Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: `${editor.clientWidth}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', top: '0', left: '0' });
  mirror.textContent = editor.value.slice(0, editor.selectionStart);
  const marker = document.createElement('span'); marker.textContent = '\u200b'; mirror.append(marker); $('editor-wrap').append(mirror);
  const lineHeight = parseFloat(computed.lineHeight);
  const localTop = marker.offsetTop, localLeft = marker.offsetLeft;
  const caretTop = marker.getBoundingClientRect().top;
  mirror.remove();
  return { caretTop, localTop, lineHeight, layout: { progress: Math.max(0, Math.min(1, localLeft / Math.max(1, editor.clientWidth))), line: Math.round(localTop / lineHeight) } satisfies CaretLayout };
}
function keepCaretVisible() {
  if (document.activeElement !== editor) return;
  const { caretTop, lineHeight } = measureCaret();
  if (store.theme === 'atelier') {
    const scroller = document.querySelector<HTMLElement>('.page-inner')!, rect = scroller.getBoundingClientRect();
    if (caretTop + lineHeight > rect.bottom - 45) scroller.scrollTop += caretTop + lineHeight - rect.bottom + 45;
    else if (caretTop < rect.top + 20) scroller.scrollTop -= rect.top + 20 - caretTop;
  } else {
    if (caretTop + lineHeight > innerHeight - 130) window.scrollBy({ top: caretTop + lineHeight - innerHeight + 130, behavior: 'instant' });
    else if (caretTop < 100) window.scrollBy({ top: caretTop - 100, behavior: 'instant' });
  }
}
function setWriting() {
  document.body.classList.add('is-writing'); clearTimeout(writingTimer);
  writingTimer = window.setTimeout(() => document.body.classList.remove('is-writing'), 1800);
}
function mechanicalFeedback(key: string, returnKey = false) {
  machine?.strike(key, measureCaret().layout, returnKey);
  audio.strike(store.theme === 'atelier', returnKey, store.theme === 'atelier' ? (returnKey ? .09 : IMPACT_MS / 1000) : 0);
}

// A mechanical impression is committed when the slug reaches the ribbon, not when
// the browser receives the key. Native textarea editing remains the source of truth.
type Impression = { value: string; timer: number };
const impressions: Impression[] = [];
let committingImpression = false;
function commitImpression(impression: Impression) {
  clearTimeout(impression.timer);
  const index = impressions.indexOf(impression);
  if (index < 0) return;
  impressions.splice(index, 1);
  committingImpression = true;
  try { insertMachineText(impression.value); }
  finally { committingImpression = false; }
  machine?.syncCaret(measureCaret().layout);
}
function flushImpressions() {
  // A pending character must not land in another draft, selection or input method.
  for (const impression of [...impressions]) commitImpression(impression);
}
function queueImpression(value: string) {
  if (audio.enabled) audio.activate();
  machine?.strike(value, measureCaret().layout);
  audio.strike(true, false, IMPACT_MS / 1000);
  const impression: Impression = { value, timer: 0 };
  impressions.push(impression);
  impression.timer = window.setTimeout(() => commitImpression(impression), IMPACT_MS);
}

function insertMachineText(value: string, from = editor.selectionStart, end = editor.selectionEnd) {
  editor.focus({ preventScroll: true }); editor.setSelectionRange(from, end);
  if (audio.enabled) audio.activate();
  // Keep click-to-type, carriage return, and physical typing in native undo history.
  const inserted = document.execCommand(value === '' ? 'delete' : 'insertText', false, value);
  if (!inserted) {
    editor.setRangeText(value, from, end, 'end');
    editor.dispatchEvent(new InputEvent('input', { inputType: value === '' ? 'deleteContentBackward' : 'insertText', data: value || null, bubbles: true }));
  }
}

// Mesh clicks enter through the same input pipeline as a physical/virtual keyboard.
function typeFromMachine(key: string) {
  if (key === 'enter') { $('return-key').click(); return; }
  if (key === 'shift' || key === 'shift-right') { shiftLatched = !shiftLatched; machine?.strike(key); return; }
  if (key === 'capslock') { capsLatched = !capsLatched; machine?.strike(key); return; }
  const start = editor.selectionStart, end = editor.selectionEnd;
  let value = key, from = start;
  if (key === 'backspace') {
    const previous = [...editor.value.slice(0, start)].at(-1)?.length || 0;
    from = start === end ? Math.max(0, start - previous) : start; value = '';
  } else {
    if (shiftLatched && key.length === 1) {
      const unshifted = '1234567890-;,./', shifted = '!@#$%^&*()_:<>?';
      const index = unshifted.indexOf(key); value = index >= 0 ? shifted[index] : key.toUpperCase();
    } else if (capsLatched) value = key.toUpperCase();
    shiftLatched = false;
  }
  if (value && key !== 'backspace' && start === end && store.theme === 'atelier' && machine && !reducedMotion.matches) {
    editor.focus({ preventScroll: true }); queueImpression(value);
  } else { flushImpressions(); insertMachineText(value, from, end); }
}

function showMachineFallback() {
  machine?.dispose(); machine = null;
  $('machine-stage').hidden = true; $('machine-fallback').hidden = false;
  $('writing-room').classList.remove('has-3d-paper');
  const fallback = $('machine-fallback');
  if (fallback.querySelector('.fallback-keys')) return;
  const keyboard = document.createElement('div'); keyboard.className = 'fallback-keys';
  for (const letters of ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM', ' ']) {
    const row = document.createElement('div'); row.className = 'fallback-row';
    for (const letter of letters) {
      const button = document.createElement('button'); button.className = `fallback-key${letter === ' ' ? ' fallback-space' : ''}`;
      button.textContent = letter; button.setAttribute('aria-label', letter === ' ' ? 'Type a space' : `Type ${letter}`);
      button.addEventListener('pointerdown', event => event.preventDefault());
      button.addEventListener('click', () => typeFromMachine(letter.toLowerCase())); row.append(button);
    }
    keyboard.append(row);
  }
  fallback.append(keyboard);
}
editor.addEventListener('beforeinput', event => {
  if (committingImpression || composing || event.isComposing) return;
  const printable = event.inputType === 'insertText' && event.data && [...event.data].length === 1;
  if (!printable || editor.selectionStart !== editor.selectionEnd) { flushImpressions(); return; }
  if (store.theme !== 'atelier' || !machine || reducedMotion.matches || !event.cancelable) return;
  event.preventDefault(); queueImpression(event.data!);
});
editor.addEventListener('pointerdown', flushImpressions);
editor.addEventListener('compositionstart', () => { flushImpressions(); composing = true; cancelAnimationFrame(compositionFeedback); compositionFeedback = 0; });
editor.addEventListener('compositionend', event => {
  composing = false; scheduleSave(); updateStats(); resizeEditor(true); setWriting();
  // Browsers order the final input/compositionend differently. Coalesce one commit per frame.
  if (event.data) compositionFeedback = requestAnimationFrame(() => { compositionFeedback = 0; mechanicalFeedback('composition'); });
});
editor.addEventListener('input', (event) => {
  const input = event as InputEvent;
  updateStats(); resizeEditor(true); setWriting();
  if (!composing && !input.isComposing) {
    if (committingImpression) machine?.syncCaret(measureCaret().layout);
    else if (!compositionFeedback && input.inputType !== 'insertFromPaste' && input.inputType !== 'insertFromDrop' && input.inputType !== 'historyUndo' && input.inputType !== 'historyRedo') {
      const returning = input.inputType === 'insertLineBreak' || input.data === '\n';
      const key = input.inputType.startsWith('delete') ? 'backspace' : [...(input.data || '')].at(-1) || (returning ? 'enter' : '');
      mechanicalFeedback(key, returning);
    } else if (!compositionFeedback) machine?.syncCaret(measureCaret().layout);
    scheduleSave();
  }
});
editor.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Backspace', 'Delete', 'Enter', 'Tab'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) flushImpressions();
  if (audio.enabled && !composing && !event.ctrlKey && !event.metaKey) audio.activate();
  if (!composing && (event.key === 'Shift' || event.key === 'CapsLock')) machine?.strike(event.key === 'CapsLock' ? 'capslock' : event.location === 2 ? 'shift-right' : 'shift');
});
const syncCaret = () => { if (!composing && store.theme === 'atelier') machine?.syncCaret(measureCaret().layout); };
editor.addEventListener('click', syncCaret);
editor.addEventListener('select', syncCaret);
editor.addEventListener('keyup', event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) syncCaret(); });
title.addEventListener('input', () => { scheduleSave(); setWriting(); });
title.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); editor.focus(); } });

function loadDraft(id: string) {
  flushImpressions();
  store.activeId = id;
  const draft = active(); title.value = draft.title; editor.value = draft.text;
  const date = new Date(draft.created);
  $('page-date').textContent = date.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' });
  document.title = `${draft.title.trim() || 'Untitled'} — type.`;
  updateStats(); resizeEditor();
  if (machine) machine.syncCaret(measureCaret().layout);
  document.querySelector<HTMLElement>('.page-inner')!.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function makePage() {
  capture(); const draft = newDraft(); store.drafts.unshift(draft); loadDraft(draft.id); save(); closeOverlays(); editor.focus(); toast('A fresh page.');
}
function renderDrafts() {
  const list = $('draft-list'); list.replaceChildren();
  const sorted = [...store.drafts].sort((a,b) => b.updated - a.updated);
  for (const draft of sorted) {
    const row = document.createElement('div'); row.className = 'draft-row' + (draft.id === store.activeId ? ' active' : '');
    const open = document.createElement('button'); open.className = 'draft-open';
    const name = document.createElement('strong'); name.textContent = draft.title.trim() || 'Untitled';
    const preview = document.createElement('span'); preview.textContent = draft.text.trim().replace(/\s+/g,' ').slice(0,90) || 'A blank page, waiting for you.';
    const meta = document.createElement('small'); const words = getStats(draft.text).words; meta.textContent = `${words} ${words===1?'word':'words'} · ${new Date(draft.updated).toLocaleDateString('en',{ month:'short',day:'numeric' })}`;
    open.append(name,preview,meta);
    if (draft.id === store.activeId) open.setAttribute('aria-current','page');
    open.addEventListener('click', () => { capture(); loadDraft(draft.id); save(); closeOverlays(); editor.focus(); });
    const remove = document.createElement('button'); remove.className = 'draft-delete'; remove.innerHTML = icon('trash'); remove.setAttribute('aria-label',`Delete ${draft.title.trim() || 'untitled page'}`);
    remove.addEventListener('click', () => {
      if (pendingDelete !== draft.id) {
        pendingDelete = draft.id; remove.textContent = 'Delete?'; remove.classList.add('confirm'); clearTimeout(deleteTimer);
        deleteTimer = window.setTimeout(() => { pendingDelete = null; renderDrafts(); }, 3500); return;
      }
      clearTimeout(deleteTimer); pendingDelete = null;
      store.drafts = store.drafts.filter(d => d.id !== draft.id);
      if (!store.drafts.length) store.drafts.push(newDraft());
      if (store.activeId === draft.id) loadDraft(store.drafts[0].id);
      save(); renderDrafts(); $('drawer-new-page').focus(); toast('Page deleted.');
    });
    row.append(open,remove); list.append(row);
  }
}
function closeOverlays(restoreFocus = false) {
  const origin = !drawer.hidden ? draftsButton : !themePicker.hidden ? themeButton : !menu.hidden ? moreButton : null;
  themePicker.hidden = true; menu.hidden = true; drawer.hidden = true; $('drawer-shade').hidden = true;
  themeButton.setAttribute('aria-expanded','false'); moreButton.setAttribute('aria-expanded','false'); draftsButton.setAttribute('aria-expanded','false');
  document.body.style.overflow = '';
  $('writing-room').inert = false;
  document.querySelector<HTMLElement>('.topbar')!.inert = false;
  document.querySelector<HTMLElement>('.bottom-bar')!.inert = false;
  if (restoreFocus) origin?.focus();
}
themeButton.addEventListener('click', () => { const wasOpen = !themePicker.hidden; closeOverlays(); if (!wasOpen) { themePicker.hidden = false; themeButton.setAttribute('aria-expanded','true'); themePicker.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.focus(); } });
moreButton.addEventListener('click', () => { const wasOpen = !menu.hidden; closeOverlays(); if (!wasOpen) { menu.hidden = false; moreButton.setAttribute('aria-expanded','true'); menu.querySelector<HTMLButtonElement>('button')?.focus(); } });
draftsButton.addEventListener('click', () => {
  capture();save();closeOverlays();renderDrafts();drawer.hidden=false;$('drawer-shade').hidden=false;draftsButton.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';
  $('writing-room').inert=true;document.querySelector<HTMLElement>('.topbar')!.inert=true;document.querySelector<HTMLElement>('.bottom-bar')!.inert=true;
  $('close-drafts').focus();
});
$('close-themes').addEventListener('click', () => closeOverlays(true));
$('close-drafts').addEventListener('click', () => closeOverlays(true));
$('drawer-shade').addEventListener('click', () => closeOverlays(true));
document.addEventListener('pointerdown', event => { const node = event.target as Node; if (!themePicker.hidden && !themePicker.contains(node) && !themeButton.contains(node)) closeOverlays(); if (!menu.hidden && !menu.contains(node) && !moreButton.contains(node)) closeOverlays(); });

function syncThemeUI() {
  const retro = store.theme === 'atelier'; document.documentElement.dataset.theme = store.theme;
  $('theme-label').textContent = retro ? 'The writer’s atelier' : 'The quiet room';
  $('room-name').textContent = retro ? 'The writer’s atelier' : 'The quiet room';
  $('room-description').textContent = retro ? 'Every word leaves a mark.' : 'A little space to think.';
  $('footer-note').textContent = retro ? 'One keystroke at a time.' : 'No rush. Just write.';
  document.querySelector('meta[name=theme-color]')!.setAttribute('content', retro ? '#302a24' : '#fafafa');
  document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === store.theme)));
  machine?.setActive(retro);
  resizeEditor();
  if (retro) requestAnimationFrame(syncCaret);
}
async function ensureMachine() {
  if (machine || machineLoading) return machineLoading;
  machineLoading = (async () => {
    try {
      const { Typewriter } = await import('./typewriter');
      machine = new Typewriter($('machine-stage'), showMachineFallback, typeFromMachine, () => audio.bell());
      machine.setActive(store.theme === 'atelier');
    } catch (error) {
      console.warn('The 3D renderer is unavailable. The writing page remains usable.', error);
      showMachineFallback();
    }
  })();
  return machineLoading;
}
async function changeTheme(theme: 'quiet' | 'atelier') {
  if (switching || theme === store.theme) { closeOverlays(true); return; }
  switching = true;
  flushImpressions(); capture();save();
  const selection = { start:editor.selectionStart, end:editor.selectionEnd };
  closeOverlays();
  if (theme === 'atelier') await ensureMachine();
  const update = () => { store.theme=theme; syncThemeUI(); save(); };
  try {
    if (document.startViewTransition && !reducedMotion.matches) {
      const transition = document.startViewTransition(update); await transition.finished;
    } else update();
  } finally { switching=false; }
  editor.setSelectionRange(selection.start,selection.end); editor.focus({preventScroll:true}); resizeEditor(true);
}
document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach(button => button.addEventListener('click', () => void changeTheme(button.dataset.themeChoice as 'quiet'|'atelier')));

function setFocus(value: boolean) {
  focused=value;document.body.classList.toggle('focus-mode',value);
  $('focus-button').setAttribute('aria-pressed',String(value));$('focus-button').setAttribute('aria-label',value?'Leave focus mode':'Enter focus mode');
  // Hidden controls must leave the keyboard focus order as well as the screen.
  document.querySelector<HTMLElement>('.topbar')!.inert=value;
  document.querySelector<HTMLElement>('.bottom-bar')!.inert=value;
  closeOverlays();
  document.querySelector<HTMLElement>('.topbar')!.inert=value;
  document.querySelector<HTMLElement>('.bottom-bar')!.inert=value;
  editor.focus({preventScroll:true});
}
$('focus-button').addEventListener('click', () => setFocus(!focused));
$('leave-focus').addEventListener('click', () => setFocus(false));
$('home-button').addEventListener('click', () => editor.focus());
function syncSound() {
  $('sound-button').innerHTML=icon(store.sound?'soundOn':'soundOff');
  $('sound-button').setAttribute('aria-pressed',String(store.sound));
  $('sound-button').setAttribute('aria-label',`Turn typing sounds ${store.sound?'off':'on'}`);
  $('sound-button').dataset.tooltip=store.sound?'Sound on':'Sound off';
}
$('sound-button').addEventListener('click', () => {
  store.sound=!store.sound;audio.enabled=store.sound;
  if(store.sound){audio.activate();audio.strike(store.theme==='atelier');}
  syncSound();save();
});
$('new-page').addEventListener('click',makePage);$('drawer-new-page').addEventListener('click',makePage);
function download() {
  capture();save();const draft=active();
  const content=(draft.title.trim()?draft.title.trim()+'\n\n':'')+draft.text;
  const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=safeFilename(draft.title);link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);closeOverlays();toast('Your page, to keep.');
}
$('export-page').addEventListener('click',download);
$('copy-page').addEventListener('click',async()=> {
  const content=(title.value.trim()?title.value.trim()+'\n\n':'')+editor.value;
  try { await navigator.clipboard.writeText(content); closeOverlays();toast('Copied to clipboard.'); }
  catch { closeOverlays();editor.focus();editor.select();toast('Text selected. Press ⌘ / Ctrl C to copy.'); }
});
$('import-page').addEventListener('click',()=> {closeOverlays();$<HTMLInputElement>('file-input').click();});
$<HTMLInputElement>('file-input').addEventListener('change',async event=> {
  const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;
  if(file.size>2*1024*1024){toast('Please choose a text file smaller than 2 MB.');input.value='';return;}
  try {
    const text=await file.text();capture();const draft=newDraft();draft.title=file.name.replace(/\.(txt|md)$/i,'');draft.text=text;store.drafts.unshift(draft);loadDraft(draft.id);save();editor.focus();toast('Your page is here.');
  } catch { toast('This file could not be opened. Try another text file.'); }
  input.value='';
});
function setFontSize(delta:number) {
  store.fontSize=Math.max(16,Math.min(30,store.fontSize+delta));applyFontSize();save();
}
function applyFontSize() {
  document.documentElement.style.setProperty('--editor-size',`${store.fontSize}px`);
  $('font-size-label').textContent=String(store.fontSize);
  $<HTMLButtonElement>('font-decrease').disabled=store.fontSize<=16;$<HTMLButtonElement>('font-increase').disabled=store.fontSize>=30;
  resizeEditor();
  if (machine) syncCaret();
}
$('font-decrease').addEventListener('click',()=>setFontSize(-1));$('font-increase').addEventListener('click',()=>setFontSize(1));
$('return-key').addEventListener('click',()=> {
  flushImpressions(); insertMachineText('\n');
});

document.addEventListener('keydown',event=> {
  if(event.isComposing||composing)return;
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();download();return;}
  if(event.altKey&&event.key.toLowerCase()==='f'){event.preventDefault();setFocus(!focused);return;}
  if(event.altKey&&event.key.toLowerCase()==='n'){event.preventDefault();makePage();return;}
  if(event.key==='Escape') {
    if(!themePicker.hidden||!menu.hidden||!drawer.hidden){event.preventDefault();closeOverlays(true);}
    else if(focused)setFocus(false);
    return;
  }
  const overlay=!drawer.hidden?drawer:!themePicker.hidden?themePicker:!menu.hidden?menu:null;
  if(!overlay)return;
  const controls=[...overlay.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const current=controls.indexOf(document.activeElement as HTMLButtonElement);
  if(event.key==='Tab') {
    if(event.shiftKey&&current<=0){event.preventDefault();controls.at(-1)?.focus();}
    else if(!event.shiftKey&&current===controls.length-1){event.preventDefault();controls[0]?.focus();}
  }
  if(event.key==='ArrowDown'||event.key==='ArrowUp') {
    event.preventDefault();controls[(current+(event.key==='ArrowDown'?1:-1)+controls.length)%controls.length]?.focus();
  }
});
let measuredEditorWidth = 0;
new ResizeObserver(([entry]) => {
  if (Math.abs(entry.contentRect.width - measuredEditorWidth) < .5) return;
  measuredEditorWidth = entry.contentRect.width;
  requestAnimationFrame(() => { resizeEditor(true); syncCaret(); });
}).observe(editor);
window.addEventListener('resize',()=>resizeEditor());
window.addEventListener('pagehide',()=>{flushImpressions();capture();save();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){flushImpressions();capture();save();}});
window.addEventListener('storage',event=> {
  if(event.key!=='type-writing-room-v1'||!event.newValue)return;
  // Avoid silently replacing a page while its author is typing in this tab.
  if(document.hasFocus()){toast('Pages changed in another tab. Download your work before reloading.');return;}
  const latest=loadStore();if(!latest.error){store=latest.store;loadDraft(store.activeId);applyFontSize();syncSound();audio.enabled=store.sound;syncThemeUI();if(store.theme==='atelier')void ensureMachine();}
});
loadDraft(store.activeId);applyFontSize();syncSound();syncThemeUI();
if(store.theme==='atelier')void ensureMachine();
void document.fonts.ready.then(()=> { resizeEditor(); syncCaret(); });
if(loaded.error)toast('Saved pages could not be read. Download important writing as a backup.');
// Preserve a touch user's quiet entry: opening the page never summons a mobile keyboard.
if(matchMedia('(pointer:fine)').matches)editor.focus({preventScroll:true});
