import { antonymProfiles } from '../antonyms/profiles.ts'
import { allHuntProfiles, tomorrowHunt } from '../antonyms/huntProfiles.ts'
import type { HuntProfile } from '../antonyms/huntProfiles.ts'
import newProfiles from '../antonyms/newProfiles.json' with { type: 'json' }
import type { ConceptProfile } from '../antonyms/profiles.ts'

/** A reviewed registry, not a claim that arbitrary dictionary neighbours oppose each other. */
export const avoidsLessAnswer = (word: string) => !/LESS(?:NESS(?:ES)?|LY)?$/.test(word.toUpperCase())
const plain = (profile: ConceptProfile): ConceptProfile => ({ ...profile, refills: '', powers: [], routes: [] })
export const puzzleProfiles: HuntProfile[] = [
  tomorrowHunt, ...allHuntProfiles.filter(item => avoidsLessAnswer(item.profile.bingo)).map(item => ({ ...item, profile: plain(item.profile) })),
  { profile: plain(antonymProfiles.find(p => p.id === 'stern')!), helpers: ['WARM', 'NICE'], preferredHelpers: ['WARM', 'NICE'] },
  { profile: { ...plain((newProfiles as unknown as ConceptProfile[]).find(p => p.id === 'dear')!), letters: 'AFFORDABLEHCPWES' },
    helpers: ['CHEAP', 'LOW'], preferredHelpers: ['CHEAP', 'LOW', 'FREE'] },
  { helpers: ['HARSH', 'INTENSE'], preferredHelpers: ['HARSH', 'STERN', 'INTENSE'],
    profile: { id: 'gentle-armoured', enemy: 'GENTLE', definition: 'mild; not harsh, stern or severe',
      sense: 'oewn-gentle__5.00.00.mild.00', bingo: 'UNRELENTING', letters: 'UNRELENTINGHARSH',
      armour: { 2: 3 }, refills: '', powers: [], routes: [], overrides: {},
      roots: ['oewn-unrelenting__5.00.00.intense.00', 'oewn-harsh__5.00.01.unpleasant.00',
        'oewn-harsh__5.00.00.heavy.03', 'oewn-harsh__5.00.00.disagreeable.00',
        'oewn-stern__5.00.00.nonindulgent.00', 'oewn-stern__5.00.00.demanding.01',
        'oewn-intense__5.00.00.sharp.04', 'oewn-severe__5.00.00.intense.00',
        'oewn-strict__3.00.00..', 'oewn-strict__5.00.00.demanding.01'],
      wordOnly: ['oewn-harsh__5.00.00.heavy.03', 'oewn-harsh__5.00.00.disagreeable.00'],
      review: 'GENTLE uses mild rather than harsh, stern or severe, not a shallow slope, nobility or a tame animal. UNRELENTING is pinned to punishingly harsh, not merely never-ceasing. HARSH, STERN and INTENSE use severe treatment or conditions. Every accepted counter is an adjective. Triple N is a copy requirement, never accumulated damage.',
      hints: ['Think of harsh treatment that gives you no relief.', 'It describes pressure that refuses to ease.', 'Eleven letters, beginning with U.'],
    } },
]
