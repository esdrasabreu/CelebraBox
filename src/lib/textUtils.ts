// Utility to sanitize and fix text with stylized Unicode characters (e.g., from Instagram/fancy font generators)
// which cause accented letters and cedillas ('ç', 'ã', 'á', 'é', 'ê', 'À', etc.) to display as broken symbols or detached marks.

const FANCY_CHAR_MAP: Record<string, string> = {
  // Tai Le & pseudo-cursive letters commonly used by fancy font generators
  'ᥲ': 'a', 'b': 'b', 'ᥴ': 'c', 'd': 'd', 'ᥱ': 'e', 'f': 'f', 'g': 'g', 'h': 'h',
  'ι': 'i', 'j': 'j', 'k': 'k', 'ᥣ': 'l', '꧑': 'm', 'ᥒ': 'n', '᥆': 'o', 'ρ': 'p',
  'q': 'q', 'r': 'r', '᥉': 's', 't': 't', 'ᥙ': 'u', '᥎': 'v', 'w': 'w', '᥊': 'x',
  'y': 'y', 'z': 'z',
  // Cyrillic lookalikes
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x'
};

/**
 * Sanitizes and normalizes text, restoring standard accented letters and cedillas
 * without symbols or detached diacritical marks.
 */
export function cleanStoryText(str: string): string {
  if (!str) return '';

  // 1. Fix 'undefined́' or 'undefined' artifacts produced by online text converters for capital accented 'É'
  let text = str.replace(/\bundefined[\u0300-\u036f]?\b/gi, 'É');
  text = text.replace(/undefined[\u0300-\u036f]?/gi, 'É');

  // 2. Decompose compatibility characters (e.g. Mathematical Monospace, Fullwidth Latin, Script)
  text = text.normalize('NFKD');

  // 3. Map foreign script lookalike symbols back to standard Latin characters
  let mapped = '';
  for (const ch of text) {
    mapped += FANCY_CHAR_MAP[ch] !== undefined ? FANCY_CHAR_MAP[ch] : ch;
  }

  // 4. Recompose standard Brazilian Portuguese accented letters (ç, ã, á, é, ê, etc.) into precomposed NFC unicode
  let result = mapped.normalize('NFC');

  // 5. Clean up any remaining orphaned or illegal combining marks not attached to letters
  result = result.replace(/[\u0300-\u036f]/g, (match, offset, fullStr) => {
    // If preceded by a whitespace or punctuation, remove the orphaned accent
    if (offset === 0 || /\s|[.,;:!?\-]/.test(fullStr[offset - 1])) {
      return '';
    }
    return match;
  });

  return result;
}
