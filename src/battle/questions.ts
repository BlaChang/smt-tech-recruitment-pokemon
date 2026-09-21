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
];

export function randomQuestion(rng: () => number = Math.random): MathQuestion {
  const q = QUESTIONS[Math.floor(rng() * QUESTIONS.length)];
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
