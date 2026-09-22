import type { Script, ScriptCommand } from './script';
import { STARTERS, type MonSpec } from '../battle/teams';

/** Name plate on his dialogue. Kept short; the full name is in his intro. */
const PROF = 'PROF. SYMMETREE';

/**
 * Professor SymmeTREE's opening. This is the first thing a candidate reads, so
 * it carries the pitch: what SMT is, and that the people here are having fun.
 */
/** Taking one home. The only path that actually sets the starter. */
function take(s: MonSpec): Script {
  return [
    { run: (ctx) => { ctx.state.starter = s.id; } },
    { setFlag: 'starter:chosen' },
    { track: `starter:${s.id}` },
    { say: `${s.name}, then! A fine choice. A ${s.type} type, through and through.`, as: PROF },
    {
      say: '{name}! Your very own SMT legend is about to unfold. Go and challenge the gym.',
      as: PROF,
    },
  ];
}

/**
 * The line-up, re-offered to someone still deciding.
 *
 * Declared empty and closed below, because it and PICK_STARTER refer to each
 * other: browsing has to lead back into the same menu. Earlier this was a
 * separate re-offer that committed the moment you selected, so looking at a
 * second starter silently chose it for you.
 */
const BROWSE: Script = [{ say: 'Take your time. They are all patient. Mostly.', as: PROF }];

/**
 * Hear about one, then take it or keep looking. One menu, used for the first
 * look and every look after, so no route to a starter skips the confirm.
 */
export const PICK_STARTER: ScriptCommand = {
  choice: STARTERS.map((s) => s.name),
  branch: STARTERS.map((s) => [
    { say: s.blurb ?? '', as: PROF },
    {
      choice: [`Take ${s.name}`, 'Look at the others'],
      branch: [take(s), BROWSE],
    },
  ] as Script),
};

BROWSE.push(PICK_STARTER);

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
    say: 'Before you pick, one thing you have to know. SMT runs on three sides, and they answer to each other.',
    as: PROF,
  },
  { setFlag: 'intro:types' },
  {
    say: 'PW beats TD. TD beats TECH. TECH beats PW. Round and round, with no side on top.',
    as: PROF,
  },
  {
    say: 'Attack into the side you beat and it lands hard. Attack into the side that beats you and it barely lands at all.',
    as: PROF,
  },
  { run: (ctx) => { ctx.state.flags.delete('intro:types'); } },
  {
    say: 'You will not get far in there alone, {name}. Go on — one of these three is yours.',
    as: PROF,
  },
  PICK_STARTER,
];
