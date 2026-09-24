import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'

/** The rules are part of the position: counterfactual searches cannot share keys. */
export function encounterRuleKey(encounter: LetterStrikeEncounter): string {
  const sortedEntries = (record: object) => Object.entries(record).sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify([
    encounter.enemy.semanticRelations,
    encounter.minimumWordLength,
    sortedEntries(encounter.grammarModifiers ?? {}),
    sortedEntries(encounter.wordPartsOfSpeech ?? {}),
    encounter.longWordRule ?? null,
    encounter.strikeConsumesAllowance === true,
    encounter.tileEffects,
    encounter.refillQueue,
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
