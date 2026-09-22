/**
 * Outward links. Kept here with the rest of the copy rather than inline in
 * the form, so a URL going stale is a content edit and not a code change.
 *
 * NOTE FOR SMT: as of 2026-09-21 the info doc below answers 401 to anyone
 * not signed in with access -- link sharing is off. A candidate who clicks
 * it lands on "You need access" at the exact moment they were deciding
 * whether to apply. Open the doc, Share, and set "Anyone with the link" to
 * Viewer before the QR code goes out.
 */

/** Everything a candidate might want to read before signing. */
export const MORE_INFO = {
  url: 'https://docs.google.com/document/d/1fJdDlT7NVzM0QtSuZcBW1Icw1ni1HijtMYf0BQgcqtw/edit?usp=sharing',
  label: 'More about SMT tech',
} as const;
