/**
 * The six projects on display in the Hall of Fame, left to right.
 *
 * NOTE FOR SMT: names and blurbs are placeholders, and every `url` is empty.
 * Fill the urls in and a clickable link appears under the screen whenever a
 * candidate reads that plaque; leave one empty and its plaque simply has no
 * link. Exactly six are shown -- the room has six displays.
 */
export interface Project {
  id: string;
  name: string;
  /** Shown on the plaque. Keep it to a sentence or two. */
  blurb: string;
  /** Repo, demo or write-up. Empty means no link is offered. */
  url: string;
}

export const PROJECTS: Project[] = [
  {
    id: 'registration',
    name: 'REGISTRATION',
    blurb: 'Hundreds of teams sign up through it, every one of them wanting a different thing.',
    url: '',
  },
  {
    id: 'grading',
    name: 'GRADING PIPELINE',
    blurb: 'Tens of thousands of answers, scored and ranked before the closing ceremony.',
    url: '',
  },
  {
    id: 'scoreboard',
    name: 'LIVE SCOREBOARD',
    blurb: 'A thousand people refreshing it at once, on the worst wifi in the building.',
    url: '',
  },
  {
    id: 'scanner',
    name: 'ANSWER SCANNER',
    blurb: 'It reads ten thousand handwritten sheets. It has strong opinions about sevens.',
    url: '',
  },
  {
    id: 'website',
    name: 'THE WEBSITE',
    blurb: 'The part everyone sees, and the part everyone has notes about.',
    url: '',
  },
  {
    id: 'dashboard',
    name: 'TOURNAMENT DASHBOARD',
    blurb: 'Built in a week, used for four hours, worth every hour of it.',
    url: '',
  },
];

export const PROJECT_COUNT = PROJECTS.length;
