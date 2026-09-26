import { createLetterStrikeGame } from '../../game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../../game/letterStrike.ts'
import { unpackMeaningLexicon } from '../../game/meaningPacking.ts'
import type { BingoPreviewEntry, PreviewLives } from './catalog.ts'

/** Decode a frozen draft without importing authoring models or compiling in the browser. */
export function decodeBingoPreview(payload: unknown, entry: BingoPreviewEntry, lives: PreviewLives): LetterStrikeEncounter {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid preview data.')
  const data = payload as { version?: unknown; id?: unknown; semanticStatus?: unknown; encounter?: LetterStrikeEncounter }
  if (data.version !== 1 || data.id !== entry.id || data.semanticStatus !== 'draft'
    || data.encounter?.enemy?.word !== entry.enemy) throw new Error('Preview does not match its catalog entry.')
  const encounter: LetterStrikeEncounter = { ...data.encounter, startingResolve: lives,
    meaningLexicon: unpackMeaningLexicon(data.encounter.meaningLexicon) }
  const state = createLetterStrikeGame(encounter)
  if (state.enemyLetters.reduce((sum, letter) => sum + letter.hitsRemaining, 0) !== entry.enemyHP) {
    throw new Error('Preview enemy health does not match its catalog entry.')
  }
  return Object.freeze(encounter)
}
