import assert from 'node:assert/strict'
import themes from './themes.json' with { type: 'json' }
import excludedWordSenses from './excluded-word-senses.json' with { type: 'json' }
import { getMeaningSense } from '../../lib/wordMeanings.ts'
import { bingoProfileVersion, createBingoMeanings } from '../meanings.ts'
import type { BingoProfile } from '../meanings.ts'
import { meaningSupply, MEANING_LEXICON_VERSION } from '../../../src/game/meaningLexicon.ts'
import { MEANING_DICTIONARY_VERSION } from '../../../src/lexicon/meaningDictionary.ts'
import { canSpell } from '../../../src/generator/constructBoard.ts'
import type { LetterStrikeEncounter } from '../../../src/game/letterStrike.ts'

export const yearThemes = themes
export type YearTheme = typeof themes[number]
export type YearCandidate = { theme: string; side: 0 | 1; enemy: string; bingo: string;
  enemySense: string; enemyLemma: string; bingoLemma: string; armour: number; frequency: number }

export function yearProfile(theme: YearTheme, side: 0 | 1, candidate?: YearCandidate): BingoProfile {
  const roots = theme.poles.flatMap((pole, i) => pole.map(root => ({ ...root, relation: i === side ? 'similar' : 'opposite' })))
  const enemy = candidate?.enemy ?? theme.poles[side][0].word
  const bingo = candidate?.bingo ?? theme.poles[1 - side][0].word
  const answerSense = candidate && getMeaningSense(candidate.enemySense)
  if (candidate) assert.ok(answerSense)
  return { enemy, enemySense: candidate?.enemySense ?? theme.poles[side][0].senseId, bingo,
    roots, excludedDerivations: [...new Set(roots.flatMap(root => getMeaningSense(root.senseId)!.relations
      .filter(edge => edge.type === 'derivation').map(edge => edge.target)))],
    excludedWordSenses, hints: [], explanation: '' }
}

/** Reuse a reviewed thematic inventory; only the enemy-specific explanation and
 * publication header change. No new semantic edges or default classifications. */
export function retargetYearMeanings(profile: BingoProfile, base: ReturnType<typeof createBingoMeanings>) {
  const enemySense = getMeaningSense(profile.enemySense)!
  assert.ok(enemySense && base.meanings[profile.enemy]?.relation === 'similar')
  assert.equal(base.meanings[profile.bingo]?.relation, 'opposite')
  const meanings = Object.fromEntries(Object.entries(base.meanings).map(([word, record]) => [word,
    record.relation === 'unrelated' ? record : { ...record,
      reason: record.reason.replace(/^(Counters|Reinforces) .*? through /, `$1 ${profile.enemy.toLowerCase()} through `) }]))
  return { ...base, meanings, enemySense,
    compile(encounter: LetterStrikeEncounter): LetterStrikeEncounter {
      const supply = meaningSupply(encounter)
      const words = Object.fromEntries(Object.entries(meanings).filter(([word]) => word.length >= encounter.minimumWordLength
        && word.length <= encounter.startingTiles.length && canSpell(word, [...supply])))
      return { ...encounter, meaningLexicon: { version: MEANING_LEXICON_VERSION, dictionaryVersion: MEANING_DICTIONARY_VERSION,
        profileVersion: bingoProfileVersion(profile), policy: 'defined-only', enemyWord: profile.enemy,
        letterSupply: supply, minimumWordLength: encounter.minimumWordLength, maximumWordLength: encounter.startingTiles.length, words } }
    } }
}
