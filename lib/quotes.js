// Motivational quotes shown once per app open.
// Kept short and punchy so they read well in a top banner.
export const QUOTES = [
  'Discipline is choosing between what you want now and what you want most.',
  'The only bad workout is the one that didn’t happen.',
  'You don’t have to be extreme, just consistent.',
  'Show up for yourself today — future you is watching.',
  'Small steps every day add up to big results.',
  'Sweat now, shine later.',
  'Your body can stand almost anything. It’s your mind you have to convince.',
  'Progress, not perfection.',
  'Fall in love with the process and the results will come.',
  'One workout at a time. One day at a time.',
  'The pain you feel today is the strength you feel tomorrow.',
  'Don’t count the days, make the days count.',
  'Strong is a feeling — go earn it.',
  'You’re one workout away from a better mood.',
  'Consistency beats intensity every single time.',
  'Do something today your future self will thank you for.',
  'It never gets easier, you just get stronger.',
  'Motivation gets you started. Habit keeps you going.',
  'A little progress each day adds up to big results.',
  'The hardest lift is lifting yourself off the couch — you already did it.',
  'Train because you love your body, not because you hate it.',
  'Wake up. Work out. Look hot. Kick ass.',
  'Success starts with self-discipline.',
  'Every rep counts. Every day matters.',
  'Be stronger than your strongest excuse.',
  'You didn’t come this far to only come this far.',
  'Push yourself, because no one else is going to do it for you.',
  'Great things never came from comfort zones.',
  'Energy and persistence conquer all things.',
  'Take care of your body. It’s the only place you have to live.',
]

// Deterministic-ish pick that changes each app open. Math.random is fine in
// the browser runtime (the workflow-only restriction doesn't apply here).
export const pickQuote = () => QUOTES[Math.floor(Math.random() * QUOTES.length)]
