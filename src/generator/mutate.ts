import { createRandom } from './random.ts'
import { canSpell, overlappingLetters } from './constructBoard.ts'
import { isDictionaryWord } from '../game/dictionary.ts'
import { getEncounterPartsOfSpeech } from '../game/lexicalRules.ts'
import { currentLexicalProvider, localLexicalProvider } from './lexicalProvider.ts'
import type { CandidatePuzzle } from './types.ts'

export const mutationKinds = ['starting-letter', 'tile-swap', 'refill-letter', 'move-ward', 'move-strike', 'armour', 'armour-copy', 'anchor', 'resolve', 'move-regen', 'refill-length'] as const
export type MutationKind = typeof mutationKinds[number]

export function mutateCandidate(candidate: CandidatePuzzle, seed: string | number, options: {
  kind?: MutationKind; allowResolveMutation?: boolean
} = {}): CandidatePuzzle {
  const random = createRandom(seed)
  const result = structuredClone(candidate)
  if (options.kind === 'refill-length' && !candidate.encounter.finiteRefills) throw new Error('Refill length mutation requires a finite encounter.')
  const kind = options.kind ?? random.pick(mutationKinds.filter(kind => (options.allowResolveMutation || kind !== 'resolve')
    && (kind !== 'refill-length' || candidate.encounter.finiteRefills)
    && (kind !== 'move-regen' || candidate.encounter.startingTiles.some(tile => tile.gem === 'regen'))))
  const tiles = result.encounter.startingTiles.map(tile => ({ ...tile }))
  const letters = [...new Set(result.enemyWord + result.anchors.map(anchor => anchor.word).join(''))]
  const index = random.int(16)
  const other = (index + 1 + random.int(15)) % 16
  if (kind === 'starting-letter') {
    const alternatives = letters.filter(letter => letter !== tiles[index].letter)
    if (alternatives.length) tiles[index].letter = random.pick(alternatives)
  }
  if (kind === 'tile-swap') [tiles[index], tiles[other]] = [tiles[other], tiles[index]]
  if (kind === 'refill-letter' && result.encounter.refillQueue.length > 0) {
    const queue = [...result.encounter.refillQueue]
    const position = random.int(Math.min(queue.length, 40))
    const alternatives = letters.filter(letter => letter !== queue[position])
    if (alternatives.length) queue[position] = random.pick(alternatives)
    result.encounter.refillQueue = queue.join('')
  }
  if (kind === 'refill-length') {
    const queue = [...result.encounter.refillQueue]
    const change = 1 + random.int(4)
    const lengths = [queue.length - change, queue.length + change].filter(length => length >= 0 && length <= 96)
    if (lengths.length) {
      const length = random.pick(lengths)
      while (queue.length < length) queue.push(random.pick(letters))
      result.encounter.refillQueue = queue.slice(0, length).join('')
    }
  }
  if (kind === 'move-ward' || kind === 'move-strike' || kind === 'move-regen') {
    const gem = kind === 'move-ward' ? 'ward' : kind === 'move-strike' ? 'strike' : 'regen'
    const source = tiles.findIndex(tile => tile.gem === gem)
    const targets = tiles.map((tile, position) => ({ tile, position })).filter(({ tile }) => tile.type === 'normal'
      && (gem === 'ward' || result.enemyWord.includes(tile.letter)))
    if (source >= 0 && targets.length) {
      const target = random.pick(targets).position
      tiles[source].type = 'normal'
      delete tiles[source].gem
      tiles[target].type = 'gem'
      tiles[target].gem = gem
    }
  }
  if (kind === 'armour' || kind === 'armour-copy') {
    const enemy = result.encounter.enemyLetters.map(letter => ({ ...letter }))
    if (kind === 'armour') {
      const position = random.int(enemy.length)
      enemy[position].initialHits = enemy[position].initialHits === 2 ? 1 : 2
      enemy[position].hitsRemaining = enemy[position].initialHits
    } else {
      const pairs = enemy.flatMap((letter, position) => enemy.flatMap((copy, index) => index > position
        && letter.letter === copy.letter && letter.initialHits !== copy.initialHits ? [{ position, copy: index }] : []))
      if (pairs.length) {
        const { position, copy } = random.pick(pairs)
        ;[enemy[position].initialHits, enemy[copy].initialHits] = [enemy[copy].initialHits, enemy[position].initialHits]
        enemy[position].hitsRemaining = enemy[position].initialHits
        enemy[copy].hitsRemaining = enemy[copy].initialHits
      }
    }
    result.encounter.enemyLetters = enemy
  }
  if (kind === 'anchor') {
    const opening = result.anchors.filter(anchor => anchor.expected === 'opening')
    const relations = result.encounter.enemy.semanticRelations
    const isGrammar = (word: string) => {
      const parts = getEncounterPartsOfSpeech(result.encounter, word) ?? []
      return (Boolean(result.encounter.lexicalRules) || parts.length === 1)
        && parts.some(part => (result.encounter.grammarModifiers?.[part] ?? 0) > 0)
    }
    const neutral = Object.keys(result.encounter.wordPartsOfSpeech ?? {}).filter(word => !relations.opposite.includes(word) && !relations.similar.includes(word))
    const replacements = opening.flatMap(selected => {
      const pool = selected.roles.includes('resisted') ? relations.similar
        : selected.roles.includes('counter') ? relations.opposite
          : selected.roles.includes('grammar') ? neutral.filter(isGrammar) : neutral
      return pool.filter(word => word.length >= result.encounter.minimumWordLength && isDictionaryWord(word)
        && !opening.some(anchor => anchor.word === word))
        .map(word => ({ selected, word, union: overlappingLetters(opening.map(anchor => anchor === selected ? word : anchor.word)) }))
        .filter(replacement => replacement.union.length <= 16)
    })
    if (replacements.length) {
      const { selected, word, union } = random.pick(replacements)
      while (union.length < 16) union.push(tiles[union.length].letter)
      random.shuffle(union).forEach((letter, index) => { tiles[index].letter = letter })
      selected.word = word
      selected.roles = relations.opposite.includes(word) ? ['counter']
        : relations.similar.includes(word) ? ['resisted', 'decoy', 'strike'] : ['neutral', 'ward']
      if (isGrammar(word)) selected.roles.push('grammar')
      selected.commonness = [localLexicalProvider.id, currentLexicalProvider.id].includes(result.provenance.lexicalProvider)
        ? localLexicalProvider.getEntry(word)?.commonness ?? null : null
    }
  }
  if (kind === 'resolve' && options.allowResolveMutation) {
    const possible = [result.encounter.startingResolve - 1, result.encounter.startingResolve + 1].filter(value => value >= 3 && value <= 6)
    if (possible.length) result.encounter.startingResolve = random.pick(possible)
    const wards = tiles.filter(tile => tile.type === 'gem' && tile.gem && result.encounter.tileEffects[tile.gem]?.preventResolveLoss).length
    const minimum = (result.encounter.startingResolve + wards) * 16
    if (!result.encounter.finiteRefills) {
      while (result.encounter.refillQueue.length < minimum) result.encounter.refillQueue += result.encounter.refillQueue
    }
  }
  result.encounter.startingTiles = tiles
  // Only guaranteed opening anchors retain that claim after mutation.
  result.anchors = result.anchors.filter(anchor => anchor.expected !== 'opening' || canSpell(anchor.word, tiles.map(tile => tile.letter)))
  // Generation assigns each neighbourhood a full generation/parent/mutation
  // seed. Keep the original root identity instead of appending an ever-growing
  // chain of ancestor IDs; the immediate parent remains explicit provenance.
  const rootId = candidate.provenance.rootId ?? candidate.id
  result.id = `${rootId}-m${encodeURIComponent(String(seed))}`
  result.seed = String(seed)
  result.encounter.id = result.id
  result.provenance.parentId = candidate.id
  result.provenance.rootId = rootId
  result.construction.mutations.push(kind)
  // The old construction trace remains useful provenance, but must never be
  // passed to search as evidence for a mutated board.
  result.construction.plannedTileIds = []
  return result
}
