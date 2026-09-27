import { parseArgs } from 'node:util'
import { shiftPuzzleId } from '../src/daily/date.ts'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { yearThemes, yearProfile } from './bingo/year/profiles.ts'
import type { YearCandidate } from './bingo/year/profiles.ts'
import { createBingoMeanings } from './bingo/meanings.ts'
import { getGenerationWordCommonness as frequency } from '../src/generator/familiarity.ts'
import { canSpell } from '../src/generator/constructBoard.ts'
import { bingoArmour } from './bingo/generate.ts'

const { values } = parseArgs({ options: { directory: { type: 'string' } } })
const nextDate = shiftPuzzleId(JSON.parse(readFileSync('src/daily/schedule.json', 'utf8')).at(-1).date, 1)
const directory = values.directory ?? `artifacts/daily-year-${nextDate}`
const used = new Set(JSON.parse(readFileSync('scripts/bingo/published-history.json', 'utf8')).flatMap(p => p.bingoFamilies))
const all: YearCandidate[] = []
for (const theme of yearThemes) {
  for (const side of [0, 1] as const) {
    const profile = yearProfile(theme, side), meanings = createBingoMeanings(profile)
    const enemies = meanings.relations.similar.filter(word => word.length >= 3 && word.length <= 8
      && (frequency(word) ?? 0) >= .35)
    const bingos = meanings.relations.opposite.filter(word => word.length >= 7 && word.length <= 15
      && (frequency(word) ?? 0) >= .3 && !used.has(meanings.meanings[word].lemma.toUpperCase()))
    const candidates: YearCandidate[] = []
    for (const enemy of enemies) for (const bingo of bingos) {
      if (bingo.includes(enemy) || !canSpell(enemy, [...bingo])) continue
      const armour = bingoArmour(enemy, bingo).reduce((sum, letter) => sum + letter.initialHits - 1, 0)
      if (armour + enemy.length <= 3) continue
      candidates.push({ theme: theme.id, side, enemy, bingo, enemySense: meanings.meanings[enemy].senseId,
        enemyLemma: meanings.meanings[enemy].lemma, bingoLemma: meanings.meanings[bingo].lemma, armour, frequency: frequency(bingo) ?? 0 })
    }
    // Keep the strongest spelling of each enemy / answer family first; alternate
    // inflections remain available if its board search cannot meet the gates.
    candidates.sort((a, b) => Math.min(2, b.armour) - Math.min(2, a.armour) || b.frequency - a.frequency || a.bingo.length - b.bingo.length)
    all.push(...candidates)
    console.log(`${theme.id}/${side}: ${candidates.length} candidate pairs`)
  }
}
mkdirSync(directory, { recursive: true })
writeFileSync(`${directory}/candidates.json`, JSON.stringify(all, null, 2) + '\n')
console.log(JSON.stringify({ pairs: all.length, enemies: new Set(all.map(p => p.enemy)).size, bingoFamilies: new Set(all.map(p => p.bingoLemma)).size }))
