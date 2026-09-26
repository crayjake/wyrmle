import data from './puzzle.json' with { type: 'json' }
import { unpackMeaningLexicon } from '../../game/meaningPacking.ts'
import type { LetterStrikeEncounter } from '../../game/letterStrike.ts'

/** Separate frozen preview, deliberately absent from the daily catalog. */
export const bingoEncounter: LetterStrikeEncounter = Object.freeze({
  ...data,
  meaningLexicon: unpackMeaningLexicon(data.meaningLexicon),
} as LetterStrikeEncounter)
