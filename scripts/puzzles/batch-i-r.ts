import type { HuntProfile } from '../antonyms/huntProfiles.ts'

/** Reviewed same-type antonyms for the October 2026 queue extension.
 * Every root is pinned to its reviewed word and sense; inflections are audited
 * separately. The unchanged removal planner proves every helper branch. */
export const batchProfilesIR: HuntProfile[] = [
  {
    "profile": {
      "enemy": "INERT",
      "bingo": "ENERGETIC",
      "sense": "oewn-inert__5.00.00.inactive.01",
      "definition": "slow and apathetic; lacking energy",
      "roots": [
        "oewn-energetic__3.00.00..",
        "oewn-active__3.00.01..",
        "oewn-live__5.00.00.lively.00",
        "oewn-lively__3.00.00..",
        "oewn-alive__5.00.00.lively.00",
        "oewn-eager__3.00.00..",
        "oewn-vital__5.00.00.animated.00",
        "oewn-agile__5.00.00.active.01",
        "oewn-alert__5.00.00.energetic.00",
        "oewn-astir__5.00.00.active.01",
        "oewn-canty__5.00.00.energetic.00"
      ],
      "review": "INERT means slow and apathetic, not chemically unreactive. ENERGETIC, ACTIVE, LIVE and LIVELY describe energy and liveliness; LIVE is the adjective, not the verb meaning reside. Only these energy senses are admitted. LIVER and LIVEST are explicitly excluded: neither inherits a live-energy adjective by suffix stripping. ALIVE and VITAL use full of spirit, not merely biologically alive or essential; EAGER opposes the apathetic reading. AGILE and ASTIR use active movement; ALERT and the less familiar CANTY use quick and lively energy.",
      "hints": [
        "Think of someone who is always ready to get moving.",
        "This describes someone with plenty of energy.",
        "Nine letters, beginning with E."
      ],
      "letters": "ENERGETICAVLYSAL",
      "id": "oct26-inert-energetic",
      "overrides": {
        "LIVER": {
          "sense": "oewn-liver__1.08.00..",
          "relation": "unrelated",
          "reason": "The body-organ noun is not a comparative of the lively adjective LIVE."
        },
        "LIVEST": {
          "sense": "oewn-live__2.42.00..",
          "relation": "unrelated",
          "reason": "Archaic second-person verb form, not an adjective meaning more lively."
        }
      },
      "refills": "",
      "powers": [],
      "routes": [],
      "wordOnly": [
        "oewn-energetic__3.00.00..",
        "oewn-active__3.00.01..",
        "oewn-live__5.00.00.lively.00",
        "oewn-lively__3.00.00..",
        "oewn-alive__5.00.00.lively.00",
        "oewn-eager__3.00.00..",
        "oewn-vital__5.00.00.animated.00",
        "oewn-agile__5.00.00.active.01",
        "oewn-alert__5.00.00.energetic.00",
        "oewn-astir__5.00.00.active.01",
        "oewn-canty__5.00.00.energetic.00"
      ],
      "armour": {
        "2": 3
      }
    },
    "helpers": [
      "ACTIVE",
      "LIVE"
    ],
    "preferredHelpers": [
      "ACTIVE",
      "LIVE"
    ]
  },
  {
    "profile": {
      "enemy": "INHUMAN",
      "bingo": "HUMANITARIAN",
      "sense": "oewn-inhuman__5.00.00.inhumane.00",
      "definition": "cruel; showing no human kindness",
      "roots": [
        "oewn-humanitarian__5.00.00.humane.00",
        "oewn-humane__3.00.00..",
        "oewn-warm__3.00.02..",
        "oewn-humanist__5.00.00.humane.00"
      ],
      "review": "INHUMAN means cruel, not nonhuman or unusually powerful. HUMANITARIAN and HUMANE express concern for human welfare and suffering; WARM uses friendly and responsive human feeling. The noun humanitarian and temperature sense of warm are excluded. HUMANIST is the adjective sharing concern for human welfare, not the noun for an adherent of humanism.",
      "hints": [
        "Think of help offered to people who are suffering.",
        "This adjective often describes aid sent after a disaster.",
        "Twelve letters, beginning with H."
      ],
      "letters": "HUMANITARIANEWSA",
      "id": "oct26-inhuman-humanitarian",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-humanitarian__5.00.00.humane.00",
        "oewn-humane__3.00.00..",
        "oewn-warm__3.00.02..",
        "oewn-humanist__5.00.00.humane.00"
      ],
      "armour": {
        "5": 3
      }
    },
    "helpers": [
      "HUMANE",
      "WARM"
    ],
    "preferredHelpers": [
      "HUMANE",
      "WARM"
    ]
  },
  {
    "profile": {
      "enemy": "INTEGRATE",
      "bingo": "DISINTEGRATE",
      "sense": "oewn-integrate__2.30.00..",
      "definition": "combine parts into a whole",
      "roots": [
        "oewn-disintegrate__2.30.00..",
        "oewn-split__2.41.03..",
        "oewn-part__2.35.00..",
        "oewn-part__2.35.01..",
        "oewn-separate__2.35.01..",
        "oewn-tear__2.35.00..",
        "oewn-rend__2.35.00..",
        "oewn-rip__2.35.00..",
        "oewn-snap__2.35.01.."
      ],
      "review": "INTEGRATE is the verb for combining parts into a whole. DISINTEGRATE breaks that whole into parts; PART and SPLIT separate it. Neither social inclusion nor mathematical integration is the displayed meaning. Counter roots are verbs, not divided-state adjectives. TEAR, REND and RIP are verbs for separating a whole by force. RIPED, RIPING and TEARED are blocked: suffix inference must not manufacture tearing-apart verb inflections. SNAP uses separate abruptly, not taking a photograph.",
      "hints": [
        "Think of a whole falling into separate pieces.",
        "A crumbling structure begins to do this.",
        "Twelve letters, beginning with D."
      ],
      "letters": "DISINTEGRATEPLSA",
      "id": "oct26-integrate-disintegrate",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {
        "RIPED": {
          "sense": "oewn-ripen__2.30.00..",
          "relation": "unrelated",
          "reason": "RIP takes RIPPED, not RIPED; suffix stripping must not treat a ripening form as tearing."
        },
        "RIPING": {
          "sense": "oewn-ripen__2.30.00..",
          "relation": "unrelated",
          "reason": "RIP takes RIPPING, not RIPING; suffix stripping must not treat a ripening form as tearing."
        },
        "TEARED": {
          "sense": "oewn-tear__2.29.00..",
          "relation": "unrelated",
          "reason": "The tearing-apart sense has TORE and TORN; TEARED must not inherit that meaning from a tear-filled reading."
        }
      },
      "wordOnly": [
        "oewn-disintegrate__2.30.00..",
        "oewn-split__2.41.03..",
        "oewn-part__2.35.00..",
        "oewn-part__2.35.01..",
        "oewn-separate__2.35.01..",
        "oewn-tear__2.35.00..",
        "oewn-rend__2.35.00..",
        "oewn-rip__2.35.00..",
        "oewn-snap__2.35.01.."
      ]
    },
    "helpers": [
      "PART",
      "SPLIT"
    ],
    "preferredHelpers": [
      "PART",
      "SPLIT"
    ]
  },
  {
    "profile": {
      "enemy": "LATE",
      "bingo": "EARLIEST",
      "sense": "oewn-late__3.00.02..",
      "definition": "at or towards the end of a period or stage",
      "roots": [
        "oewn-early__3.00.02..",
        "oewn-early__3.00.00..",
        "oewn-earliest__5.00.00.early.00",
        "oewn-first__3.00.00..",
        "oewn-initial__5.00.00.first.00"
      ],
      "review": "LATE refers to position in time, not a deceased person. EARLY, FIRST and INITIAL refer to the beginning. EARLIEST is the ordinary superlative adjective of early, not an adverb. Comparative and superlative forms retain that temporal adjective sense.",
      "hints": [
        "Think of the very beginning, before anything else.",
        "It is the strongest form of an adjective about arriving ahead of time.",
        "Eight letters, beginning with E."
      ],
      "letters": "EARLIESTYFNLISAL",
      "id": "oct26-late-earliest",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-early__3.00.02..",
        "oewn-early__3.00.00..",
        "oewn-earliest__5.00.00.early.00",
        "oewn-first__3.00.00..",
        "oewn-initial__5.00.00.first.00"
      ]
    },
    "helpers": [
      "EARLY",
      "FIRST"
    ],
    "preferredHelpers": [
      "EARLY",
      "FIRST"
    ]
  },
  {
    "profile": {
      "enemy": "LEGAL",
      "bingo": "ILLEGITIMATE",
      "sense": "oewn-legal__3.00.00..",
      "definition": "allowed by law or official rules",
      "roots": [
        "oewn-illegitimate__5.00.00.illegal.00",
        "oewn-illegal__3.00.00..",
        "oewn-illicit__5.00.00.illegal.00"
      ],
      "review": "LEGAL is permitted by law. ILLEGITIMATE uses forbidden by law, not a judgement about a child or parentage. ILLEGAL and ILLICIT are the same lawful/unlawful adjective contrast. Double E makes ILLEGAL a useful helper rather than a trivial bingo.",
      "hints": [
        "Think of something that has no lawful basis.",
        "It can describe a claim to authority that is not legally recognised.",
        "Twelve letters, beginning with I."
      ],
      "armour": {
        "1": 2
      },
      "letters": "ILLEGITIMATELCSA",
      "id": "oct26-legal-illegitimate",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-illegitimate__5.00.00.illegal.00",
        "oewn-illegal__3.00.00..",
        "oewn-illicit__5.00.00.illegal.00"
      ]
    },
    "helpers": [
      "ILLEGAL",
      "ILLICIT"
    ],
    "preferredHelpers": [
      "ILLEGAL",
      "ILLICIT"
    ]
  },
  {
    "profile": {
      "enemy": "LODGE",
      "bingo": "DISLODGE",
      "sense": "oewn-lodge__2.35.00..",
      "definition": "fix or force something into a position",
      "roots": [
        "oewn-dislodge__2.35.00..",
        "oewn-free__2.35.02..",
        "oewn-loose__2.35.00..",
        "oewn-loosen__2.35.00.."
      ],
      "review": "LODGE means fix or force into a position. DISLODGE and FREE use remove or force out of a position; LOOSE and LOOSEN mean release from restraint. All are verbs. Housing, filing a complaint, and removing someone from political office are outside the pinned physical sense.",
      "hints": [
        "Think of getting something out of the place where it is stuck.",
        "You might do this to a stone wedged in a shoe.",
        "Eight letters, beginning with D."
      ],
      "letters": "DISLODGEOEFRSALO",
      "id": "oct26-lodge-dislodge",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-dislodge__2.35.00..",
        "oewn-free__2.35.02..",
        "oewn-loose__2.35.00..",
        "oewn-loosen__2.35.00.."
      ],
      "armour": {
        "2": 2
      }
    },
    "helpers": [
      "FREE",
      "LOOSE"
    ],
    "preferredHelpers": [
      "FREE",
      "LOOSE"
    ]
  },
  {
    "profile": {
      "enemy": "LOOSE",
      "bingo": "CONSOLIDATED",
      "sense": "oewn-loose__3.00.02..",
      "definition": "not compact or densely packed together",
      "roots": [
        "oewn-consolidated__5.00.00.compact.00",
        "oewn-solid__3.00.02..",
        "oewn-dense__5.00.01.concentrated.00",
        "oewn-compact__3.00.00..",
        "oewn-close__3.00.01.."
      ],
      "review": "LOOSE is the structure of material whose parts are not closely packed. CONSOLIDATED forms a solid mass; SOLID, DENSE and COMPACT use the same packing dimension. Loose morals, legal consolidation and intelligent/dense wordplay are excluded. CLOSE uses having elements near each other, not a nearby deadline.",
      "hints": [
        "Think of scattered material pressed into one solid mass.",
        "It describes separate parts brought together and made firm.",
        "Twelve letters, beginning with C."
      ],
      "letters": "CONSOLIDATEDESAL",
      "id": "oct26-loose-consolidated",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-consolidated__5.00.00.compact.00",
        "oewn-solid__3.00.02..",
        "oewn-dense__5.00.01.concentrated.00",
        "oewn-compact__3.00.00..",
        "oewn-close__3.00.01.."
      ]
    },
    "helpers": [
      "SOLID",
      "DENSE"
    ],
    "preferredHelpers": [
      "SOLID",
      "DENSE"
    ]
  },
  {
    "profile": {
      "enemy": "LOYAL",
      "bingo": "DISLOYAL",
      "sense": "oewn-loyal__5.00.00.faithful.00",
      "definition": "steadfast in devotion to a friend or cause",
      "roots": [
        "oewn-disloyal__3.00.00..",
        "oewn-false__5.00.00.inconstant.00",
        "oewn-fickle__5.00.00.inconstant.00"
      ],
      "review": "LOYAL is faithful devotion. DISLOYAL abandons allegiance; FALSE means unfaithful and FICKLE describes changing affections or attachments. False facts, fickle weather and patriotism are outside this selected interpersonal sense.",
      "hints": [
        "Think of someone who abandons the side they promised to support.",
        "It describes betraying a friend or a cause.",
        "Eight letters, beginning with D."
      ],
      "letters": "DISLOYALFECKSALO",
      "id": "oct26-loyal-disloyal",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-disloyal__3.00.00..",
        "oewn-false__5.00.00.inconstant.00",
        "oewn-fickle__5.00.00.inconstant.00"
      ]
    },
    "helpers": [
      "FALSE",
      "FICKLE"
    ],
    "preferredHelpers": [
      "FALSE",
      "FICKLE"
    ]
  },
  {
    "profile": {
      "enemy": "MAIN",
      "bingo": "UNIMPORTANT",
      "sense": "oewn-main__5.00.00.important.00",
      "definition": "most important or central to the matter",
      "roots": [
        "oewn-unimportant__3.00.00..",
        "oewn-minor__3.00.06..",
        "oewn-petty__5.00.00.unimportant.00",
        "oewn-peanut__5.00.00.minor.06",
        "oewn-potty__5.00.00.unimportant.00"
      ],
      "review": "MAIN uses importance, not pipes or grammatical clauses. UNIMPORTANT, MINOR and PETTY all describe little importance. PETTY is not narrow-mindedness, and MINOR is not age or a musical key. PEANUT and the British informal POTTY use trivial importance, not a nut, toilet or mental state.",
      "hints": [
        "Think of a detail that makes little difference.",
        "This describes something that does not really matter.",
        "Eleven letters, beginning with U."
      ],
      "letters": "UNIMPORTANTEYSAL",
      "id": "oct26-main-unimportant",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-unimportant__3.00.00..",
        "oewn-minor__3.00.06..",
        "oewn-petty__5.00.00.unimportant.00",
        "oewn-peanut__5.00.00.minor.06",
        "oewn-potty__5.00.00.unimportant.00"
      ],
      "armour": {
        "3": 2
      }
    },
    "helpers": [
      "MINOR",
      "PETTY"
    ],
    "preferredHelpers": [
      "MINOR",
      "PETTY"
    ]
  },
  {
    "profile": {
      "enemy": "MATURE",
      "bingo": "IMMATURE",
      "sense": "oewn-mature__3.00.01..",
      "definition": "having reached full natural growth or development",
      "roots": [
        "oewn-immature__3.00.01..",
        "oewn-immature__3.00.06..",
        "oewn-green__3.00.00..",
        "oewn-teen__5.00.00.young.00",
        "oewn-young__3.00.00..",
        "oewn-early__5.00.00.young.00"
      ],
      "review": "MATURE is full natural growth, not sensible behaviour or ripeness of an investment. IMMATURE and GREEN mean not yet fully developed; YOUNG and TEEN describe an early stage of life. GREEN is the unripe adjective, not colour. All opposite readings are adjectives. EARLY uses very young. EARLIEST is not inherited as a superlative of youth: its temporal first reading does not mean least mature.",
      "hints": [
        "Think of something that still has growing to do.",
        "This describes an early stage, before full development.",
        "Eight letters, beginning with I."
      ],
      "letters": "IMMATUREEGNYOSAL",
      "id": "oct26-mature-immature",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {
        "EARLIEST": {
          "sense": "oewn-earliest__5.00.00.early.00",
          "relation": "unrelated",
          "reason": "First in chronological order is not a superlative of the young-age reading; do not treat EARLIEST as YOUNGEST through the EARLY entry."
        }
      },
      "wordOnly": [
        "oewn-immature__3.00.01..",
        "oewn-immature__3.00.06..",
        "oewn-green__3.00.00..",
        "oewn-teen__5.00.00.young.00",
        "oewn-young__3.00.00..",
        "oewn-early__5.00.00.young.00"
      ]
    },
    "helpers": [
      "GREEN",
      "TEEN"
    ],
    "preferredHelpers": [
      "GREEN",
      "TEEN"
    ]
  },
  {
    "profile": {
      "enemy": "MATURE",
      "bingo": "RUDIMENTARY",
      "sense": "oewn-mature__3.00.01..",
      "definition": "fully developed; past the first stages of growth",
      "roots": [
        "oewn-rudimentary__5.00.00.incomplete.00",
        "oewn-early__3.00.02..",
        "oewn-primal__5.00.00.early.00",
        "oewn-rude__5.00.00.early.02"
      ],
      "review": "MATURE refers to full development. RUDIMENTARY is explicitly in the earliest stages of development; EARLY and PRIMAL describe those beginning stages. This excludes mature behaviour, raw food and merely simple but fully developed designs. RUDE uses early technical development, not bad manners.",
      "hints": [
        "Think of something that is only just beginning to take shape.",
        "It describes the most basic, undeveloped stage.",
        "Eleven letters, beginning with R."
      ],
      "letters": "RUDIMENTARYLPSAL",
      "id": "oct26-mature-rudimentary",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-rudimentary__5.00.00.incomplete.00",
        "oewn-early__3.00.02..",
        "oewn-primal__5.00.00.early.00",
        "oewn-rude__5.00.00.early.02"
      ]
    },
    "helpers": [
      "EARLY",
      "PRIMAL"
    ],
    "preferredHelpers": [
      "EARLY",
      "PRIMAL"
    ]
  },
  {
    "profile": {
      "enemy": "MEAN",
      "bingo": "HANDSOME",
      "sense": "oewn-mean__5.00.01.stingy.00",
      "definition": "contemptibly small in amount, especially a sum of money",
      "roots": [
        "oewn-handsome__5.00.00.generous.01",
        "oewn-large__3.00.00..",
        "oewn-ample__3.00.00.."
      ],
      "review": "MEAN is the stingy size of a sum, not cruelty or an arithmetic average. HANDSOME means generously large, as in a handsome donation. LARGE and AMPLE oppose the small amount. Physical beauty is not the accepted handsome reading.",
      "hints": [
        "Think of a generously sized reward or donation.",
        "This adjective can praise a sum of money as well as a person's appearance.",
        "Eight letters, beginning with H."
      ],
      "letters": "HANDSOMELRGPSALO",
      "id": "oct26-mean-handsome",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-handsome__5.00.00.generous.01",
        "oewn-large__3.00.00..",
        "oewn-ample__3.00.00.."
      ]
    },
    "helpers": [
      "LARGE",
      "AMPLE"
    ],
    "preferredHelpers": [
      "LARGE",
      "AMPLE"
    ]
  },
  {
    "profile": {
      "enemy": "MERGED",
      "bingo": "FRAGMENTED",
      "sense": "oewn-merged__5.00.00.united.00",
      "definition": "joined together into a single whole",
      "roots": [
        "oewn-fragmented__5.00.00.divided.00",
        "oewn-apart__5.00.00.unconnected.00",
        "oewn-torn__5.00.00.divided.00",
        "oewn-split__5.00.00.divided.00",
        "oewn-separate__3.00.00..",
        "oewn-separated__5.00.00.separate.00"
      ],
      "review": "MERGED is the adjective for parts united into a whole. FRAGMENTED means that unity is destroyed. APART is its separate/unconnected adjective reading, and TORN is divided by opposing forces, not an injury. Verb senses and the adverb apart do not qualify. SEPARATE is the adjective independent and not united. SEPARATED uses kept apart, the direct opposite of the selected union.",
      "hints": [
        "Think of one whole broken into many pieces.",
        "It describes something whose unity has been destroyed.",
        "Ten letters, beginning with F."
      ],
      "letters": "FRAGMENTEDAPOSAL",
      "id": "oct26-merged-fragmented",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-fragmented__5.00.00.divided.00",
        "oewn-apart__5.00.00.unconnected.00",
        "oewn-torn__5.00.00.divided.00",
        "oewn-split__5.00.00.divided.00",
        "oewn-separate__3.00.00..",
        "oewn-separated__5.00.00.separate.00"
      ]
    },
    "helpers": [
      "APART",
      "TORN"
    ],
    "preferredHelpers": [
      "APART",
      "TORN"
    ]
  },
  {
    "profile": {
      "enemy": "MOBILE",
      "bingo": "IMMOBILE",
      "sense": "oewn-mobile__3.00.00..",
      "definition": "able to move or be moved readily",
      "roots": [
        "oewn-immobile__3.00.00..",
        "oewn-immobile__5.00.00.fixed.00",
        "oewn-firm__5.00.00.fixed.00",
        "oewn-fast__5.00.00.fixed.00",
        "oewn-set__5.00.00.nonmoving.00",
        "oewn-still__5.00.01.nonmoving.00",
        "oewn-stabile__5.00.00.immobile.00",
        "oewn-immotile__5.00.00.immobile.00"
      ],
      "review": "MOBILE concerns movement, not phones. IMMOBILE cannot be moved; FIRM and FAST both use securely fixed in place (as in held fast), not speed or hardness. Only those fixed-position adjective readings are accepted. SET uses its fixed and unmoving adjective sense, not the verb or collection noun. STABILE is unable to be moved. IMMOTILE is the adjective for microorganisms unable to move, the same motion dimension.",
      "hints": [
        "Think of something that cannot change position.",
        "This is the adjective for being unable to move.",
        "Eight letters, beginning with I."
      ],
      "letters": "IMMOBILEFRSTSALO",
      "id": "oct26-mobile-immobile",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-immobile__3.00.00..",
        "oewn-immobile__5.00.00.fixed.00",
        "oewn-firm__5.00.00.fixed.00",
        "oewn-fast__5.00.00.fixed.00",
        "oewn-set__5.00.00.nonmoving.00",
        "oewn-still__5.00.01.nonmoving.00",
        "oewn-stabile__5.00.00.immobile.00",
        "oewn-immotile__5.00.00.immobile.00"
      ],
      "armour": {
        "0": 2
      }
    },
    "helpers": [
      "FIRM",
      "SET"
    ],
    "preferredHelpers": [
      "FIRM",
      "SET"
    ]
  },
  {
    "profile": {
      "enemy": "MORAL",
      "bingo": "IMMORAL",
      "sense": "oewn-moral__3.00.00..",
      "definition": "conforming to principles of right and wrong",
      "roots": [
        "oewn-immoral__3.00.00..",
        "oewn-bad__5.00.00.evil.00",
        "oewn-evil__3.00.00..",
        "oewn-vile__5.00.00.evil.00"
      ],
      "review": "MORAL means ethically right. IMMORAL, BAD, EVIL and VILE use ethically wrong adjective senses. Bad quality, feeling ill and the noun moral at the end of a story are excluded.",
      "hints": [
        "Think of behaviour that breaks accepted standards of right and wrong.",
        "This adjective says that an action is ethically wrong.",
        "Seven letters, beginning with I."
      ],
      "letters": "IMMORALBDEVSTLOE",
      "id": "oct26-moral-immoral",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-immoral__3.00.00..",
        "oewn-bad__5.00.00.evil.00",
        "oewn-evil__3.00.00..",
        "oewn-vile__5.00.00.evil.00"
      ]
    },
    "helpers": [
      "BAD",
      "EVIL"
    ],
    "preferredHelpers": [
      "BAD",
      "EVIL"
    ]
  },
  {
    "profile": {
      "enemy": "NORMAL",
      "bingo": "ABNORMAL",
      "sense": "oewn-normal__3.00.01..",
      "definition": "usual or typical; conforming to the expected pattern",
      "roots": [
        "oewn-abnormal__3.00.00..",
        "oewn-odd__5.00.00.strange.00",
        "oewn-rare__5.00.00.uncommon.00",
        "oewn-rare__5.00.00.infrequent.00"
      ],
      "review": "NORMAL is usual or typical, not a judgement about people or health. ABNORMAL and ODD depart from that usual pattern; RARE describes uncommon occurrence. Odd numbers and lightly cooked meat do not use the accepted senses.",
      "hints": [
        "Think of something outside the usual pattern.",
        "This adjective means not typical or usual.",
        "Eight letters, beginning with A."
      ],
      "letters": "ABNORMALRDDESAIO",
      "id": "oct26-normal-abnormal",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-abnormal__3.00.00..",
        "oewn-odd__5.00.00.strange.00",
        "oewn-rare__5.00.00.uncommon.00",
        "oewn-rare__5.00.00.infrequent.00"
      ]
    },
    "helpers": [
      "ODD",
      "RARE"
    ],
    "preferredHelpers": [
      "ODD",
      "RARE"
    ]
  },
  {
    "profile": {
      "enemy": "ODD",
      "bingo": "COORDINATED",
      "sense": "oewn-odd__5.00.00.mismatched.00",
      "definition": "unpaired or unmatched, as with an odd sock",
      "roots": [
        "oewn-coordinated__5.00.00.matched.00",
        "oewn-matched__3.00.00..",
        "oewn-mated__5.00.00.matched.00",
        "oewn-paired__5.00.00.matched.00"
      ],
      "review": "ODD means unmatched, not strange or an odd number. COORDINATED is intentionally matched. MATCHED and MATED use harmonising or paired adjective readings; MATED does not refer to sexual activity here. This is the contrast between odd items and a matching set.",
      "hints": [
        "Think of separate items chosen to go together.",
        "It could describe an outfit whose pieces have been deliberately matched.",
        "Eleven letters, beginning with C."
      ],
      "letters": "COORDINATEDMHSAL",
      "id": "oct26-odd-coordinated",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-coordinated__5.00.00.matched.00",
        "oewn-matched__3.00.00..",
        "oewn-mated__5.00.00.matched.00",
        "oewn-paired__5.00.00.matched.00"
      ],
      "armour": {
        "0": 2
      }
    },
    "helpers": [
      "MATED",
      "MATCHED"
    ],
    "preferredHelpers": [
      "MATED",
      "MATCHED"
    ]
  },
  {
    "profile": {
      "enemy": "ORDERLY",
      "bingo": "DISORDERLY",
      "sense": "oewn-orderly__3.00.00..",
      "definition": "peaceful and controlled; without disruption",
      "roots": [
        "oewn-disorderly__3.00.00..",
        "oewn-wild__3.00.02..",
        "oewn-rowdy__5.00.00.disorderly.00"
      ],
      "review": "ORDERLY concerns behaviour without violence or disruption. DISORDERLY, WILD and ROWDY mean uncontrolled or disruptive. Wild animals, remote places and an orderly as a hospital worker are outside the displayed sense.",
      "hints": [
        "Think of a crowd that is getting out of control.",
        "This adjective often appears in a phrase about disruptive conduct.",
        "Ten letters, beginning with D."
      ],
      "letters": "DISORDERLYWSALOE",
      "id": "oct26-orderly-disorderly",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-disorderly__3.00.00..",
        "oewn-wild__3.00.02..",
        "oewn-rowdy__5.00.00.disorderly.00"
      ]
    },
    "helpers": [
      "WILD",
      "ROWDY"
    ],
    "preferredHelpers": [
      "WILD",
      "ROWDY"
    ]
  },
  {
    "profile": {
      "enemy": "ORDINARY",
      "bingo": "EXTRAORDINARY",
      "sense": "oewn-ordinary__3.00.00..",
      "definition": "usual and unexceptional",
      "roots": [
        "oewn-extraordinary__3.00.00..",
        "oewn-odd__5.00.00.strange.00",
        "oewn-rare__5.00.00.extraordinary.00"
      ],
      "review": "ORDINARY means usual and unexceptional. EXTRAORDINARY goes beyond the usual; ODD is unusual and RARE uses an uncommon or exceptional quality. Neither odd numbers nor scarce supply is the selected counter meaning.",
      "hints": [
        "Think of something well beyond the usual.",
        "It is an adjective for something exceptional or remarkable.",
        "Thirteen letters, beginning with E."
      ],
      "armour": {
        "1": 2
      },
      "letters": "EXTRAORDINARYDSA",
      "id": "oct26-ordinary-extraordinary",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-extraordinary__3.00.00..",
        "oewn-odd__5.00.00.strange.00",
        "oewn-rare__5.00.00.extraordinary.00"
      ]
    },
    "helpers": [
      "ODD",
      "RARE"
    ],
    "preferredHelpers": [
      "ODD",
      "RARE"
    ]
  },
  {
    "profile": {
      "enemy": "OVERT",
      "bingo": "COVERT",
      "sense": "oewn-overt__3.00.00..",
      "definition": "open and observable; not secret or hidden",
      "roots": [
        "oewn-covert__3.00.00..",
        "oewn-secret__5.00.00.concealed.00",
        "oewn-secret__5.00.01.covert.00",
        "oewn-private__3.00.00..",
        "oewn-close__5.00.00.private.00"
      ],
      "review": "OVERT means openly observable rather than concealed. COVERT and SECRET use hidden activity; PRIVATE uses confined to particular people, rather than open to view. This excludes a shut-door reading, the noun secret, and covert as a shelter noun. CLOSE shares confined to specific people with PRIVATE, not spatial proximity.",
      "hints": [
        "Think of an operation kept out of public view.",
        "It describes activity conducted in secret.",
        "Six letters, beginning with C."
      ],
      "letters": "COVERTESPIASALOE",
      "id": "oct26-overt-covert",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-covert__3.00.00..",
        "oewn-secret__5.00.00.concealed.00",
        "oewn-secret__5.00.01.covert.00",
        "oewn-private__3.00.00..",
        "oewn-close__5.00.00.private.00"
      ]
    },
    "helpers": [
      "SECRET",
      "PRIVATE"
    ],
    "preferredHelpers": [
      "SECRET",
      "PRIVATE"
    ]
  },
  {
    "profile": {
      "enemy": "POLAR",
      "bingo": "TROPICAL",
      "sense": "oewn-polar__5.00.00.cold.01",
      "definition": "extremely cold",
      "roots": [
        "oewn-tropical__5.00.00.hot.01",
        "oewn-hot__3.00.01..",
        "oewn-warm__3.00.01..",
        "oewn-torrid__5.00.00.hot.01",
        "oewn-tropic__5.00.00.hot.01"
      ],
      "review": "POLAR is the temperature adjective extremely cold. TROPICAL uses hot, humid weather; HOT, WARM and TORRID use physical heat. Geographic location alone, magnetic poles and heated emotions are excluded. TROPIC is the hot-weather adjective, not a geographical noun.",
      "hints": [
        "Think of weather associated with lush rainforests.",
        "It describes the hot, humid climate near the equator.",
        "Eight letters, beginning with T."
      ],
      "letters": "TROPICALHWMDSALO",
      "id": "oct26-polar-tropical",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-tropical__5.00.00.hot.01",
        "oewn-hot__3.00.01..",
        "oewn-warm__3.00.01..",
        "oewn-torrid__5.00.00.hot.01",
        "oewn-tropic__5.00.00.hot.01"
      ]
    },
    "helpers": [
      "HOT",
      "WARM"
    ],
    "preferredHelpers": [
      "HOT",
      "WARM"
    ]
  },
  {
    "profile": {
      "enemy": "PURE",
      "bingo": "IMPURE",
      "sense": "oewn-pure__3.00.02..",
      "definition": "free of other substances or contamination",
      "roots": [
        "oewn-impure__3.00.02..",
        "oewn-dirty__3.00.01..",
        "oewn-dirty__3.00.03..",
        "oewn-mixed__5.00.00.heterogeneous.00",
        "oewn-soiled__3.00.04..",
        "oewn-smutty__5.00.00.dirty.01",
        "oewn-motley__5.00.00.heterogeneous.00"
      ],
      "review": "PURE concerns the composition of a substance. IMPURE contains foreign material; DIRTY uses physical contamination and MIXED contains different kinds. Moral purity, rude language and mixed-race identity are excluded. SOILED and SMUTTY use physical dirt; MOTLEY uses a mixture of different kinds. Oil alone and parasites are not treated as proof of impurity.",
      "hints": [
        "Think of a substance with something else mixed into it.",
        "This adjective means that unwanted material is present.",
        "Six letters, beginning with I."
      ],
      "letters": "IMPUREDTYXSALOET",
      "id": "oct26-pure-impure",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-impure__3.00.02..",
        "oewn-dirty__3.00.01..",
        "oewn-dirty__3.00.03..",
        "oewn-mixed__5.00.00.heterogeneous.00",
        "oewn-soiled__3.00.04..",
        "oewn-smutty__5.00.00.dirty.01",
        "oewn-motley__5.00.00.heterogeneous.00"
      ]
    },
    "helpers": [
      "DIRTY",
      "MIXED"
    ],
    "preferredHelpers": [
      "DIRTY",
      "MIXED"
    ]
  },
  {
    "profile": {
      "enemy": "RARE",
      "bingo": "UNREMARKABLE",
      "sense": "oewn-rare__5.00.00.extraordinary.00",
      "definition": "uncommon or exceptional in quality",
      "roots": [
        "oewn-unremarkable__5.00.00.ordinary.00",
        "oewn-normal__3.00.01..",
        "oewn-regular__5.00.00.normal.01"
      ],
      "review": "RARE uses uncommon, exceptional quality, not frequency or meat. UNREMARKABLE, NORMAL and REGULAR describe the ordinary and expected. Regular appointments and normal geometry do not qualify. Double E excludes the shorter REGULAR bingo while keeping it as a helper.",
      "hints": [
        "Think of something that gives you little reason to take notice.",
        "It is so ordinary that nothing about it stands out.",
        "Twelve letters, beginning with U."
      ],
      "armour": {
        "3": 2
      },
      "letters": "UNREMARKABLEOGSA",
      "id": "oct26-rare-unremarkable",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-unremarkable__5.00.00.ordinary.00",
        "oewn-normal__3.00.01..",
        "oewn-regular__5.00.00.normal.01"
      ]
    },
    "helpers": [
      "NORMAL",
      "REGULAR"
    ],
    "preferredHelpers": [
      "NORMAL",
      "REGULAR"
    ]
  },
  {
    "profile": {
      "enemy": "RUDE",
      "bingo": "CULTURED",
      "sense": "oewn-rude__5.00.00.unrefined.01",
      "definition": "lacking refinement and grace in manners",
      "roots": [
        "oewn-cultured__5.00.00.refined.01",
        "oewn-polite__5.00.00.refined.01",
        "oewn-polite__3.00.00..",
        "oewn-nice__5.00.00.polite.00",
        "oewn-courteous__5.00.00.polite.00"
      ],
      "review": "RUDE concerns unrefined manners. CULTURED and POLITE are refined in taste and manners; NICE uses courtesy and politeness. Agriculture, bacterial cultures, and a merely attractive appearance are outside this social adjective contrast. COURTEOUS explicitly uses politeness.",
      "hints": [
        "Think of someone with refined tastes and manners.",
        "This adjective suggests familiarity with the arts as well as good manners.",
        "Eight letters, beginning with C."
      ],
      "letters": "CULTUREDPOINSALO",
      "id": "oct26-rude-cultured",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-cultured__5.00.00.refined.01",
        "oewn-polite__5.00.00.refined.01",
        "oewn-polite__3.00.00..",
        "oewn-nice__5.00.00.polite.00",
        "oewn-courteous__5.00.00.polite.00"
      ],
      "armour": {
        "1": 2
      }
    },
    "helpers": [
      "POLITE",
      "NICE"
    ],
    "preferredHelpers": [
      "POLITE",
      "NICE"
    ]
  },
  {
    "profile": {
      "enemy": "MOBILE",
      "bingo": "IMMOVABLE",
      "sense": "oewn-mobile__3.00.00..",
      "definition": "able to move or be moved readily",
      "roots": [
        "oewn-immovable__5.00.00.immobile.00",
        "oewn-immobile__3.00.00..",
        "oewn-set__5.00.00.nonmoving.00",
        "oewn-still__5.00.01.nonmoving.00",
        "oewn-stabile__5.00.00.immobile.00"
      ],
      "review": "MOBILE means able to move. IMMOVABLE means not able or intended to be moved. SET is fixed and unmoving, and STILL is not in physical motion. Still as an adverb and set as a verb or collection are not admitted. STABILE also means unable or not intended to be moved.",
      "hints": [
        "Think of something that will not budge.",
        "This describes an object that cannot be moved.",
        "Nine letters, beginning with I."
      ],
      "letters": "IMMOVABLELSTSALO",
      "id": "oct26-mobile-immovable",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-immovable__5.00.00.immobile.00",
        "oewn-immobile__3.00.00..",
        "oewn-set__5.00.00.nonmoving.00",
        "oewn-still__5.00.01.nonmoving.00",
        "oewn-stabile__5.00.00.immobile.00"
      ]
    },
    "helpers": [
      "SET",
      "STILL"
    ],
    "preferredHelpers": [
      "SET",
      "STILL"
    ]
  },
  {
    "profile": {
      "id": "oct26-mean-humane",
      "enemy": "MEAN",
      "bingo": "HUMANE",
      "sense": "oewn-mean__5.00.00.nasty.00",
      "definition": "unkind or malicious towards others",
      "roots": [
        "oewn-humane__3.00.00..",
        "oewn-kind__3.00.00..",
        "oewn-warm__3.00.02..",
        "oewn-nice__5.00.00.polite.00"
      ],
      "review": "MEAN means malicious or unkind, not stingy or an average. HUMANE and KIND use concern for people and their suffering; WARM describes friendly and responsive feeling. NICE uses courtesy rather than appearance. All counter readings are adjectives.",
      "hints": [
        "Think of treatment that takes suffering into account.",
        "This adjective describes kindness towards people or animals.",
        "Six letters, beginning with H."
      ],
      "letters": "HUMANEKIDWRSALOE",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-humane__3.00.00..",
        "oewn-kind__3.00.00..",
        "oewn-warm__3.00.02..",
        "oewn-nice__5.00.00.polite.00"
      ]
    },
    "helpers": [
      "KIND",
      "WARM"
    ],
    "preferredHelpers": [
      "KIND",
      "WARM"
    ]
  },
  {
    "profile": {
      "id": "oct26-nice-uncharitable",
      "enemy": "NICE",
      "bingo": "UNCHARITABLE",
      "sense": "oewn-nice__3.00.00..",
      "definition": "pleasant and agreeable in nature towards others",
      "roots": [
        "oewn-uncharitable__3.00.00..",
        "oewn-mean__5.00.00.nasty.00",
        "oewn-cruel__5.00.01.inhumane.00",
        "oewn-unkind__3.00.00..",
        "oewn-brutal__5.00.00.inhumane.00",
        "oewn-bestial__5.00.00.inhumane.00",
        "oewn-brute__5.00.00.inhumane.00",
        "oewn-brutish__5.00.00.inhumane.00",
        "oewn-nasty__3.00.00.."
      ],
      "review": "NICE refers to a pleasant disposition towards others, not attractive appearance or precision. UNCHARITABLE lacks love and generosity; MEAN, CRUEL and UNKIND describe the opposing malicious or hurtful disposition. These are adjective readings, not a means or charity as a noun. BRUTAL uses cruelty, not something merely very difficult. BESTIAL, BRUTE and BRUTISH use inhumane insensitivity; NASTY and NASTIER use malicious behaviour, not an unpleasant flavour.",
      "hints": [
        "Think of someone who always assumes the worst of other people.",
        "It describes an ungenerous judgement of someone else.",
        "Twelve letters, beginning with U."
      ],
      "letters": "UNCHARITABLEMSAL",
      "refills": "",
      "powers": [],
      "routes": [],
      "overrides": {},
      "wordOnly": [
        "oewn-uncharitable__3.00.00..",
        "oewn-mean__5.00.00.nasty.00",
        "oewn-cruel__5.00.01.inhumane.00",
        "oewn-unkind__3.00.00..",
        "oewn-brutal__5.00.00.inhumane.00",
        "oewn-bestial__5.00.00.inhumane.00",
        "oewn-brute__5.00.00.inhumane.00",
        "oewn-brutish__5.00.00.inhumane.00",
        "oewn-nasty__3.00.00.."
      ]
    },
    "helpers": [
      "MEAN",
      "CRUEL"
    ],
    "preferredHelpers": [
      "MEAN",
      "CRUEL"
    ]
  }
]
