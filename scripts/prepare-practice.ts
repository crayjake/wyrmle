import { writeFileSync } from 'node:fs'
import { antonymProfiles } from './antonyms/profiles.ts'
import { buildAntonymEncounter } from './antonyms/build.ts'
import { planHuntRemovals } from './antonyms/hunt.ts'
const profile = { ...antonymProfiles.find(p => p.id === 'dry')!, refills: '', armour: { 0: 2 } }
const { encounter, review } = planHuntRemovals(buildAntonymEncounter(profile).encounter, profile.bingo, ['DAMP', 'WET', 'WATERY', 'SOGGY'])
encounter.id = 'practice-dry-v1'
// Practice offers only its guided words; the real engine checks every action.
encounter.meaningLexicon = { ...encounter.meaningLexicon!, words: Object.fromEntries(Object.entries(encounter.meaningLexicon!.words).filter(([word]) => ['DAMP','WET','WATERY','SOGGY','HYDRATED','DRY'].includes(word))) }
encounter.enemy.semanticRelations.opposite = Object.keys(encounter.meaningLexicon!.words).filter(word => encounter.meaningLexicon!.words[word].relation === 'opposite')
writeFileSync('src/tutorial/practice.json', JSON.stringify(encounter, null, 2) + '\n')
console.log(JSON.stringify(review, null, 2))
