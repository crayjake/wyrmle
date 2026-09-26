import assert from 'node:assert/strict'
import { canSpell, constructBoard, letterCounts, overlappingLetters } from '../../src/generator/constructBoard.ts'
import { constructRefill, selectWordIds } from '../../src/generator/constructRefill.ts'
import { createRandom } from '../../src/generator/random.ts'
import { getGenerationWordCommonness } from '../../src/generator/familiarity.ts'
import { findPlayableWords } from '../../src/generator/findMoves.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../../src/game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../../src/game/letterStrike.ts'
import type { createBingoMeanings, BingoProfile } from './meanings.ts'

type Meanings = ReturnType<typeof createBingoMeanings>
const frequency = (word: string) => getGenerationWordCommonness(word) ?? 0
const hp = (state: LetterStrikeState) => state.enemyLetters.reduce((sum, letter) => sum + letter.hitsRemaining, 0)
type AnchorChoice = { anchors: string[]; letters: string[]; score: number }
const anchorCache = new WeakMap<Meanings, AnchorChoice[]>()

function startingAnchors(profile: BingoProfile, meanings: Meanings, counters: string[], resisted: string[]) {
  const cached = anchorCache.get(meanings)
  if (cached) return cached
  const bingoLemma = meanings.meanings[profile.bingo].lemma
  const families = (pool: string[], letters: string[]) => new Set(pool.filter(word =>
    meanings.meanings[word].lemma !== bingoLemma && canSpell(word, letters)).map(word => meanings.meanings[word].lemma)).size
  const score = (letters: string[]) => families(counters, letters) * 6 + Math.min(6, families(resisted, letters)) * 3
  let beam: AnchorChoice[] = [{ anchors: [profile.bingo], letters: [...profile.bingo], score: 0 }]
  const pool = [...new Set([...counters, ...resisted])]
  // Keep several overlapping word combinations alive before committing the
  // spare slots. A greedy first bait can otherwise use every free letter.
  for (let depth = 0; depth < 4; depth++) {
    const candidates = new Map<string, AnchorChoice>()
    for (const choice of beam) {
      candidates.set([...choice.letters].sort().join(''), choice)
      for (const word of pool) {
        if (canSpell(word, choice.letters)) continue
        const letters = overlappingLetters([...choice.anchors, word])
        if (letters.length > 16) continue
        const key = [...letters].sort().join('')
        if (!candidates.has(key)) candidates.set(key, { anchors: [...choice.anchors, word], letters, score: score(letters) })
      }
    }
    beam = [...candidates.values()].sort((a, b) => b.score - a.score
      || a.letters.length - b.letters.length || a.letters.join('').localeCompare(b.letters.join(''))).slice(0, 48)
  }
  anchorCache.set(meanings, beam)
  return beam
}
export function bingoArmour(enemy: string, bingo: string) {
  assert.ok(canSpell(enemy, [...bingo]), `${bingo} does not cover ${enemy}`)
  const spare = letterCounts(bingo)
  for (const letter of enemy) spare.set(letter, spare.get(letter)! - 1)
  return [...enemy].map((letter, index) => {
    const hits = spare.get(letter)! > 0 ? 2 : 1
    if (hits === 2) spare.set(letter, spare.get(letter)! - 1)
    return { id: `enemy-${index}`, letter, initialHits: hits, hitsRemaining: hits }
  })
}

export function constructBingo(profile: BingoProfile, meanings: Meanings, index: number) {
  const seed = `bingo-first-3:${profile.enemy}:${profile.bingo}:${index}`
  const random = createRandom(seed)
  const usable = (word: string) => word.length >= 3 && word.length <= 12 && frequency(word) >= 0.35
  const rank = (a: string, b: string) => frequency(b) - frequency(a) || a.length - b.length || a.localeCompare(b)
  const counters = meanings.relations.opposite.filter(usable).filter(word => word !== profile.bingo).sort(rank)
  const resisted = meanings.relations.similar.filter(usable).sort(rank)
  const options = startingAnchors(profile, meanings, counters, resisted).slice(0, 12)
  const anchors = [...options[index % options.length].anchors]
  const tiles = constructBoard(anchors, [...resisted, ...counters], random)
  const shell: LetterStrikeEncounter = {
    id: seed, enemy: { word: profile.enemy, definition: meanings.enemySense.definition,
      partOfSpeech: meanings.enemySense.partOfSpeech, semanticRelations: meanings.relations },
    enemyLetters: bingoArmour(profile.enemy, profile.bingo), startingTiles: tiles,
    startingResolve: 3, refillQueue: '', finiteRefills: true, minimumWordLength: 3,
    grammarModifiers: {},
    tileEffects: {
      strike: { strike: true, preventResolveLoss: false },
      ward: { strike: false, preventResolveLoss: true },
    },
  }
  const required = shell.enemyLetters.map(letter => letter.letter.repeat(letter.initialHits)).join('')
  // Never plan the ordinary route through any instant-win spelling.
  const planning = [...new Set([...counters, ...resisted])].filter(word => !canSpell(required, [...word]))
    .map(word => ({ word, commonness: frequency(word) }))
  const refill = constructRefill(shell, planning, random, 3, 24, { counters, resisted })
  const encounter = meanings.compile({ ...shell, refillQueue: refill.refillQueue })
  const initial = createLetterStrikeGame(encounter)
  const ids = selectWordIds(initial.tiles, profile.bingo)
  assert.ok(ids)
  assert.equal(submitLetterStrike(initial, ids).status, 'won')
  return { seed, anchors, encounter, plannedWords: refill.construction.plannedWords }
}

type Choice = { word: string; ids: number[]; label: string; hits: number; lemma: string; frequency: number }
export function analyseBingo(encounter: LetterStrikeEncounter) {
  const initial = createLetterStrikeGame(encounter)
  const lexicon = encounter.meaningLexicon!.words
  const vocabulary = Object.keys(lexicon).filter(word => frequency(word) >= (lexicon[word].relation === 'opposite' ? 0.35 : 0.5))
  const choices = (state: LetterStrikeState, all = false): Choice[] => findPlayableWords(state, all ? Object.keys(lexicon) : vocabulary).flatMap(word => {
    const ids = selectWordIds(state.tiles, word)!
    const p = previewLetterStrike(state, ids)
    return p.valid ? [{ word, ids, label: p.semanticLabel, hits: p.strikes, lemma: lexicon[word].lemma, frequency: frequency(word) }] : []
  }).sort((a, b) => b.frequency - a.frequency || a.word.length - b.word.length || a.word.localeCompare(b.word))
  const root = choices(initial, true)
  const bingos = new Set(root.filter(move => move.hits === hp(initial)).map(move => move.word))
  const bingoLemmas = new Set([...bingos].map(word => lexicon[word].lemma))
  const ordinary = (state: LetterStrikeState) => choices(state).filter(move => !bingoLemmas.has(move.lemma))
  function families(moves: Choice[], count: number) {
    const seen = new Set<string>()
    return moves.filter(move => { if (seen.has(move.lemma)) return false; seen.add(move.lemma); return true }).slice(0, count)
  }
  const starts = root.filter(move => !bingoLemmas.has(move.lemma) && move.frequency >= 0.4)
  const counters = families(starts.filter(move => move.label === 'COUNTER' && move.hits > 0), 12)
  const resisted = families(starts.filter(move => move.label === 'RESISTED' && move.word.length >= 4), 4)
  const neutrals = families(starts.filter(move => move.label === 'NEUTRAL' && move.hits > 0), 2)
  const routes = [...counters, ...resisted, ...neutrals].map(first => {
    const after = submitLetterStrike(initial, first.ids)
    const next = ordinary(after)
    const later = {
      counters: families(next.filter(m => m.label === 'COUNTER' && m.hits > 0), 100).map(m => m.word),
      resisted: families(next.filter(m => m.label === 'RESISTED'), 100).map(m => m.word),
      neutral: next.filter(m => m.label === 'NEUTRAL').length,
    }
    // Canonical physical selections and bounded depth: witnesses, not an
    // all-opening safety proof. Prefer another counter over neutral cleanup.
    const productive = next.filter(m => m.hits > 0 && m.lemma !== first.lemma).sort((a, b) => Number(b.label === 'COUNTER') - Number(a.label === 'COUNTER')
      || b.hits - a.hits || b.frequency - a.frequency).slice(0, 24)
    let witness: Choice[] | null = null
    let thirdTurn: { counters: string[]; resisted: string[] } | null = null
    for (const second of productive) {
      const state = submitLetterStrike(after, second.ids)
      if (state.status === 'won') { witness = [first, second]; break }
      if (state.status !== 'playing') continue
      const finalChoices = ordinary(state).filter(m => m.lemma !== first.lemma && m.lemma !== second.lemma)
      const finisher = finalChoices.filter(m => m.hits >= hp(state))
        .sort((a, b) => Number(b.label === 'COUNTER') - Number(a.label === 'COUNTER'))[0]
      if (finisher) {
        witness = [first, second, finisher]
        thirdTurn = {
          counters: families(finalChoices.filter(m => m.label === 'COUNTER' && m.hits > 0), 100).map(m => m.word),
          resisted: families(finalChoices.filter(m => m.label === 'RESISTED'), 100).map(m => m.word),
        }
        break
      }
    }
    let cleanup = false
    // Explicitly check a counter followed by TWO single-hit neutral words.
    if (first.label === 'COUNTER' && hp(after) === 2) {
      for (const second of next.filter(m => m.label === 'NEUTRAL' && m.hits === 1)) {
        const state = submitLetterStrike(after, second.ids)
        if (ordinary(state).some(m => m.label === 'NEUTRAL' && m.hits === 1)) { cleanup = true; break }
      }
    }
    return { opening: first.word, label: first.label, hits: first.hits, later, thirdTurn, cleanup,
      witness: witness && { words: witness.map(m => m.word), tileIds: witness.map(m => m.ids), labels: witness.map(m => m.label), hits: witness.map(m => m.hits) } }
  })
  const winning = routes.filter(r => r.witness)
  const repeatedCounters = winning.filter(r => r.witness!.labels.filter(label => label === 'COUNTER').length >= 2)
  const sustained = routes.filter(r => r.later.counters.length >= 3 && r.later.resisted.length >= 2)
  const sustainedFinal = routes.filter(r => r.thirdTurn && r.thirdTurn.counters.length >= 2 && r.thirdTurn.resisted.length >= 1)
  const score = repeatedCounters.length * 20 + winning.length * 8 + sustained.length * 5 + sustainedFinal.length * 5
    + counters.length * 3 + resisted.length * 4 - routes.filter(r => r.cleanup).length * 16
    - Math.max(0, bingos.size - 3) * 10
  return { score, bingos: [...bingos], counterFamilies: counters.length, resistedFamilies: resisted.length,
    winningOpenings: winning.length, repeatedCounterRoutes: repeatedCounters.length,
    sustainedPositions: sustained.length, sustainedFinalPositions: sustainedFinal.length,
    neutralCleanupOpenings: routes.filter(r => r.cleanup).length, routes }
}
