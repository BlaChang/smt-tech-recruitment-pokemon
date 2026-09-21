import type { Script } from './script';
import { STARTERS } from '../battle/teams';

/** Name plate on his dialogue. Kept short; the full name is in his intro. */
const PROF = 'PROF. SYMMETREE';

/**
 * Professor SymmeTREE's opening. This is the first thing a candidate reads, so
 * it carries the pitch: what SMT is, and that the people here are having fun.
 */
/** Re-offers the choice for someone who wants to look at all three first. */
const PICK_AGAIN: Script = [
  { say: 'Take your time. They are all patient. Mostly.', as: PROF },
  {
    choice: STARTERS.map((s) => s.name),
    branch: STARTERS.map((s) => [
      { run: (ctx) => { ctx.state.starter = s.id; } },
      { setFlag: 'starter:chosen' },
      { track: `starter:${s.id}` },
      { say: s.blurb ?? '', as: PROF },
      { say: `${s.name} it is! A ${s.type} type. Off you go, {name}.`, as: PROF },
    ] as Script),
  },
];

export const INTRO: Script = [
  { say: 'Hello there! Welcome to the world of SMT!', as: PROF },
  {
    say: 'My name is PROFESSOR JUSTIN SYMMETREE. Around here, everyone just calls me the PROFESSOR.',
    as: PROF,
  },
  {
    say: 'Every spring, a thousand high schoolers come to Stanford and do mathematics for an entire day.',
    as: PROF,
  },
  {
    say: 'The problems, the schedule, the grading, the scoreboard, the whole tournament — students build every piece of it. Students like the ones through that door.',
    as: PROF,
  },
  { say: 'But enough about me! Tell me — what should I call you?', as: PROF },
  { askName: true },
  { say: 'Right! So your name is {name}!', as: PROF },
  {
    say: 'You will not get far in there alone, {name}. Go on — one of these three is yours.',
    as: PROF,
  },
  {
    choice: STARTERS.map((s) => s.name),
    branch: STARTERS.map((s) => [
      { say: s.blurb ?? '', as: PROF },
      {
        choice: [`Take ${s.name}`, 'Look at the others'],
        branch: [
          [
            { run: (ctx) => { ctx.state.starter = s.id; } },
            { setFlag: 'starter:chosen' },
            { track: `starter:${s.id}` },
            { say: `${s.name}, then! A fine choice. A ${s.type} type, through and through.`, as: PROF },
            {
              say: '{name}! Your very own SMT legend is about to unfold. Go and challenge the gym.',
              as: PROF,
            },
          ],
          PICK_AGAIN,
        ],
      },
    ] as Script),
  },
];
