/**
 * Canonical tag normalization — shared by web + mobile so a tag is matched and
 * stored the same way everywhere.
 *
 * Rules:
 *  - case-insensitive (lowercased)
 *  - "&" is treated the same as "and"
 *  - internal whitespace collapsed, ends trimmed
 *
 * Keep this in sync with the SQL form used for backfills:
 *   btrim(regexp_replace(replace(lower(label), '&', 'and'), '\s+', ' ', 'g'))
 */
export function normalizeTagLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim()
}
