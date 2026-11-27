// Vikipedi `exsectionformat=wiki` düz metnini bölümlere ayırır (saf, ağ yok).

/** Seriye girmeyen bölümler (normalize, küçük harf). */
export const EXCLUDED_SECTIONS = [
  'kaynakça',
  'kaynaklar',
  'notlar',
  'dipnotlar',
  'dış bağlantılar',
  'ayrıca bakınız',
  'ileri okuma',
  'bibliyografya',
  'galeri',
];

const HEADING_RE = /^(={2,})\s*(.+?)\s*\1\s*$/;

const normalizeHeading = (h) => String(h).trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');

const normalizeText = (t) => t.replace(/\s+/g, ' ').trim();

/**
 * `== Başlık ==` / `=== Alt ===` işaretli metni bölümlere ayırır.
 * İlk bölümün başlığı `title`; boş bölümler atılır. `level`: giriş 1, `==` 2, `===` 3…
 * @returns {Array<{ heading: string, text: string, level: number }>}
 */
export function parseWikiExtract(text, title) {
  const sections = [];
  let current = { heading: title, level: 1, lines: [] };
  const flush = () => {
    const body = normalizeText(current.lines.join(' '));
    if (body) sections.push({ heading: current.heading, text: body, level: current.level });
  };
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = HEADING_RE.exec(line.trim());
    if (m) {
      flush();
      current = { heading: m[2].trim(), level: m[1].length, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * Hariç bölümleri (ve alt bölümlerini) atar; `wanted` listesi varsa yalnız o başlıklar ve alt bölümleri kalır.
 * `null` = hepsi (hariçler hariç).
 */
export function filterSections(sections, wanted = null) {
  const wantedSet = wanted ? new Set(wanted.map(normalizeHeading)) : null;
  const excluded = new Set(EXCLUDED_SECTIONS);
  let excludeLevel = null;
  let wantLevel = null;
  const out = [];
  for (const s of sections) {
    const level = s.level ?? 2;
    if (excludeLevel !== null && level <= excludeLevel) excludeLevel = null;
    if (wantLevel !== null && level <= wantLevel) wantLevel = null;
    const key = normalizeHeading(s.heading);
    if (excludeLevel === null && excluded.has(key)) excludeLevel = level;
    if (wantedSet && wantLevel === null && wantedSet.has(key)) wantLevel = level;
    if (excludeLevel !== null) continue;
    if (wantedSet && wantLevel === null) continue;
    out.push(s);
  }
  return out;
}
