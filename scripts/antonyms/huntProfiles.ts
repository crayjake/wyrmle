import { antonymProfiles } from './profiles.ts'
import type { ConceptProfile } from './profiles.ts'

export type HuntProfile = {
  profile: ConceptProfile
  helpers: [string, string]
  preferredHelpers: string[]
  progressRevision?: string
}

const defaults = { refills: '', powers: [], routes: [], wordOnly: [], overrides: {} }

/** A fresh Daily debut; keep this answer out of the preview selector. */
export const tomorrowHunt: HuntProfile = {
  helpers: ['YOUNG', 'TEEN'], preferredHelpers: ['YOUNG', 'TEEN', 'TEENAGE', 'TENDER'],
  profile: { ...defaults, id: 'old', enemy: 'OLD', definition: 'having lived for a long time; advanced in age',
    sense: 'oewn-old__3.00.02..', bingo: 'ADOLESCENT', letters: 'ADOLESCENTYUGEBR',
    roots: ['oewn-young__3.00.00..', 'oewn-adolescent__5.00.00.young.00',
      'oewn-teen__5.00.00.young.00', 'oewn-teenage__5.00.00.young.00', 'oewn-juvenile__3.01.00..',
      'oewn-tender__5.00.00.young.00', 'oewn-early__5.00.00.young.00',
      'oewn-underage__3.00.00..', 'oewn-underage__5.00.00.dependent.00'],
    overrides: {
      TEENAGER: { sense: 'oewn-teenager__1.18.00..', relation: 'unrelated',
        reason: 'A noun for a young person, not a comparative of the adjective TEENAGE.' },
      TEENER: { sense: 'oewn-teenager__1.18.00..', relation: 'unrelated',
        reason: 'A noun for a teenager, not a comparative adjective meaning more TEEN.' },
    },
    review: 'Age of a person, not age of an object or how recently it was acquired. Young, teen, teenage and adolescent are adjectives for an early stage of life. Tender and early use their young-age readings; underage denotes youth. Adolescent also has a noun reading, but this puzzle pins its adjective sense. TEENAGER and TEENER are nouns, not adjective comparatives manufactured by suffix stripping. New, recent and unused do not oppose the displayed personal-age sense.',
    hints: ['Think of the years between childhood and adulthood.', 'This adjective describes someone still growing up.', 'Ten letters, beginning with A.'],
  },
}

/** Bingo-first boards: reserve the answer copies, add familiar antonyms, then
 * let planHuntRemovals exhaustively choose which spare letters disappear. */
export const huntProfiles: HuntProfile[] = [
  { profile: antonymProfiles.find(profile => profile.id === 'alert')!, helpers: ['SLOW', 'INERT'],
    preferredHelpers: ['SLOW', 'TIRED', 'IDLE', 'INERT'], progressRevision: '215093c7c262' },
  { profile: antonymProfiles.find(profile => profile.id === 'true')!, helpers: ['WRONG', 'UNREAL'],
    preferredHelpers: ['WRONG', 'UNREAL', 'INCORRECT'], progressRevision: '5f7f54a6985b' },
  {
    helpers: ['DRY', 'ARID'], preferredHelpers: ['DRY', 'ARID', 'PARCHED'],
    profile: { ...defaults, id: 'wet', enemy: 'WET', definition: 'containing water or moisture',
      sense: 'oewn-wet__3.00.05..', bingo: 'WATERLESS', letters: 'WATERLESSDYIPCHR',
      roots: ['oewn-waterless__5.00.00.dry.01', 'oewn-dry__3.00.01..', 'oewn-dry__3.00.05..',
        'oewn-arid__5.00.00.dry.01', 'oewn-parched__5.00.00.dry.01', 'oewn-sere__5.00.00.dry.01',
        'oewn-dried__5.00.00.dry.01', 'oewn-desiccated__5.00.00.dry.01', 'oewn-hard__5.00.00.stale.00'],
      wordOnly: ['oewn-hard__5.00.00.stale.00'],
      review: 'Literal moisture only. Dry, arid, parched, dried and waterless are adjective opposites. Sere and sear have the same dry-vegetation adjective reading. Do not admit dryness nouns, drying verbs, or the alcohol and humour senses of dry.',
      hints: ['Think of a place where nothing could get a drink.', 'An adjective saying that a particular liquid is absent.', 'Nine letters, beginning with W.'],
    },
  },
  {
    helpers: ['QUIET', 'SILENT'], preferredHelpers: ['QUIET', 'LOW', 'SILENT', 'HUSHED', 'MUTE', 'MUTED'],
    profile: { ...defaults, id: 'loud', enemy: 'LOUD', definition: 'making a lot of noise; high in volume',
      sense: 'oewn-loud__3.00.00..', bingo: 'SOUNDLESS', letters: 'SOUNDLESSQITWMHH',
      roots: ['oewn-soundless__5.00.00.quiet.01', 'oewn-quiet__3.00.01..', 'oewn-quiet__5.00.00.soft.04',
        'oewn-low__5.00.00.soft.04', 'oewn-soft__3.00.04..', 'oewn-hushed__5.00.00.soft.04',
        'oewn-silent__5.00.00.quiet.01', 'oewn-noiseless__5.00.00.quiet.01',
        'oewn-muted__5.00.00.soft.04', 'oewn-muted__5.00.02.soft.04', 'oewn-mute__5.00.00.inarticulate.00',
        'oewn-thin__3.00.04..'],
      wordOnly: ['oewn-mute__5.00.00.inarticulate.00', 'oewn-thin__3.00.04..'],
      review: 'Sound volume only. Low means low volume, not low pitch or height; muted and hushed mean softened sound. Mute uses expressed without speech, not disability. Silent and soundless denote an absence of sound. Loud clothing, quiet water and shy personalities are outside the displayed sense.',
      hints: ['Think of a scene you could watch but not hear.', 'The word describes a complete absence of noise.', 'Nine letters, beginning with S.'],
    },
  },
  {
    helpers: ['BRIGHT', 'LIT'], preferredHelpers: ['BRIGHT', 'LIGHT', 'LIT', 'RADIANT', 'ALIGHT'],
    profile: { ...defaults, id: 'dim', enemy: 'DIM', definition: 'lacking light; not bright',
      sense: 'oewn-dim__5.00.00.dark.01', bingo: 'ILLUMINATED', letters: 'ILLUMINATEDBRGHA',
      roots: ['oewn-illuminated__5.00.00.light.06', 'oewn-lit__5.00.00.light.06', 'oewn-light__3.00.06..',
        'oewn-bright__3.00.00..', 'oewn-bright__5.00.00.light.06', 'oewn-bright__3.00.02..',
        'oewn-radiant__5.00.00.bright.00', 'oewn-alight__5.00.00.lighted.00', 'oewn-aglow__5.00.00.bright.00',
        'oewn-brilliant__5.00.00.bright.00', 'oewn-ardent__5.00.00.bright.00', 'oewn-lurid__5.00.00.bright.00'],
      overrides: { LITER: { sense: 'oewn-liter__1.23.00..', relation: 'unrelated',
        reason: 'LITER is a noun for a unit of volume, not a comparative adjective of LIT or LITE.' } },
      review: 'Literal light levels. Illuminated and lit describe something supplied with light; bright, radiant and light are light-emitting or well-lit adjectives. Intelligence, hope, light weight and light colours are not the chosen readings. LIGHT as a verb is not the counter reading. LITER is a volume-unit noun, not more LIT: suffix stripping must not manufacture an adjective sense.',
      hints: ['Think of a building after its lamps have been switched on.', 'This can also describe a decorated medieval manuscript.', 'Eleven letters, beginning with I.'],
    },
  },
  {
    helpers: ['THICK', 'DENSE'], preferredHelpers: ['THICK', 'DENSE', 'VISCOUS', 'HEAVY'],
    profile: { ...defaults, id: 'thin', enemy: 'THIN', definition: 'watery in consistency or low in density',
      sense: 'oewn-thin__3.00.02..', bingo: 'THICKENED', letters: 'THICKENEDSSOUVAY',
      roots: ['oewn-thickened__5.00.00.thick.02', 'oewn-thick__3.00.02..',
        'oewn-viscous__5.00.00.thick.02', 'oewn-dense__5.00.00.heavy.01', 'oewn-heavy__3.00.01..'],
      wordOnly: ['oewn-dense__5.00.00.heavy.01', 'oewn-heavy__3.00.01..'],
      review: 'Consistency and density, not body shape or the width of a solid. Thickened is an adjective meaning made thick in consistency. Thick and viscous oppose watery; dense and heavy use high density. Sticky alone is not the opposite of thin, and the verb THICKEN is not an adjective.',
      hints: ['Think of what happens to a runny sauce as it cooks down.', 'An adjective for its changed consistency.', 'Nine letters, beginning with T.'],
    },
  },
  {
    helpers: ['LITTLE', 'TINY'], preferredHelpers: ['LITTLE', 'TINY', 'MINUTE', 'TEENY', 'BITTY'],
    profile: { ...defaults, id: 'big', enemy: 'BIG', definition: 'large in size or amount',
      sense: 'oewn-big__3.00.01..', bingo: 'NEGLIGIBLE', letters: 'NEGLIGIBLETTYMUS',
      roots: ['oewn-negligible__5.00.00.minimal.00', 'oewn-small__3.00.00..', 'oewn-little__3.00.01..',
        'oewn-tiny__5.00.00.small.00', 'oewn-minute__5.00.00.small.00',
        'oewn-teeny__5.00.00.small.00', 'oewn-bitty__5.00.00.small.00',
        'oewn-slim__5.00.00.small.00', 'oewn-stingy__3.00.02..'],
      wordOnly: ['oewn-stingy__3.00.02..'],
      supplemental: { MINI: { definition: 'Miniature; tiny or small.', lemma: 'mini', partOfSpeech: 'adjective',
        senseId: 'wiktionary-en:mini:adjective:1:92689945', sourceUrl: 'https://en.wiktionary.org/w/index.php?oldid=92689945&title=mini' } },
      review: 'Size and amount only. Negligible means so small as to be insignificant, not merely worthless. Minute is the adjective meaning tiny, not a unit of time. Little and tiny use smallness, not youth. Slim and stingy use small quantity, not body shape or personality. MINI uses the independently sourced miniature adjective sense, rather than borrowing the short-skirt reading.',
      hints: ['Think of an amount too small to make much difference.', 'It is so slight that you could ignore it in a calculation.', 'Ten letters, beginning with N.'],
    },
  },
]

/** Separate comparisons: armour is optional, and existing hunts keep their saves. */
export const armouredHuntProfiles: HuntProfile[] = [
  { id: 'wet', armour: { 1: 2 } },
  { id: 'dim', armour: { 1: 2 } },
  { id: 'big', armour: { 1: 2, 2: 2 } },
].map(({ id, armour }) => {
  const source = huntProfiles.find(hunt => hunt.profile.id === id)!
  return { ...source, profile: { ...source.profile, id: `${id}-armoured`, armour } }
})

export const allHuntProfiles = [...huntProfiles, ...armouredHuntProfiles]
