/**
 * The six projects on display in the Hall of Fame, left to right.
 *
 * NOTE FOR SMT: names and blurbs are placeholders, and every `url` is empty.
 * Fill the urls in and a clickable link appears under the screen whenever a
 * candidate reads that plaque; leave one empty and its plaque simply has no
 * link. Exactly six are shown -- the room has six displays.
 *
 * Safe to change freely: `id`, `name`, `blurb`, `url`. Nothing looks a
 * project up by literal id, and names are interpolated into dialogue rather
 * than retyped. Changing an id only changes the `project:<id>` telemetry
 * event, so old sheet rows keep the old spelling.
 *
 * NOT safe: the ORDER. Displays map left to right onto this list, and
 * dialogue.ts refers to PROJECTS[0] and PROJECTS[5] as the oldest and the
 * newest. Reorder and those lines start describing different projects --
 * silently, since they still compile.
 */
export interface Project {
  id: string;
  name: string;
  /** Shown on the plaque. Keep it to a sentence or two. */
  blurb: string;
  /**
   * Repo, demo or write-up. Empty means no link is offered.
   *
   * A bare domain is fine -- "comp.mt" works. The scheme is added before the
   * href is built, because without one the browser treats it as a path and
   * navigates to /comp.mt on the gym's own origin instead of leaving.
   */
  url: string;
}

export const PROJECTS: Project[] = [
  {
    id: 'registration',
    name: 'COMP',
    blurb: 'Hundreds of teams sign up through it, every one of them wanting a different thing or being very dumb when using it.  It supports both our in-person and online competition and also is where students take their test.',
    url: 'comp.mt',
  },
  {
    id: 'puzzlehunt',
    name: 'ONLINE PUZZLE HUNT',
    blurb: 'Our online puzzle hunt from last year.  Made by the goat Arpit, even when he is a year graduated, just for the love of the game.',
    url: 'puzzles.stanfordmathtournament.org',
  },
  {
    id: 'scoreboard',
    name: 'COMPOSE',
    blurb: 'How do our problem writers organize their problems, make sure they are the highest quality, move them around in tests, or ',
    url: '',
  },
  {
    id: 'scanner',
    name: 'VOLUNTOLD',
    blurb: 'It reads ten thousand handwritten sheets. It has strong opinions about sevens.',
    url: '',
  },
  {
    id: 'website',
    name: 'THE WEBSITE',
    blurb: 'The part everyone sees, and the part everyone has notes about.',
    url: 'stanfordmathtournament.org',
  },
  {
    id: 'dashboard',
    name: 'MOBILE APP',
    blurb: 'Built in a day by Anish.',
    url: 'app.stanfordmathtournament.org',
  },
];

export const PROJECT_COUNT = PROJECTS.length;
