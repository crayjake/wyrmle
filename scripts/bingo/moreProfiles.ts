import { dailyBingoProfiles } from './dailyProfiles.ts'
import type { BingoProfile } from './meanings.ts'

// New beta answers and seeds are separate from the scheduled daily boards.
const sources = dailyBingoProfiles()
function profile(source: string, enemy: string, bingo: string, hints: string[], explanation: string,
  enemySense?: string): BingoProfile {
  const base = sources.find(candidate => candidate.enemy === source)
  if (!base) throw new Error(`Missing reviewed profile: ${source}`)
  return { ...base, enemy, bingo, hints, explanation, enemySense: enemySense ?? base.enemySense }
}

export const moreBingoProfiles: BingoProfile[] = [
  profile('IRE', 'IRE', 'MERRIER', [
    'Picture the mood after a tense gathering starts to enjoy itself.',
    'Think of a comparison: the mood has become more cheerful.',
    'Seven letters: more festive or full of good cheer.',
  ], 'A more cheerful, good-humoured mood counters anger.'),
  profile('FEAR', 'SCARE', 'REASSURANCE', [
    'Sometimes the right words can take away an unsettling feeling.',
    'Someone worried about what might happen could need this from a trusted friend.',
    'Eleven letters: something said or done to restore confidence and ease fear.',
  ], 'Restoring confidence and easing fear counters a fright.', 'oewn-scare__1.12.00..'),
  profile('MESS', 'MESS', 'MASTERMINDS', [
    'Think about the person who sees how all the pieces should fit together.',
    'Behind a smoothly run operation, someone has planned and directed it.',
    'Eleven letters: plans and directs something skilfully, as a verb.',
  ], 'Planning and directing an operation brings organisation to disorder.'),
  profile('SPITE', 'SPITE', 'EMPATHISES', [
    'Try a different way of looking at the person on the receiving end.',
    'Imagine understanding their feelings as though you were in their position.',
    'Ten letters, British spelling: understands and shares another person’s feelings.',
  ], 'Understanding another person’s feelings counters the wish to hurt them.'),
  profile('TAINT', 'TAINT', 'SANITATION', [
    'Think about changing the conditions that let something become unsafe.',
    'Clean water and the removal of waste can be part of it.',
    'Ten letters: making conditions clean and hygienic to protect health.',
  ], 'Making things clean and free of harmful germs counters contamination.'),
]
