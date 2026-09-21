import type { Script } from './script';
import { hasFlag } from '../state/gameState';
import { rivalFor } from '../battle/rivals';
import { PROJECTS } from './projects';
import { showProjectLink } from '../app/projectLink';

/**
 * All player-facing gym copy lives here. Rewriting the pitch should never
 * require touching engine code. Professor SymmeTREE's opening is in intro.ts.
 *
 * NOTE FOR SMT: every specific number below is a placeholder — verify the
 * competitor count, round names and dates against this year's tournament
 * before this goes out.
 */

export const GREETER: Script = [
  { setFlag: 'talked:greeter' },
  {
    ifState: (s) => s.battleWon,
    then: [{ say: 'You beat ARPIT? On your first badge? Go sign the registry before he reconsiders.', as: 'FRONT DESK' }],
    otherwise: [
      { say: 'Welcome to the SMT GYM, {name}! SYMMETREE sent you, I assume. He sends everyone.', as: 'FRONT DESK' },
      {
        say: 'Gym rules, in order: light up the floor, beat the LEADER, sign the registry. There is no way around the floor. People ask.',
        as: 'FRONT DESK',
      },
      {
        say: 'Talk to everyone on your way up. They have all been waiting months for someone new to explain their job to.',
        as: 'FRONT DESK',
      },
    ],
  },
];

export const NPC_SCALE: Script = [
  { setFlag: 'talked:scale' },
  { say: 'Tournament day arithmetic: about a thousand students, eight rounds, tens of thousands of answers.', as: 'LOGISTICS' },
  { say: 'All of it graded and ranked before the closing ceremony. Which is four hours later.', as: 'LOGISTICS' },
  {
    say: 'You cannot do that with a spreadsheet and optimism. We tried. Once. We do not talk about that year.',
    as: 'LOGISTICS',
  },
];

export const NPC_BUILD: Script = [
  { setFlag: 'talked:build' },
  { say: 'You want to know what we actually make here? Fair question, {name}.', as: 'ENGINEER' },
  {
    say: 'Registration for hundreds of teams. The grading pipeline. The live scoreboard. The website. The scanner that reads answer sheets.',
    as: 'ENGINEER',
  },
  {
    say: 'Real users, a hard deadline, and no way to move it. The tournament happens whether the code is ready or not.',
    as: 'ENGINEER',
  },
  {
    choice: ['What do you use?', 'Sounds stressful'],
    branch: [
      [
        {
          say: 'Whatever fits. Web front ends, Python for the pipeline, and a pile of scripts nobody will admit to writing.',
          as: 'ENGINEER',
        },
        { say: 'If you have never touched any of it, you will learn it here. That is sort of the point.', as: 'ENGINEER' },
      ],
      [
        { say: 'It is! And then the scoreboard goes live and a thousand people look at the thing you made.', as: 'ENGINEER' },
        { say: 'Worth it. Ask me again at 3am the night before and I may answer differently.', as: 'ENGINEER' },
      ],
    ],
  },
];

export const NPC_WARSTORY: Script = [
  { setFlag: 'talked:warstory' },
  { say: 'Want a war story? Last year the Guts Round timer desynced nine minutes in.', as: 'VETERAN' },
  { say: 'Two of us rewrote it on the floor of a lecture hall while the round was still running.', as: 'VETERAN' },
  { say: 'Nobody in that room ever found out. That is the job. That is also the fun.', as: 'VETERAN' },
];

export const NPC_WACKY: Script = [
  { setFlag: 'talked:wacky' },
  { say: 'Between tournaments? We build stupid things. Gloriously stupid things.', as: 'GREMLIN' },
  {
    say: 'Someone wrote a bot that renames the entire Discord. Someone made the scoreboard play a fanfare. Someone built this gym.',
    as: 'GREMLIN',
  },
  {
    say: 'Nobody asked for a single one of those. That is the filter, honestly. We want the people who build the thing nobody asked for.',
    as: 'GREMLIN',
  },
  {
    choice: ['I do that constantly', 'Seems inefficient'],
    branch: [
      [
        { say: 'Then you are already one of us, {name}. Go beat ARPIT and make it official.', as: 'GREMLIN' },
        { track: 'wacky:yes' },
      ],
      [
        { say: 'Hah. Deeply. Efficiency is for the grading pipeline. This part is for us.', as: 'GREMLIN' },
        { track: 'wacky:no' },
      ],
    ],
  },
];

export const NPC_HINT: Script = [
  { setFlag: 'talked:hint' },
  { say: 'Stuck on the floor? Step on a panel and it flips itself and its four neighbours.', as: 'PUZZLER' },
  { say: 'Light all nine. Order does not matter, and stepping on the same panel twice undoes it.', as: 'PUZZLER' },
  {
    choice: ['Give me a real hint', 'I want to solve it myself'],
    branch: [
      [
        { say: 'Fine. Each panel flips itself and its four neighbours. Nine of them, everything mod 2.', as: 'PUZZLER' },
        { say: 'So it is a linear system over GF(2). Solve it like one, or brute force it. Both count.', as: 'PUZZLER' },
        { track: 'hint:taken' },
      ],
      [
        { say: 'Correct answer. I will be right here.', as: 'PUZZLER' },
        { track: 'hint:refused' },
      ],
    ],
  },
];

/** Your rival, chosen by which starter you took. */
export const RIVAL_ENCOUNTER: Script = [
  {
    ifFlag: 'rival:beaten',
    then: [
      {
        say: (s) => `${rivalFor(s.starter).defeated}`,
        as: (s) => rivalFor(s.starter).name,
      },
      { say: 'ARPIT is through the north door. Good luck. You will need some.', as: (s) => rivalFor(s.starter).name },
    ],
    otherwise: [
      { say: 'Hold on, {name}. Nobody walks past me to reach ARPIT.', as: (s) => rivalFor(s.starter).name },
      { say: (s) => rivalFor(s.starter).taunt, as: (s) => rivalFor(s.starter).name },
      {
        say: 'You remember the triangle SYMMETREE drew? Look at what I am holding, then look at yours.',
        as: (s) => rivalFor(s.starter).name,
      },
      { track: 'rival:start' },
      { rivalBattle: true },
      {
        ifFlag: 'rival:beaten',
        then: [
          { say: (s) => rivalFor(s.starter).defeated, as: (s) => rivalFor(s.starter).name },
          { setFlag: 'talked:rival' },
        ],
        otherwise: [
          {
            say: 'Told you. Type matchups are not a suggestion. Come back when you have worked it out.',
            as: (s) => rivalFor(s.starter).name,
          },
        ],
      },
    ],
  },
];

/**
 * One plaque per project, in the order they stand along the wall.
 *
 * A project with a url also puts a clickable link under the screen; one
 * without simply does not mention it.
 */
/**
 * The Hall of Fame's three attendants.
 *
 * The plaques state what each project is; these three say what it was like
 * to build one, which is the part a candidate cannot get from a repo. Each
 * carries exactly one idea, same as the entrance hall crowd.
 *
 * NOTE FOR SMT: these are written to be replaced. Swap in a real story from
 * a real tournament and this room does more recruiting than the rest of the
 * gym put together. `PROJECTS[n].name` is interpolated so renaming a project
 * in projects.ts cannot leave a curator talking about the old name.
 */
export const NPC_CURATOR: Script = [
  { setFlag: 'talked:curator' },
  { say: 'Six screens, {name}. Six things that did not exist until somebody on this team decided they should.', as: 'CURATOR' },
  {
    say: `Read them in any order. ${PROJECTS[0].name} is the oldest and ${PROJECTS[5].name} is the newest, and honestly the newest one is the better story.`,
    as: 'CURATOR',
  },
  {
    choice: ['Who decides what gets built?', 'Do people actually use these?'],
    branch: [
      [
        { say: 'Whoever notices the problem. That is not a slogan, it is just how it keeps happening.', as: 'CURATOR' },
        { say: 'Someone says "this is painful every year" and then it is their project. Sometimes they are a freshman.', as: 'CURATOR' },
        { track: 'curator:who' },
      ],
      [
        { say: 'Every one of them, on the same Saturday, by people who will never know your name.', as: 'CURATOR' },
        { say: 'That is the trade. No applause, and the thing you built runs a tournament.', as: 'CURATOR' },
        { track: 'curator:used' },
      ],
    ],
  },
];

export const NPC_SHIPPER: Script = [
  { setFlag: 'talked:shipper' },
  {
    say: `I own the ${PROJECTS[2].name}. Third screen along. Go look at it, I will wait.`,
    as: 'ON CALL',
  },
  {
    say: 'It broke. Live. Forty minutes before awards, with the room watching it.',
    as: 'ON CALL',
  },
  {
    choice: ['What did you do?', 'Whose fault was it?'],
    branch: [
      [
        { say: 'Found it, fixed it, pushed it, and went back to handing out water bottles.', as: 'ON CALL' },
        { say: 'Nobody in that room knows it happened. That is the whole job, really.', as: 'ON CALL' },
        { track: 'shipper:fix' },
      ],
      [
        { say: 'Mine. Obviously mine. I wrote it.', as: 'ON CALL' },
        { say: 'We do not do blame here, we do postmortems. Then we fix it so next year it cannot happen.', as: 'ON CALL' },
        { track: 'shipper:blame' },
      ],
    ],
  },
];

export const NPC_ROOKIE: Script = [
  { setFlag: 'talked:rookie' },
  { say: 'Do not let this room intimidate you. I stood exactly where you are and I could not read half of it.', as: 'FIRST YEAR' },
  {
    say: `I joined last year knowing nothing. My name is on ${PROJECTS[3].name} now. Fourth screen.`,
    as: 'FIRST YEAR',
  },
  {
    choice: ['How long did that take?', 'What did you already know?'],
    branch: [
      [
        { say: 'One tournament cycle. You learn fast when there is a real date at the end of it.', as: 'FIRST YEAR' },
        { track: 'rookie:time' },
      ],
      [
        { say: 'Almost nothing. I liked the puzzle and I kept showing up. That turned out to be the requirement.', as: 'FIRST YEAR' },
        { track: 'rookie:skills' },
      ],
    ],
  },
];

export const HALL_PLAQUES: Script[] = PROJECTS.map((project) => [
  { run: () => showProjectLink(project.name, project.url) },
  { say: `${project.name}\n${project.blurb}` },
  ...(project.url
    ? ([{ say: 'A link to it is under the screen.' }] as Script)
    : ([] as Script)),
  { track: `project:${project.id}` },
]);

export const SIGN_PLAQUE: Script = [
  { say: 'STANFORD MATH TOURNAMENT — THE GYM\n"We ship it before the closing ceremony."' },
];

export const SIGN_RULES: Script = [
  { say: 'GYM RULES\n1. Light the floor.\n2. Beat the leader.\n3. Sign the registry.' },
  { say: 'There was a fourth rule. Nobody could read the handwriting.' },
];

export const LOCKED_GATE: Script = [
  { say: 'The door is sealed. The nine panels behind you are not all lit.' },
];

export const GATE_OPENS: Script = [
  { say: 'Something heavy unlatches. The way on is open.' },
];

export const LEADER: Script = [
  { ifState: (s) => s.battleWon, then: leaderPostWin(), otherwise: leaderChallenge() },
];

function leaderChallenge(): Script {
  return [
    { say: 'So the floor let you through. Most people quit somewhere around panel eleven.', as: 'ARPIT' },
    {
      say: 'ARPIT RANSARIA. I keep this tournament on the rails for a thousand people, with volunteers, twice a year.',
      as: 'ARPIT',
    },
    {
      say: 'I am not going to read your resume, {name}. I want to know whether you are still standing here in ten minutes.',
      as: 'ARPIT',
    },
    { say: 'Two of mine against one of yours. Try to look surprised.', as: 'ARPIT' },
    { track: 'battle:start' },
    { battle: true },
    {
      ifState: (s) => s.battleWon,
      then: leaderPostWin(),
      otherwise: [
        { say: 'Down already. Nothing here is unwinnable, {name} — shake it off and come back at me.', as: 'ARPIT' },
        { track: 'battle:lost' },
      ],
    },
  ];
}

function leaderPostWin(): Script {
  return [
    {
      ifState: (s) => s.applied,
      then: [
        { say: 'Registry is signed. We will be in touch — watch your email.', as: 'ARPIT' },
        { say: 'Go build something nobody asked for in the meantime.', as: 'ARPIT' },
      ],
      otherwise: [
        { setFlag: 'badge' },
        { say: 'Beaten by a first-timer. Good. The SMT BADGE is yours, {name}.', as: 'ARPIT' },
        {
          say: 'That badge means one thing: you stuck with a dumb puzzle and a dumber battle because you wanted to see how it ended.',
          as: 'ARPIT',
        },
        { say: 'That is the entire hiring criterion. Leave me your email and we will talk for real.', as: 'ARPIT' },
        { track: 'registry:open' },
        { registry: true },
        {
          ifState: (s) => s.applied,
          then: [
            { say: 'Got it. Welcome to the part where we actually meet.', as: 'ARPIT' },
            { say: 'Bring the weirdest thing you have built. We mean that literally.', as: 'ARPIT' },
          ],
          otherwise: [{ say: 'Changed your mind? Talk to me again when you have not.', as: 'ARPIT' }],
        },
      ],
    },
  ];
}

/** Shown on the entrance tile when the player tries to leave before applying. */
export const EXIT_PROMPT: Script = [
  {
    ifState: (s) => s.applied,
    then: [{ say: 'You are done here, {name}. Go outside. Check your email on Sunday.' }],
    otherwise: [
      { say: 'The door is right there. You could leave. You have not beaten the gym.' },
      {
        ifState: (s) => !hasFlag(s, 'talked:greeter'),
        then: [{ say: 'You have not even talked to the front desk. Rude.' }],
      },
    ],
  },
];
