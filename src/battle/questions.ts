export interface MathQuestion {
  prompt: string;
  options: string[];
  answer: number;
  /** Said by the leader after a correct answer. */
  reward: string;
}

/**
 * The shield breaker. Deliberately short and answerable in your head — the
 * point is whether a candidate is willing to engage with a math problem at all,
 * not whether they can grind one out.
 */
export const QUESTIONS: MathQuestion[] = [
  {
    prompt: 'What is the last digit of 7^2024?',
    options: ['1', '7', '9'],
    answer: 0,
    reward: 'Cycles of four. Good.',
  },
  {
    prompt: 'Flip a fair coin 4 times. P(exactly two heads)?',
    options: ['3/8', '1/2', '1/4'],
    answer: 0,
    reward: 'Six of sixteen. Correct.',
  },
  {
    prompt: 'How many positive divisors does 360 have?',
    options: ['24', '18', '12'],
    answer: 0,
    reward: 'Factor, add one, multiply. Correct.',
  },
  {
    prompt: 'How many ways can 8 people sit around a round table?',
    options: ['7!', '8!', '6!'],
    answer: 0,
    reward: 'You fixed a seat. Correct.',
  },
  {
    prompt: 'If x + 1/x = 3, what is x^2 + 1/x^2?',
    options: ['7', '9', '11'],
    answer: 0,
    reward: 'Square it, subtract two. Correct.',
  },
  {
    prompt: 'How many possible subsets can one make of {0,1,2,3,4,5,6,7,8,9}',
    options: ['1024', '1028', '512'],
    answer: 0,
    reward: 'Each number can be either in or outside the subset.  A power of 2, correct.',
  },
  {
    prompt: 'If a 5x5x5 cube is painted blue on its surface, how many 1x1x1 cubes have at least one side blue?',
    options: ['98', '100', '102'],
    answer: 0,
    reward: 'Subtract the inner 3x3x3 core, correct.',
  },
  {
    prompt: 'What is e^(ipi/3) + e^(2ipi/3) + e^(3i pi/3)? + ... + e^(6pi/3)',
    options: ['0', '-1', '1'],
    answer: 0,
    reward: 'Roots of unity, their center of mass is 0, correct.',
  },
];

/**
 * A question the player has not already answered correctly.
 *
 * `answered` holds prompts, which are unique across the bank. Once every
 * question has been beaten the pool resets rather than running dry -- the
 * gym is hard-gated, so there is no state in which Arpit has nothing left
 * to ask and the shield cannot come down.
 */
export function randomQuestion(
  answered: readonly string[] = [],
  rng: () => number = Math.random,
): MathQuestion {
  const seen = new Set(answered);
  const fresh = QUESTIONS.filter((q) => !seen.has(q.prompt));
  const pool = fresh.length ? fresh : QUESTIONS;
  const q = pool[Math.floor(rng() * pool.length)];
  // Options are authored correct-first for readability; shuffle so the answer moves.
  const order = shuffle([0, 1, 2], rng);
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    answer: order.indexOf(q.answer),
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
