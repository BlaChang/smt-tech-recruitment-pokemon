// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { externalUrl } from '../app/externalUrl';
import { MORE_INFO } from '../content/links';
import { PROJECTS } from '../content/projects';

describe('leaving the site', () => {
  it('adds a scheme to a bare domain', () => {
    // Without this the href is relative and lands on the gym's own origin.
    expect(externalUrl('comp.mt')).toBe('https://comp.mt');
    expect(externalUrl('puzzles.stanfordmathtournament.org')).toBe(
      'https://puzzles.stanfordmathtournament.org',
    );
    expect(externalUrl('example.com/a/b?c=d')).toBe('https://example.com/a/b?c=d');
  });

  it('leaves an absolute url alone, whatever its scheme', () => {
    expect(externalUrl('https://a.com/x')).toBe('https://a.com/x');
    expect(externalUrl('http://a.com')).toBe('http://a.com');
    expect(externalUrl('mailto:smt@stanford.edu')).toBe('mailto:smt@stanford.edu');
  });

  it('handles protocol-relative and same-site paths', () => {
    expect(externalUrl('//a.com/x')).toBe('https://a.com/x');
    expect(externalUrl('/local/page')).toBe('/local/page');
  });

  it('treats blank and whitespace as no link at all', () => {
    expect(externalUrl('')).toBe('');
    expect(externalUrl('   ')).toBe('');
  });

  it('resolves every project link off this origin', () => {
    // The actual bug: resolve each href the way a browser would and check it
    // does not end up somewhere on the gym's own host.
    const here = new URL('http://gym.example/play');
    for (const project of PROJECTS) {
      if (!project.url) continue;
      const resolved = new URL(externalUrl(project.url), here);
      expect(resolved.host, `${project.id} points back at the gym`).not.toBe(here.host);
    }
  });

  it('would have sent the bare ones to a route on this site', () => {
    // Guards the diagnosis: a bare domain used as-is really does resolve to
    // a path, so this test fails if that ever stops being true.
    const here = new URL('http://gym.example/play');
    expect(new URL('comp.mt', here).href).toBe('http://gym.example/comp.mt');
  });

  it('keeps the more-information link absolute', () => {
    expect(externalUrl(MORE_INFO.url)).toBe(MORE_INFO.url);
    expect(new URL(externalUrl(MORE_INFO.url)).host).toBe('docs.google.com');
  });
});
