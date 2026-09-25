import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'
import type { PuzzleMeaningLexicon } from '../game/meaningLexicon.ts'
import { sha256 } from './sha256.ts'

const meaningRuleDigests = new WeakMap<PuzzleMeaningLexicon, string>()

function meaningRuleDigest(lexicon: PuzzleMeaningLexicon): string {
  const cached = meaningRuleDigests.get(lexicon)
  if (cached !== undefined) return cached
  // A compiled lexicon is immutable for its identity, like the runtime spelling
  // indexes. Rule changes must create a new object (including counterfactuals).
  // Definitions are validated separately; only word membership and relations
  // affect future moves, so presentation-only edits share a solver position.
  const digest = sha256(JSON.stringify({
    version: lexicon.version,
    words: Object.keys(lexicon.words).sort().map(word => [word, lexicon.words[word].relation]),
  }))
  meaningRuleDigests.set(lexicon, digest)
  return digest
}

/** The rules are part of the position: counterfactual searches cannot share keys. */
export function encounterRuleKey(encounter: LetterStrikeEncounter): string {
  const sortedEntries = (record: object) => Object.entries(record).sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify([
    encounter.enemy.semanticRelations,
    encounter.minimumWordLength,
    sortedEntries(encounter.grammarModifiers ?? {}),
    sortedEntries(encounter.wordPartsOfSpeech ?? {}),
    ...(encounter.lexicalRules ? [encounter.lexicalRules] : []),
    ...(encounter.meaningLexicon ? [['meaning-lexicon-sha256', meaningRuleDigest(encounter.meaningLexicon)]] : []),
    encounter.longWordRule ?? null,
    encounter.strikeConsumesAllowance === true,
    encounter.tileEffects,
    encounter.refillQueue,
    ...(encounter.finiteRefills ? ['finite-refills'] : []),
  ])
}

/** UI selection, errors, and history have no effect on legal future play. */
export function stateKey(state: LetterStrikeState, ruleKey = encounterRuleKey(state.encounter)): string {
  return `${ruleKey}|${JSON.stringify([
    state.status, state.playerResolve, state.refillIndex, state.nextTileId,
    // Board position matters: the refill is assigned in board order.
    state.tiles.map(tile => [tile.id, tile.letter.toUpperCase(), tile.type, tile.gem ?? null]),
    state.enemyLetters.map(letter => [letter.id, letter.letter.toUpperCase(), letter.hitsRemaining, letter.initialHits,
      ...(letter.armourGained ? [true] : [])]),
  ])}`
}
