import classic from '../../src/lexicon/data/semantic-profiles-v1.json' with { type: 'json' }
import { bingoProfiles } from './meanings.ts'
import type { BingoProfile } from './meanings.ts'
import { getMeaningSense, getWordMeanings } from '../lib/wordMeanings.ts'

/** Pinned authoring candidates. Boards are generated, never copied from previews. */
const candidates = [
  ['ARID', 'ARID', 'IRRIGATED'], ['ROT', 'ROT', 'RESTORATION'], ['INERT', 'INERT', 'REINVIGORATE'],
  ['STINGY', 'STINGY', 'UNSTINTINGLY'], ['FALSE', 'FALSE', 'FACTUALNESS'],
  ['ANGER', 'ANGER', 'RELAXING'], ['ANGER', 'RAGE', 'LIGHTHEARTED'], ['ANGER', 'IRE', 'FRIENDLIER'],
  ['FEAR', 'FEAR', 'FEARLESSNESS'], ['FEAR', 'DREAD', 'DAREDEVIL'], ['FEAR', 'PANIC', 'PACIFYING'],
  ['CHAOS', 'CHAOS', 'ORCHESTRATED'], ['CHAOS', 'MESS', 'SYSTEMATIZED'], ['CHAOS', 'RIOT', 'COORDINATE'],
  ['CRUELTY', 'CRUEL', 'MERCIFULLY'], ['CRUELTY', 'SPITE', 'COMPASSIONATE'],
  ['INERT', 'IDLE', 'REVITALIZED'], ['INERT', 'STILL', 'LIVELIEST'], ['INERT', 'TIRE', 'SPIRITED'],
  ['STINGY', 'STINT', 'CONTRIBUTIONS'], ['FALSE', 'LIE', 'VERIFIABLE'], ['FALSE', 'UNTRUTH', 'TRUTHFULNESS'],
  ['FALSE', 'DECEIT', 'DIRECTNESS'], ['FALSE', 'FICTIVE', 'VERIFICATION'], ['FALSE', 'FICTION', 'CONFIRMATION'],
  ['ROT', 'TAINT', 'DISINFECTANT'], ['ROT', 'ROTTEN', 'RECONSTRUCTED'], ['INERT', 'INERTIA', 'INVIGORATED'],
  ['FALSE', 'ERROR', 'CORROBORATE'], ['INERT', 'INERT', 'REANIMATED'],
  ['INERT', 'INERT', 'ENERGETICALLY'], ['FALSE', 'FALSE', 'FAITHFULNESS'], ['ANGER', 'IRE', 'MERRIER'],
  ['FEAR', 'PANIC', 'PLACATING'], ['CHAOS', 'MESS', 'MASTERMINDS'], ['CHAOS', 'RIOT', 'ORGANIZATION'],
  ['CRUELTY', 'SPITE', 'SYMPATHETIC'], ['ROT', 'TAINT', 'SANITATION'], ['INERT', 'TIRE', 'STIRRED'],
  ['FALSE', 'LIE', 'REALITIES'], ['STINGY', 'STINGY', 'GENEROSITY'], ['INERT', 'IDLE', 'ENLIVENED'],
  ['CHAOS', 'MESS', 'SEAMLESS'], ['FALSE', 'FALLACY', 'FACTUALLY'], ['FALSE', 'DECEIVE', 'EVIDENCE'],
] as const

export function dailyBingoTheme(enemy: string, bingo: string): string {
  return candidates.find(row => row[1] === enemy && row[2] === bingo)?.[0] ?? enemy
}

export function dailyBingoProfiles(): BingoProfile[] {
  return candidates.map(([source, enemy, bingo]) => {
    const base = bingoProfiles.find(profile => profile.enemy === source)
    let profile: BingoProfile
    if (base) profile = { ...base, enemy, bingo }
    else {
      const previous = classic[source as keyof typeof classic]
      const roots = Object.entries(previous.relations).filter(([, item]) => ['opposite', 'similar'].includes(item.relation))
        .map(([word, item]) => ({ word, senseId: item.senseId, definition: item.definition, relation: item.relation }))
      profile = { enemy, bingo, enemySense: '', roots,
        hints: [], explanation: '', excludedWordSenses: [],
        excludedDerivations: [...Object.keys(previous.reviewedExclusions), ...Object.keys(previous.reviewedSenseExclusions)] }
    }
    const pin = profile.roots.find(root => root.word === enemy && root.relation === 'similar')
    const candidates = getWordMeanings(enemy).senses
    const sense = pin ? getMeaningSense(pin.senseId) : candidates.find(sense =>
      source === 'ANGER' ? /anger|angry/.test(sense.definition)
      : source === 'FEAR' ? /fear|fright|anxi/.test(sense.definition)
      : source === 'CHAOS' ? /disorder|confus|uproar/.test(sense.definition)
      : source === 'CRUELTY' ? /cruel|harm|hurt|suffer/.test(sense.definition) : false)
    if (!sense) throw new Error(`Pin a reviewed enemy sense for ${enemy}.`)
    profile.enemySense = sense.id
    return profile
  })
}
