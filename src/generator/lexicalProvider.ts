import { getPartsOfSpeech, isDictionaryWord, normalizeWord, prototypeWordPartsOfSpeech } from '../game/dictionary.ts'
import type { PartOfSpeech } from '../game/types.ts'
import { enrichSemanticRelations } from '../game/lexicalRules.ts'
import { getLexicalPartsOfSpeech, LEXICON_VERSION } from '../lexicon/index.ts'

export type LexicalEntry = {
  word: string
  partsOfSpeech: readonly PartOfSpeech[]
  definition: string
  synonyms: readonly string[]
  counters: readonly string[]
  related: readonly string[]
  /** Familiarity proxy in [0, 1]; commonnessSource distinguishes corpus and editorial estimates. */
  commonness: number | null
  commonnessSource: 'curated-estimate' | 'corpus-frequency' | 'unknown'
  semanticSource: 'curated-local' | 'dictionary-only' | 'curated-and-wordnet' | 'offline-model'
  semanticConfidence: number
  properNoun?: boolean
}

/** Generation-time discovery boundary. Encounters serialize its results. */
export interface LexicalProvider {
  readonly id: string
  getEntry(word: string): LexicalEntry | undefined
  /** Submitted words can use every POS even when an enemy has one authored sense. */
  getSubmittedWordEntry?(word: string): LexicalEntry | undefined
  enemyWords(): readonly string[]
  vocabulary(): readonly LexicalEntry[]
}

type EnemySeed = {
  definition: string
  partOfSpeech: PartOfSpeech
  commonness: number
  synonyms: string
  counters: string
  related: string
}

// Small, inspectable semantic senses, authored here rather than obtained from
// a runtime service. Counters include ordinary antidotes to a concept (COMEDY
// against MELANCHOLY), not just strict dictionary antonyms. Related words stay
// neutral: HARMONY, for example, is not mislabeled as sadness's antonym.
const enemySeeds: Readonly<Record<string, EnemySeed>> = {
  MELANCHOLY: {
    definition: 'A lingering, thoughtful feeling of sadness.',
    partOfSpeech: 'noun', commonness: 0.78,
    synonyms: 'SAD SADNESS GLOOM GLOOMY GRIEF SORROW BLUE MISERY MOROSE MOURNFUL SORROWFUL DOLEFUL DOWNCAST DESOLATE UNHAPPY DEPRESSION DEPRESSED',
    counters: 'JOY CHEER HAPPY DELIGHT ELATED MERRY GLAD CHEERY JOLLY CHEERFUL JOYFUL ELATION HAPPINESS CHEERINESS CHEERFULNESS MERRIMENT JOLLITY MIRTH MIRTHFUL AMUSEMENT AMUSED COMEDY COMICAL COMICALLY LAUGHTER LAUGH HILARITY HILARIOUS HAPPILY JOYFULLY JOYOUS JOYOUSLY SUNNY BLISS BLISSFUL EUPHORIA PLAYFUL PLAYFULLY JOVIAL GLEE GLEEFUL',
    related: 'TEARS CRY LONELY MOOD HEART MEMORY MEMORIES COMFORT HOPE HOPEFUL HARMONY SOLEMN SADLY TRAGIC TRAGEDY',
  },
  DESPAIR: {
    definition: 'The feeling that there is no hope of things getting better.',
    partOfSpeech: 'noun', commonness: 0.86,
    synonyms: 'HOPELESS HOPELESSNESS MISERY DESOLATE GLOOM DEPRESSION SADNESS SORROW',
    counters: 'HOPE HOPEFUL HOPEFULLY OPTIMISM OPTIMISTIC CONFIDENT CONFIDENCE COURAGE CHEER CHEERFUL JOY HAPPY ELATION COMFORT ENCOURAGE ENCOURAGEMENT',
    related: 'FEAR WORRY TEARS CRY HEART RESCUE HELP PATIENCE COMFORTING LONELY',
  },
  ANGER: {
    definition: 'A strong feeling of displeasure or hostility.',
    partOfSpeech: 'noun', commonness: 0.97,
    synonyms: 'RAGE FURY IRE IRATE FURIOUS WRATH ENRAGED IRRITATION IRRITATED',
    counters: 'CALM PEACE PEACEFUL SERENE SERENITY PATIENCE PATIENT GENTLE GENTLENESS SOOTHE SOOTHING PACIFY FORGIVE FORGIVENESS KIND KINDNESS MERCY',
    related: 'ARGUE ARGUMENT HEAT FIRE SHOUT CONFLICT AGITATION HURT',
  },
  CHAOS: {
    definition: 'A state of complete confusion and lack of order.',
    partOfSpeech: 'noun', commonness: 0.91,
    synonyms: 'CONFUSION DISORDER TURMOIL BEDLAM ANARCHY MESS MAYHEM DISARRAY',
    counters: 'ORDER ORDERLY STRUCTURE SYSTEM STABILITY BALANCE CONTROL CLARITY ARRANGE ARRANGEMENT NEAT TIDY ORGANISED ORGANIZED HARMONY CALM PEACE SORT SORTED',
    related: 'CHANGE NOISE STORM CROWD MOTION PATTERN RULE PLAN',
  },
  CRUELTY: {
    definition: 'Behaviour that deliberately causes pain or suffering.',
    partOfSpeech: 'noun', commonness: 0.84,
    synonyms: 'CRUEL BRUTAL BRUTALITY MALICE MALICIOUS VIOLENCE VICIOUS HARSH HARSHNESS',
    counters: 'KIND KINDLY KINDNESS GENTLE GENTLENESS EMPATHY BENEVOLENCE COMPASSION COMPASSIONATE BENEVOLENT HUMANE HUMANITY FRIENDLY CARING CARE TENDER TENDERNESS MERCIFUL MERCY HELP COMFORT',
    related: 'HARM HURT PAIN TEARS FEAR JUSTICE ANGER HEART',
  },
  FEAR: {
    definition: 'An unpleasant feeling caused by danger or the thought of danger.',
    partOfSpeech: 'noun', commonness: 0.98,
    synonyms: 'TERROR DREAD FRIGHT PANIC ANXIETY WORRY SCARED AFRAID TIMID',
    counters: 'COURAGE BRAVERY BRAVE BOLD BOLDLY COURAGEOUS HEROISM HEROIC DARING VALOUR VALOR CONFIDENT CONFIDENCE CALM REASSURE REASSURANCE',
    related: 'DANGER RISK THREAT NIGHT SHADOW SAFETY RESCUE HOPE',
  },
}

const splitWords = (words: string): string[] => [...new Set(words.split(/\s+/).filter(Boolean).map(normalizeWord))]

// Familiarity bands are an explicit editorial calibration: 0.9+ very familiar,
// 0.7–0.89 ordinary, 0.5–0.69 less frequent but fair, below 0.5 specialist/rare.
// Unknown dictionary entries are never silently assigned to a low band.
const vocabularyGroups: readonly [readonly PartOfSpeech[], number, string][] = [
  [['adjective'], 0.9, 'HAPPY SAD GLAD CHEERY JOLLY CHEERFUL JOYFUL MERRY SUNNY PLAYFUL GLOOMY LONELY UNHAPPY HOPEFUL PEACEFUL GENTLE FURIOUS IRATE KIND CRUEL BRAVE BOLD AFRAID SCARED TIMID NEAT TIDY FRIENDLY TENDER HARSH QUICK SLOW SMALL LARGE GREEN RED YELLOW WHITE BLACK SOFT HARD WARM COLD OLD YOUNG EARLY LATE HEAVY LIGHTER SILLY FUNNY LOVELY CLEAR CLEVER SWEET SOUR SALTY SANDY STORMY DREAMY STEADY HEARTY HOMELY WOODEN GOLDEN WOOLLY WINDY RAINY CLOUDY SNOWY SILKY SLEEPY HUNGRY THIRSTY ANGRY HEALTHY HELPFUL HONEST HUMBLE HUMANE OPTIMISTIC CONFIDENT PATIENT COMICAL'],
  [['adjective'], 0.73, 'COMELY LOAMY MOURNFUL SORROWFUL DOLEFUL MOROSE DOWNCAST DESOLATE JOYOUS JOVIAL GLEEFUL MIRTHFUL BLISSFUL HILARIOUS SERENE ORDERLY BRUTAL MALICIOUS VICIOUS MERCIFUL COURAGEOUS HEROIC COMPASSIONATE BENEVOLENT SOLEMN TRAGIC HOPELESS'],
  [['adverb'], 0.84, 'HAPPILY JOYFULLY JOYOUSLY COMICALLY PLAYFULLY HOPEFULLY BOLDLY SADLY QUICKLY SOFTLY SLOWLY CALMLY KINDLY NEARLY CLEARLY SAFELY EASILY REALLY ONLY'],
  [['noun'], 0.91, 'SADNESS GRIEF MISERY DEPRESSION HAPPINESS CHEERFULNESS AMUSEMENT COMEDY LAUGHTER HOPELESSNESS OPTIMISM CONFIDENCE COURAGE PATIENCE SERENITY GENTLENESS FORGIVENESS KINDNESS IRRITATION CONFUSION STABILITY CLARITY ARRANGEMENT BRUTALITY VIOLENCE HARSHNESS EMPATHY COMPASSION HUMANITY TENDERNESS BRAVERY HEROISM ANXIETY DANGER SAFETY JUSTICE MOOD MEMORY MEMORIES TRAGEDY ANGER CRUELTY FEAR DESPAIR CHAOS MELANCHOLY RISK THREAT SHADOW MORNING EVENING NIGHT TODAY TOMORROW COFFEE TEA HONEY MONEY LEMON MELON APPLE PEAR CHERRY ORANGE ONION CLOSET CHAIR TABLE SHELF WINDOW GARDEN FLOWER LEAF WATER RIVER OCEAN STREAM CLOUD STONE SAND CLAY LOAM EARTH METAL GOLD SILVER WOOL YARN THREAD NEEDLE CLOTH SHIRT COAT SHOE SCHOOL LESSON STORY POEM RHYME MELODY HARMONY MUSIC PIANO SONG NAME HOME FAMILY FRIEND MOTHER FATHER CHILD CHILDREN MAN WOMAN HUMAN ANIMAL CAT DOG HEN OWL LION LAMB HORSE MOUSE YEAR MONTH DAY HOUR MINUTE LETTER WORD PAGE BOOK CHAPTER LINE NUMBER COLOUR COLOR LIGHT DARKNESS HAND HAIR HEAD HEART MIND SOUL LIFE DEATH MOUTH TOOTH MOON SUN STAR SKY SNOW RAIN WIND STORM SUMMER WINTER AUTUMN SPRING SEASON FOOD MEAL BREAD TOAST CREAM CHEESE CHOCOLATE PLATE DISH SPOON KNIFE FORK CAR TRAIN PLANE WHEEL ROAD PATH LANE LAND HILL VALLEY FIELD FOREST WOOD TEAM GAME MATCH SCORE GOAL WORK JOB TASK TIME THING PLACE SIDE END PART MAYHEM DISARRAY ANARCHY BEDLAM TURMOIL FURY IRE WRATH MALICE MERCY FRIGHT TERROR VALOUR VALOR ENCOURAGEMENT REASSURANCE CONTENTMENT ARGUMENT AGITATION'],
  [['noun'], 0.73, 'ELATION CHEERINESS MERRIMENT JOLLITY MIRTH HILARITY BLISS EUPHORIA GLEE BENEVOLENCE PEACE'],
  [['noun', 'verb'], 0.91, 'JOY CHEER DELIGHT GLOOM SORROW LAUGH HOPE COMFORT CARE HELP HARM HURT PAIN TEARS CRY RAGE ORDER STRUCTURE SYSTEM BALANCE CONTROL DISORDER MESS SORT CHANGE NOISE CROWD MOTION PATTERN RULE PLAN PANIC WORRY DREAD HEAT FIRE SHOUT CONFLICT SMILE RESCUE REACH TOUCH HOLD PLAY WALK RUN REST SLEEP DREAM DANCE SING ROLL TELL HEAL CHARM CLEAN TREAT TEAR MEND SHAPE SHARE COOK LOOK SMELL TASTE SOUND NOTE POST SEAL DEAL HALL CANE NAIL COIL COAL CHAIN CLAIM LEAN LOAN MEAN NEAR LEARN TEACH CLIMB CHIME CARRY ALARM TEACHER'],
  [['verb'], 0.86, 'SOOTHE PACIFY FORGIVE ARRANGE REASSURE ENCOURAGE ARGUE ENJOY BECOME BELONG GATHER FOLLOW CHOOSE SOLVE DISCOVER REMAIN REMEMBER'],
  [['adjective', 'verb'], 0.87, 'ELATED AMUSED DEPRESSED IRRITATED ENRAGED ORGANISED ORGANIZED SORTED DARING CARING SOOTHING COMFORTING SMILING LAUGHING'],
  [['adjective', 'noun', 'verb'], 0.87, 'CALM BLUE LIGHT CLEAN'],
]

const familiarityOverrides: Readonly<Record<string, number>> = {
  MELANCHOLY: 0.78, COMELY: 0.6, LOAMY: 0.56, HOMELY: 0.76, DOLEFUL: 0.62,
  MOROSE: 0.67, JOLLITY: 0.57, MIRTHFUL: 0.6, IRE: 0.61, VALOUR: 0.69, VALOR: 0.69,
  JOVIAL: 0.75, COMICALLY: 0.78, COMICAL: 0.82, ELATION: 0.78, MERRIMENT: 0.72,
  GLEE: 0.8, BENEVOLENCE: 0.69, BENEVOLENT: 0.72, CHEERINESS: 0.65,
}

// Preserve ambiguity where common uses cross grammatical categories. We do
// not award the adjective bonus merely because a word can be an adjective.
const partOfSpeechOverrides: Readonly<Record<string, readonly PartOfSpeech[]>> = {
  EARLY: ['adjective', 'adverb'], LATE: ['adjective', 'adverb'], ONLY: ['adjective', 'adverb'],
  CLEAR: ['adjective', 'verb', 'adverb'], WARM: ['adjective', 'verb'], COLD: ['adjective', 'noun'],
  HARD: ['adjective', 'adverb'], LIGHTER: ['adjective', 'noun'], NEAR: ['adjective', 'verb', 'adverb'],
  MEAN: ['adjective', 'noun', 'verb'], LEAN: ['adjective', 'noun', 'verb'],
  GREEN: ['adjective', 'noun', 'verb'], RED: ['adjective', 'noun'], YELLOW: ['adjective', 'noun', 'verb'],
  WHITE: ['adjective', 'noun'], BLACK: ['adjective', 'noun', 'verb'], SWEET: ['adjective', 'noun'],
  SOUR: ['adjective', 'verb'], QUICK: ['adjective', 'adverb'], SLOW: ['adjective', 'adverb', 'verb'],
  HOME: ['noun', 'adjective', 'adverb', 'verb'], PLANE: ['noun', 'adjective', 'verb'],
  COLOUR: ['noun', 'verb'], COLOR: ['noun', 'verb'], LETTER: ['noun', 'verb'],
  HALL: ['noun'], TEACHER: ['noun'], LEARN: ['verb'], HEAL: ['verb'], TEACH: ['verb'],
  KIND: ['adjective', 'noun'], PATIENT: ['adjective', 'noun'], BOLD: ['adjective', 'noun'],
}

const localEntries = new Map<string, LexicalEntry>()
for (const [partsOfSpeech, commonness, words] of vocabularyGroups) {
  for (const word of splitWords(words)) {
    if (!isDictionaryWord(word)) continue
    const previous = localEntries.get(word)
    localEntries.set(word, {
      word,
      partsOfSpeech: [...new Set([...(previous?.partsOfSpeech ?? []), ...partsOfSpeech])],
      definition: '', synonyms: [], counters: [], related: [],
      commonness: familiarityOverrides[word] ?? commonness,
      commonnessSource: 'curated-estimate', semanticSource: 'curated-local', semanticConfidence: 0,
    })
  }
}

// Existing opt-in POS annotations remain available in generated encounters.
for (const [word, partsOfSpeech] of Object.entries(prototypeWordPartsOfSpeech)) {
  const entry = localEntries.get(word)
  if (entry) localEntries.set(word, { ...entry, partsOfSpeech })
}
for (const [word, partsOfSpeech] of Object.entries(partOfSpeechOverrides)) {
  const entry = localEntries.get(word)
  if (entry) localEntries.set(word, { ...entry, partsOfSpeech })
}
for (const [word, seed] of Object.entries(enemySeeds)) {
  localEntries.set(word, {
    word, partsOfSpeech: [seed.partOfSpeech], definition: seed.definition,
    synonyms: splitWords(seed.synonyms).filter(isDictionaryWord),
    counters: splitWords(seed.counters).filter(isDictionaryWord),
    related: splitWords(seed.related).filter(isDictionaryWord),
    commonness: seed.commonness, commonnessSource: 'curated-estimate',
    semanticSource: 'curated-local', semanticConfidence: 0.9,
  })
}

// Freeze both records and relation lists so a caller cannot change later seeded
// generations by mutating a value returned from this shared provider.
for (const [word, entry] of localEntries) {
  localEntries.set(word, Object.freeze({
    ...entry,
    partsOfSpeech: Object.freeze([...entry.partsOfSpeech]),
    synonyms: Object.freeze([...entry.synonyms]),
    counters: Object.freeze([...entry.counters]),
    related: Object.freeze([...entry.related]),
  }))
}
const curatedVocabulary = Object.freeze([...localEntries.values()].sort((a, b) => a.word.localeCompare(b.word)))
const curatedEnemyWords = Object.freeze(Object.keys(enemySeeds).sort())

export const localLexicalProvider: LexicalProvider = Object.freeze({
  id: 'wyrmle-curated-local-v1',
  getEntry(word: string): LexicalEntry | undefined {
    const normalized = normalizeWord(word)
    const curated = localEntries.get(normalized)
    if (curated) return curated
    if (!isDictionaryWord(normalized)) return undefined
    return {
      word: normalized, partsOfSpeech: getPartsOfSpeech(normalized) ?? [],
      definition: '', synonyms: [], counters: [], related: [], commonness: null,
      commonnessSource: 'unknown', semanticSource: 'dictionary-only', semanticConfidence: 0,
    }
  },
  enemyWords: () => curatedEnemyWords,
  vocabulary: () => curatedVocabulary,
})

/** Broad annotation is independent of the small, familiarity-rated construction pool. */
export const currentLexicalProvider: LexicalProvider = Object.freeze({
  id: `wyrmle-curated-local-v1+${LEXICON_VERSION}`,
  getEntry(word: string): LexicalEntry | undefined {
    const entry = localLexicalProvider.getEntry(word)
    if (!entry) return undefined
    const isEnemy = curatedEnemyWords.includes(entry.word)
    const relations = isEnemy ? enrichSemanticRelations(entry.word, {
      opposite: entry.counters, similar: entry.synonyms, related: entry.related,
    }) : undefined
    return { ...entry,
      // Enemy selection refers to its authored noun sense. Submitted words use
      // the complete lexical POS union in the runtime scoring function.
      partsOfSpeech: isEnemy ? entry.partsOfSpeech : getLexicalPartsOfSpeech(entry.word) ?? entry.partsOfSpeech,
      ...(relations ? { counters: relations.opposite, synonyms: relations.similar,
        related: relations.related, semanticSource: 'curated-and-wordnet' as const } : {}),
    }
  },
  getSubmittedWordEntry(word: string): LexicalEntry | undefined {
    const entry = currentLexicalProvider.getEntry(word)
    return entry ? { ...entry, partsOfSpeech: getLexicalPartsOfSpeech(entry.word) ?? entry.partsOfSpeech } : undefined
  },
  enemyWords: () => curatedEnemyWords,
  vocabulary: () => curatedVocabulary.map(entry => currentLexicalProvider.getSubmittedWordEntry!(entry.word)!),
})

export function getWordCommonness(word: string, provider: LexicalProvider = localLexicalProvider): number | null {
  return provider.getEntry(word)?.commonness ?? null
}
