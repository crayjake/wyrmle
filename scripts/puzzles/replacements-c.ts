import type { HuntProfile } from '../antonyms/huntProfiles.ts'
import type { ConceptProfile } from '../antonyms/profiles.ts'

type Draft = Omit<ConceptProfile, 'letters' | 'refills' | 'powers' | 'routes' | 'wordOnly' | 'overrides' | 'hints'> & {
  helpers: [string, string]; hints: [string, string]; padding?: string;
  wordOnly?: string[]; overrides?: ConceptProfile['overrides']
}
function reviewed(draft: Draft): HuntProfile {
  const { helpers, padding = 'AEIORSTN', ...profile } = draft
  let letters = profile.bingo
  for (const word of helpers) {
    const counts: Record<string, number> = {}
    for (const letter of word) {
      counts[letter] = (counts[letter] ?? 0) + 1
      if ([...letters].filter(value => value === letter).length < counts[letter]) letters += letter
    }
  }
  for (let index = 0; letters.length < 16; index++) letters += padding[index % padding.length]
  return { helpers, preferredHelpers: helpers, profile: { ...profile, letters,
    hints: [...draft.hints, `${profile.bingo.length} letters, beginning with ${profile.bingo[0]}.`],
    refills: '', powers: [], routes: [], wordOnly: draft.wordOnly ?? [], overrides: draft.overrides ?? {} } }
}

export const replacementProfilesC: HuntProfile[] = [
  reviewed({ id: 'sure-precarious', enemy: 'SURE', definition: 'secure and dependable, like a firm foothold',
    sense: 'oewn-sure__5.00.00.secure.02', bingo: 'PRECARIOUS', helpers: ['RISKY', 'SHAKY'], padding: 'DLT',
    roots: ['oewn-precarious__5.00.00.insecure.02', 'oewn-precarious__5.00.00.dangerous.00',
      'oewn-risky__5.00.00.dangerous.00', 'oewn-unsafe__3.00.02..', 'oewn-unsafe__3.00.00..',
      'oewn-insecure__3.00.03..', 'oewn-shaky__5.00.00.insecure.02', 'oewn-unstable__3.00.00..',
      'oewn-dicey__5.00.00.dangerous.00', 'oewn-rickety__5.00.00.unstable.00',
      'oewn-rocky__5.00.00.unstable.00', 'oewn-tipsy__5.00.00.unstable.00', 'oewn-hairy__5.00.00.alarming.00'],
    review: 'SURE uses secure footing, not confident belief or inevitable events. PRECARIOUS means insecure and liable to fail; RISKY, DICEY, PERILOUS and HAIRY involve danger. SHAKY, RICKETY, ROCKY and TIPSY use unstable footing or support, not drunkenness or a rocky landscape. All accepted readings are adjectives; financial and mental-health senses are excluded.',
    hints: ['Think of a position where one small slip could be disastrous.', 'It is insecure, as though it might give way at any moment.'],
  }),
  reviewed({ id: 'true-fraudulent', enemy: 'TRUE', definition: 'genuine; really what it claims to be',
    sense: 'oewn-true__5.00.00.real.02', bingo: 'FRAUDULENT', helpers: ['FAKE', 'FALSE'], padding: 'CHOI',
    roots: ['oewn-fraudulent__5.00.00.dishonest.00', 'oewn-counterfeit__3.00.00..', 'oewn-fake__5.00.00.counterfeit.00', 'oewn-fake__5.00.00.artificial.00',
      'oewn-false__5.00.00.artificial.00', 'oewn-false__5.00.00.counterfeit.00', 'oewn-mock__5.00.00.counterfeit.00',
      'oewn-forged__5.00.00.counterfeit.00', 'oewn-sham__5.00.00.counterfeit.00', 'oewn-unreal__3.00.04..'],
    review: 'TRUE is genuine rather than an imitation, not a loyal person. FRAUDULENT involves deception, as in a fraudulent certificate; FAKE and FALSE describe a misleading imitation. UNREAL means artificial rather than genuine. Every accepted reading is an adjective; the noun copy and verb forge do not qualify.',
    hints: ['Think of an imitation passed off as the real thing.', 'It describes something false that is intended to deceive.'],
  }),
  reviewed({ id: 'wrong-working', enemy: 'WRONG', definition: 'not functioning properly',
    sense: 'oewn-wrong__5.00.00.malfunctioning.00', bingo: 'WORKING', helpers: ['RIGHT', 'FINE'], padding: 'ASDU',
    roots: ['oewn-working__5.00.00.functioning.00', 'oewn-functioning__3.00.00..', 'oewn-functional__5.00.00.functioning.00',
      'oewn-fine__5.00.00.satisfactory.00', 'oewn-right__5.00.00.satisfactory.00', 'oewn-sound__3.00.01..', 'oewn-okay__5.00.00.satisfactory.00', 'oewn-strong__5.00.00.sound.01', 'oewn-fit__3.00.02..', 'oewn-sure__5.00.00.reliable.00'],
    wordOnly: ['oewn-fine__5.00.00.satisfactory.00', 'oewn-right__5.00.00.satisfactory.00', 'oewn-sound__3.00.01..', 'oewn-okay__5.00.00.satisfactory.00', 'oewn-strong__5.00.00.sound.01', 'oewn-fit__3.00.02..', 'oewn-sure__5.00.00.reliable.00'],
    review: 'WRONG concerns faulty equipment, as in something wrong with the motor. WORKING means operating correctly. RIGHT and FINE describe satisfactory condition; SOUND and STRONG use defect-free construction. FIT is adequate for its purpose and SURE is reliable in operation. Directional RIGHT, moral rightness, noise SOUND and the work verb are outside these adjective readings.',
    hints: ['Think of a machine that does its job properly.', 'It is operating as it should.'],
  }),
  reviewed({ id: 'one-sectional', enemy: 'ONE', definition: 'united as a single whole',
    sense: 'oewn-one__5.00.00.united.00', bingo: 'SECTIONAL', helpers: ['SPLIT', 'TORN'], padding: 'UHFGB',
    roots: ['oewn-sectional__5.00.00.divided.00', 'oewn-split__5.00.00.divided.00', 'oewn-torn__5.00.00.divided.00',
      'oewn-divided__3.00.00..', 'oewn-separate__3.00.00..', 'oewn-cut__3.00.01..',
      'oewn-cleft__5.00.00.divided.00', 'oewn-isolated__5.00.01.separate.00', 'oewn-discrete__5.00.00.separate.00'],
    wordOnly: ['oewn-cut__3.00.01..', 'oewn-isolated__5.00.01.separate.00', 'oewn-discrete__5.00.00.separate.00'],
    overrides: { CUTER: { sense: 'oewn-cute__5.00.00.attractive.01', relation: 'unrelated', reason: 'CUTER is more attractive, not more divided.' } },
    review: 'ONE uses unity, as in acting as one, not the number. SECTIONAL is divided into sections; SPLIT and TORN have their unity broken. DIVIDED, SEPARATE and CLEFT remain adjectives. A sectional sofa noun and the act of splitting are not the accepted meanings.',
    hints: ['Think of something divided into distinct parts.', 'Each part forms its own section.'],
  }),

  reviewed({ id: 'hire-discharge', enemy: 'HIRE', definition: 'employ someone to do a job',
    sense: 'oewn-hire__2.41.00..', bingo: 'DISCHARGE', helpers: ['FIRE', 'SACK'], padding: 'XOMTN',
    roots: ['oewn-discharge__2.41.01..', 'oewn-fire__2.41.00..', 'oewn-sack__2.41.00..',
      'oewn-dismiss__2.41.00..', 'oewn-cashier__2.41.00..', 'oewn-can__2.41.00..',
      'oewn-axe__2.30.00..', 'oewn-ax__2.30.00..'],
    overrides: { CANED: { sense: 'oewn-cane__2.35.00..', relation: 'unrelated', reason: 'CANED means beaten with a cane. The past tense of CAN as dismiss is CANNED.' } },
    wordOnly: ['oewn-discharge__2.41.01..', 'oewn-cashier__2.41.00..', 'oewn-axe__2.30.00..', 'oewn-ax__2.30.00..'],
    review: 'HIRE is engaging an employee. DISCHARGE, FIRE, SACK and DISMISS release that employee from their work. CASHIER is dismissal from military employment. All readings are verbs; the retail CASHIER noun and firing weapons are excluded.',
    hints: ['Think of releasing someone from their job.', 'This verb also describes formally releasing someone from a duty.'],
  }),
  reviewed({ id: 'aerial-material', enemy: 'AERIAL', definition: 'airy and insubstantial, as though impossible to touch',
    sense: 'oewn-aerial__5.00.00.insubstantial.00', bingo: 'MATERIAL', helpers: ['REAL', 'SOLID'], padding: 'NCUHG',
    roots: ['oewn-material__3.00.03..', 'oewn-material__3.00.04..', 'oewn-material__3.00.01..',
      'oewn-real__3.00.03..', 'oewn-solid__3.00.01..', 'oewn-solid__5.00.00.serious.00',
      'oewn-physical__5.00.00.material.01', 'oewn-concrete__3.00.00..', 'oewn-tangible__3.00.00..'],
    wordOnly: ['oewn-solid__3.00.01..', 'oewn-solid__5.00.00.serious.00', 'oewn-concrete__3.00.00..', 'oewn-tangible__3.00.00..'],
    review: 'AERIAL uses the airy, insubstantial adjective rather than situated in the sky or a radio antenna. MATERIAL has physical substance. REAL and SOLID explicitly mean substantial rather than imaginary or intangible. All counters are adjectives, not cloth MATERIAL or real-number nouns.',
    hints: ['Think of something with a real physical substance.', 'It is made of matter, rather than being airy or intangible.'],
  }),
]
