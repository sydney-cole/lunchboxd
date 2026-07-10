-- Custom SQL migration file, put your code below! --

-- Canonicalize existing tag labels so "&" === "and" (and case/whitespace) match the
-- normalizeTagLabel() form used on write. Keep this in sync with that TS function.
UPDATE "review_tags"
SET "label" = btrim(regexp_replace(replace(lower("label"), '&', 'and'), '\s+', ' ', 'g'));