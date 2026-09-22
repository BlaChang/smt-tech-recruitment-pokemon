/**
 * Turns a link as somebody typed it into one that actually leaves the site.
 *
 * A href with no scheme is a *relative* URL: "comp.mt" resolves against the
 * current page and navigates to /comp.mt on the gym's own origin rather than
 * to comp.mt. Content authors write bare domains because that is what a
 * domain looks like, so the scheme is added here instead of being demanded
 * of them.
 */
export function externalUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  // Already absolute, whatever the scheme: http, https, mailto.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  // Protocol-relative: it is already leaving, it just needs a scheme.
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  // A leading slash is a deliberate path on this site; leave it be.
  if (trimmed.startsWith('/')) return trimmed;
  return `https://${trimmed}`;
}
