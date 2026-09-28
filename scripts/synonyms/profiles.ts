/** Reviewed preview meanings, pinned to the repository's OEWN 2025 senses.
 * A noun and its ordinary descriptive forms may express the same meaning.
 * No antonym, sentiment or recursive thesaurus expansion is used here.
 */
export const synonymProfiles = [
  {
    id: 'fiction', enemy: 'FICTION', definition: 'an invented story or false account',
    sense: 'oewn-fiction__1.10.01..', bingo: 'FABRICATION',
    letters: 'FABRICATIONLSYED', refills: 'NVPTEINNLOIAEDSURCFETAOL', powers: [],
    routes: [['FABRICATION'], ['FALSITY', 'DECEPTION'], ['FANCY', 'LIE', 'INVENTION']],
    roots: [
      'oewn-fiction__1.10.01..', 'oewn-fable__1.10.02..', 'oewn-lie__1.10.00..',
      'oewn-falsehood__1.10.00..', 'oewn-deceit__1.10.00..', 'oewn-tale__1.10.01..',
      'oewn-story__1.10.02..', 'oewn-fancy__1.09.02..', 'oewn-fantasy__1.09.01..',
      'oewn-invention__1.09.00..', 'oewn-concoction__1.09.00..',
    ],
    // These senses have broader co-members which are not necessarily false accounts.
    wordOnly: ['oewn-invention__1.09.00..', 'oewn-concoction__1.09.00..'],
    review: 'An invented account can be a fabrication, lie, fable, fantasy or invention. Invention uses its made-up-account reading, not a useful device. Physical creations, patents and inventions in the technological sense are not separately added.',
    hints: ['Think of a story someone made up.', 'It can also mean making something in a workshop.', 'Eleven letters, beginning with F.'],
  },
  {
    id: 'eternal', enemy: 'ETERNAL', definition: 'lasting forever, or seeming never to end',
    sense: 'oewn-eternal__5.00.00.permanent.00', bingo: 'INTERMINABLE',
    letters: 'INTERMINABLESSGD', refills: 'LSOMFVEERANPTUOISELDRAC', powers: [],
    routes: [['INTERMINABLE'], ['ENDLESS', 'IMMORTAL'], ['ENDLESS', 'LASTING', 'FOREVER']],
    roots: [
      'oewn-eternal__5.00.00.permanent.00', 'oewn-eternal__5.00.00.long.02',
      'oewn-constant__5.00.00.continuous.01', 'oewn-forever__4.02.00..',
      'oewn-forever__4.02.02..', 'oewn-lasting__5.00.00.long.02',
      'oewn-immortal__3.00.00..', 'oewn-timeless__5.00.00.unaltered.00',
      'oewn-perennial__5.00.00.long.02',
    ],
    wordOnly: ['oewn-lasting__5.00.00.long.02', 'oewn-timeless__5.00.00.unaltered.00'],
    review: 'The displayed sense includes literal forever and a seemingly endless duration. LASTING uses prolonged duration; IMMORTAL uses never dying. FOREVER is the ordinary adverb expressing the same duration. Physical durability alone is not admitted through the LASTING synset.',
    hints: ['Think of a meeting that seems to go on forever.', 'There is a sense of wishing it would finally stop.', 'Twelve letters, beginning with I.'],
  },
  {
    id: 'calm-power', enemy: 'CALM', definition: 'quiet and free from agitation; to make something so',
    sense: 'oewn-calm__5.00.00.composed.00', bingo: 'PEACEFUL',
    letters: 'PEACEFULMILDSTRO', refills: 'OSETAORELCMIDNUPSERATL', powers: ['F'],
    routes: [['PEACEFUL'], ['PEACE', 'MILD'], ['MILD', 'EASE', 'PEACE']],
    roots: [
      'oewn-calm__5.00.00.composed.00', 'oewn-placid__5.00.00.calm.00',
      'oewn-composed__3.00.00..', 'oewn-peaceful__3.00.00..', 'oewn-relaxed__3.00.00..',
      'oewn-easy__3.00.02..', 'oewn-mild__3.00.00..', 'oewn-peace__1.12.00..',
      'oewn-ease__2.37.00..', 'oewn-lull__2.37.00..', 'oewn-relax__2.29.00..',
      'oewn-relax__2.29.01..', 'oewn-settle__2.30.05..', 'oewn-soothe__2.37.00..',
    ],
    wordOnly: ['oewn-mild__3.00.00..', 'oewn-soothe__2.37.00..', 'oewn-settle__2.30.05..'],
    review: 'Calm includes a quiet state and making something quiet. MILD is a calm/gentle manner, not a comparison of temperature. The POWER F supplies the missing M in PEACEFUL. The shorter routes can win without spending that power.',
    hints: ['Think of a place without conflict or disturbance.', 'The word starts with a five-letter word for calm.', 'Eight letters. Use the blue F.'],
  },
  {
    id: 'gloom-power', enemy: 'GLOOM', definition: 'sadness or low spirits',
    sense: 'oewn-gloom__1.12.00..', bingo: 'MELANCHOLY',
    letters: 'MELANCHOLYWISROR', refills: 'OISERMOWEDLARUSTENOPYC', powers: ['M', 'C'],
    routes: [['MELANCHOLY'], ['MOROSE', 'LOW'], ['LOW', 'MISERY', 'SORROW']],
    roots: [
      'oewn-gloom__1.12.00..', 'oewn-gloom__1.26.02..',
      'oewn-melancholy__1.12.00..', 'oewn-melancholy__5.00.00.sad.00',
      'oewn-melancholy__5.00.00.depressing.00', 'oewn-morose__5.00.00.ill-natured.00',
      'oewn-low__5.00.00.dejected.00', 'oewn-misery__1.12.00..',
      'oewn-sorrow__1.26.00..', 'oewn-sorrow__1.12.00..', 'oewn-sad__3.00.00..',
      'oewn-sadness__1.26.00..', 'oewn-unhappy__3.00.00..', 'oewn-blues__1.26.00..',
      'oewn-dejection__1.26.00..', 'oewn-dejected__3.00.00..', 'oewn-glum__5.00.00.dejected.00',
    ],
    wordOnly: [],
    review: 'Words for sadness and words describing that mood count. LOW means low spirits, not height; MOROSE means a gloomy mood. No darkness, blue-colour or weather senses are added. MELANCHOLY needs the two POWER tiles to supply G and the second O.',
    hints: ['Think of a thoughtful, lingering sadness.', 'It is also a word for a sad mood.', 'Ten letters, beginning with M. Both blue tiles help.'],
  },
] as const
