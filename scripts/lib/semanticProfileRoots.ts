/**
 * Reviewed GAME concepts, pinned to specific OEWN senses. A counter-concept is
 * broader than a dictionary antonym: good spirits counter ANGER in this game.
 * Review additions here, then rebuild; never infer these judgements during play.
 */
export type ProfileRelation = 'opposite' | 'similar' | 'related'
export type ConceptRoot = {
  senseId: string
  relation: ProfileRelation
  concept: string
  antonyms?: ProfileRelation
  derivations?: boolean
}
const n = (word: string, lex: string, sense = '00') => `oewn-${word}__1.${lex}.${sense}..`
const root = (senseId: string, relation: ProfileRelation, concept: string, antonyms?: ProfileRelation): ConceptRoot =>
  ({ senseId, relation, concept, ...(antonyms ? { antonyms } : {}) })
const counter = (senseId: string, concept: string) => root(senseId, 'opposite', concept)
const akin = (senseId: string, concept: string, antonyms?: ProfileRelation) => root(senseId, 'similar', concept, antonyms)
const near = (senseId: string, concept: string) => root(senseId, 'related', concept)

const goodSpirits = [
  counter(n('cheerfulness', '07'), 'cheerfulness and good spirits'),
  counter(n('cheerfulness', '12'), 'cheerfulness and good spirits'),
  counter(n('happiness', '12'), 'happiness and joy'),
  counter(n('joy', '12'), 'happiness and joy'),
  counter(n('delight', '12'), 'delight and enjoyment'),
  counter(n('smile', '10'), 'smiling and pleasure'),
  counter(n('laughter', '04'), 'laughter and mirth'),
  counter(n('laughter', '10'), 'laughter and mirth'),
]
const kindness = [
  counter(n('kindness', '07'), 'kindness and consideration'),
  counter(n('kindness', '07', '01'), 'kindness and forgiveness'),
  counter(n('gentleness', '07'), 'gentleness and even temper'),
  counter(n('compassion', '12'), 'compassion for suffering'),
  counter(n('compassion', '07'), 'compassion and humane care'),
]
const calm = [
  counter('oewn-calm__5.00.00.composed.00', 'calm and composure'),
  counter('oewn-calm__2.37.00..', 'calming agitation'),
  counter('oewn-calm__2.37.01..', 'becoming calm'),
  counter(n('peace', '12'), 'peace of mind'),
  counter('oewn-relaxed__3.00.00..', 'relaxation without anxiety'),
  counter('oewn-relax__2.29.00..', 'becoming relaxed'),
]

export const semanticProfileRoots: Record<string, { enemySense: string; roots: ConceptRoot[] }> = {
  ANGER: {
    enemySense: n('anger', '12'),
    roots: [
      akin(n('anger', '12'), 'anger and indignation'),
      akin(n('fury', '12'), 'fury and intense anger'),
      akin(n('wrath', '12'), 'wrath and intense anger'),
      akin(n('resentment', '12'), 'resentment and bitter anger'),
      akin('oewn-resentful__3.00.00..', 'resentment and bitter anger'),
      akin('oewn-annoyed__5.00.00.displeased.00', 'annoyance and mild anger'),
      akin('oewn-angry__3.00.00..', 'feeling or expressing anger', 'opposite'),
      akin(n('annoyance', '12'), 'anger caused by irritation'),
      near(n('annoyance', '26'), 'irritation and annoyance'),
      near(n('frustration', '12', '01'), 'frustration and annoyance'),
      near(n('hatred', '12'), 'hatred and hostility'),
      ...calm, ...kindness, ...goodSpirits,
      counter(n('patience', '07'), 'patience and even temper'),
      counter(n('forgiveness', '12'), 'forgiveness instead of resentment'),
      counter('oewn-forgive__2.32.00..', 'forgiveness instead of resentment'),
      counter(n('friendliness', '07'), 'friendliness and goodwill'),
      counter(n('peace', '26', '01'), 'peace and freedom from disputes'),
      counter('oewn-peaceful__3.00.00..', 'peace without strife or turmoil'),
    ],
  },
  DESPAIR: {
    enemySense: n('despair', '12'),
    roots: [
      akin(n('despair', '12'), 'despair and lost hope', 'opposite'),
      akin(n('despair', '26'), 'the absence of hope'),
      akin(n('hopelessness', '12'), 'hopelessness'),
      akin(n('despondency', '12'), 'hopeless despondency'),
      near(n('pessimism', '12'), 'expecting bad outcomes'),
      near(n('sadness', '12'), 'sadness and unhappiness'),
      near(n('sorrow', '12'), 'sorrow and loss'),
      near(n('gloom', '12'), 'gloom and apprehension'),
      near(n('misery', '12'), 'intense unhappiness'),
      near(n('worry', '12'), 'anxious distress'),
      near('oewn-upset__5.00.00.troubled.00', 'anxious distress and grief'),
      counter(n('hope', '12'), 'hope for a better outcome'),
      counter('oewn-hopeful__3.00.00..', 'hope for a better outcome'),
      counter(n('optimism', '12'), 'optimism about the future'),
      counter(n('optimism', '07'), 'an optimistic outlook'),
      counter(n('encouragement', '04'), 'encouragement and support'),
      counter('oewn-encourage__2.37.00..', 'giving hope and encouragement'),
      counter(n('confidence', '26', '02'), 'confident hopefulness'),
    ],
  },
  FEAR: {
    enemySense: n('fear', '12'),
    roots: [
      akin(n('fear', '12'), 'fear of danger', 'opposite'),
      akin(n('terror', '12'), 'terror and intense fear'),
      akin(n('dread', '12'), 'dread of danger'),
      akin(n('horror', '12', '01'), 'horror and profound fear'),
      akin('oewn-scary__5.00.00.alarming.00', 'provoking fear'),
      akin('oewn-anxious__5.00.00.troubled.00', 'anxiety and nervous fear'),
      akin('oewn-upset__5.00.00.troubled.00', 'anxious uneasiness'),
      akin('oewn-afraid__3.00.00..', 'being afraid', 'opposite'),
      akin(n('fear', '12', '01'), 'anxious fear'),
      akin(n('anxiety', '12'), 'anxiety and apprehension'),
      akin(n('worry', '12'), 'worry and anxiety'),
      counter(n('courage', '07'), 'courage in the face of danger'),
      counter(n('bravery', '12'), 'bravery and freedom from fear'),
      counter(n('confidence', '09'), 'confidence in oneself'),
      counter(n('reassurance', '04'), 'reassurance and restored confidence'),
      counter(n('safety', '26'), 'safety from danger'),
      counter('oewn-safe__3.00.01..', 'being safe from danger'),
      counter('oewn-bold__3.00.00..', 'boldness and daring'),
      counter('oewn-secure__3.00.01..', 'security without fear or doubt'),
      counter(n('security', '12'), 'freedom from fear and anxiety'),
      ...calm,
    ],
  },
  MELANCHOLY: {
    enemySense: n('melancholy', '12'),
    roots: [
      akin(n('melancholy', '12'), 'thoughtful sadness'),
      akin('oewn-melancholy__5.00.00.sad.00', 'melancholy sadness'),
      akin(n('sadness', '12'), 'sadness and unhappiness', 'opposite'),
      akin('oewn-sad__3.00.00..', 'sadness and sorrow', 'opposite'),
      akin('oewn-sadly__4.02.03..', 'sadness expressed in manner'),
      akin('oewn-tearful__5.00.00.sorrowful.00', 'sadness expressed in tears'),
      akin(n('gloom', '12'), 'melancholy gloom'),
      near(n('sorrow', '12'), 'sorrow and loss'),
      near(n('grief', '12'), 'grief over loss'),
      near(n('loneliness', '12'), 'loneliness and sadness'),
      near(n('despondency', '12'), 'despondency'),
      ...goodSpirits,
      counter(n('merriment', '12'), 'merriment and joy'),
    ],
  },
  CRUELTY: {
    enemySense: n('cruelty', '04'),
    roots: [
      akin(n('cruelty', '04'), 'deliberately causing pain'),
      akin('oewn-cruel__5.00.01.inhumane.00', 'cruel and inhumane behavior'),
      akin(n('brutality', '07'), 'brutality and extreme cruelty'),
      akin(n('inhumanity', '07'), 'inhumanity and lack of compassion', 'opposite'),
      akin('oewn-merciless__3.00.00..', 'lack of mercy'),
      akin(n('torture', '04'), 'deliberately causing pain'),
      near(n('malice', '12'), 'wishing suffering on others'),
      near(n('callousness', '07'), 'callousness and hardheartedness'),
      near(n('harshness', '07', '02'), 'excessive harshness'),
      near(n('violence', '04', '01'), 'aggression and violence'),
      ...kindness,
      counter(n('mercy', '04'), 'mercy toward others'),
      counter(n('empathy', '12'), 'empathy for others'),
      counter(n('humaneness', '07'), 'humaneness and consideration'),
      counter(n('benevolence', '07'), 'kindness and benevolence'),
    ],
  },
  CHAOS: {
    enemySense: n('chaos', '26'),
    roots: [
      akin(n('chaos', '26'), 'extreme confusion and disorder'),
      akin(n('disorder', '26', '02'), 'disorder and misplaced things', 'opposite'),
      akin(n('disorder', '26'), 'disturbed public order', 'opposite'),
      akin(n('confusion', '26', '01'), 'unpredictable disorder'),
      akin(n('mess', '26'), 'a confused disorderly state'),
      akin('oewn-messy__5.00.00.untidy.00', 'mess and disorder'),
      akin('oewn-random__3.00.00..', 'lack of order or plan'),
      akin('oewn-unruly__5.00.00.disorderly.00', 'disorderly conduct'),
      akin(n('disruption', '04'), 'causing disorder'),
      akin(n('confusion', '09'), 'confused and disordered thought'),
      akin(n('disarray', '07'), 'disarray and untidiness'),
      akin(n('turmoil', '26'), 'turmoil and disturbance'),
      { ...akin(n('anarchy', '26'), 'lawlessness and disorder'), derivations: false },
      akin('oewn-anarchic__5.00.00.uncontrolled.00', 'absence of law or control'),
      // Political advocacy is associated with the word, not itself a state of
      // confusion. Keep this agent sense related instead of inheriting resisted
      // scoring from the noun's distinct disorder sense through derivation.
      { ...near(n('anarchist', '18'), 'political advocacy associated with anarchy'), derivations: false },
      counter(n('order', '14'), 'logical arrangement'),
      counter(n('order', '26', '02'), 'proper arrangement and order'),
      counter('oewn-orderly__3.00.00..', 'order without disruption'),
      counter('oewn-tidy__3.00.00..', 'tidiness and order'),
      counter('oewn-organized__3.00.01..', 'organized and methodical arrangement'),
      counter('oewn-sort__2.31.00..', 'sorting into an orderly arrangement'),
      counter(n('plan', '09', '01'), 'planning an orderly arrangement'),
      counter(n('organization', '07'), 'methodical organization'),
      counter(n('organization', '04', '01'), 'arranging things methodically'),
      counter(n('harmony', '26'), 'harmony between parts'),
      counter(n('structure', '07'), 'structure and arrangement'),
      counter('oewn-clear__5.00.00.clearheaded.00', 'clarity instead of confusion'),
    ],
  },
}

/**
 * Review of candidate expansion found these broader senses drift beyond the
 * emotional/game concepts. Exclude their entire synset, not just a spelling;
 * another relevant sense of the same word can still qualify. These exclusions
 * do not claim the source relation is wrong; it is too broad for this bonus.
 */
export const excludedProfileConcepts: Record<string, string> = {
  'oewn-gentle__5.00.00.light.08': 'Physical impact is not gentleness toward others.',
  'oewn-diligent__5.00.00.patient.00': 'Diligent work does not by itself imply an even temper.',
  'oewn-golden__5.00.00.happy.00': 'Prosperity is not an emotional state of happiness.',
  'oewn-mellow__5.00.00.soft.02': 'Material or age-related softening is not a kind disposition.',
  'oewn-mild__3.00.00..': 'Moderate intensity alone does not establish kindness or calm.',
  'oewn-encourage__2.41.00..': 'Promoting growth is broader than giving hope or courage.',
  'oewn-boost__2.30.02..': 'General benefit is broader than emotional encouragement.',
  'oewn-bullish__5.00.00.optimistic.00': 'A market-price prediction is outside personal hope.',
  'oewn-worry__2.37.12..': 'Being concerned with a topic is not necessarily anxious worry.',
  'oewn-worry__2.42.00..': 'Being on the mind does not establish fear or anxiety.',
  'oewn-hard__3.00.02..': 'Being dispassionate does not establish cruelty.',
  'oewn-rigorous__5.00.00.demanding.01': 'Following rules precisely is not cruelty.',
  'oewn-strict__5.00.00.exact.00': 'Accuracy is not cruelty.',
  'oewn-tough__5.00.00.bad.00': 'Unfortunate circumstances are not cruel intent or behavior.',
  'oewn-ferocious__5.00.00.violent.00': 'High energy can concern weather or motion without cruelty.',
  'oewn-evil__5.00.00.wicked.00': 'Vice is broader than cruelty.',
  'oewn-savageness__1.07.00..': 'Being untamed is not necessarily cruelty.',
  'oewn-sad__5.00.00.bad.00': 'Misfortune is broader than the feeling or expression of sadness.',
  'oewn-disturb__2.37.00..': 'Being moved deeply does not specify anxiety rather than positive emotion.',
  'oewn-positively__4.02.00..': 'An intensifier such as downright does not establish emotional confidence.',
  'oewn-surely__4.02.00..': 'An assertion of certainty is broader than freedom from fear.',
}

/** A rare spelling-specific reading would reverse the ordinary emotional cue. */
export const excludedProfileSenses: Record<string, string> = {
  'oewn-desperate__5.00.00.brave.00': 'The rare courageous-last-resort reading would misleadingly make DESPERATE a counter to fear; retain HEROIC in the shared synset.',
}
