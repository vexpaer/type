/** Count CJK characters as words and other language segments as words. */
export function getStats(text) {
  const segments = new Intl.Segmenter(undefined, { granularity: 'word' });
  let words = 0;
  for (const segment of segments.segment(text)) if (segment.isWordLike) words++;
  const characters = [...text].length;
  return { words, characters, reading: words ? Math.max(1, Math.ceil(words / 220)) : 0 };
}
export function safeFilename(title) {
  return (title.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 100) || 'Untitled') + '.txt';
}
