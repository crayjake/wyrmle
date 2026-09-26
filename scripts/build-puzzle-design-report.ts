import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { SemanticJourney } from '../src/generator/semanticJourney.ts'

const directory = 'artifacts/puzzle-design-2026-09-26'
const read = (path: string) => JSON.parse(path.endsWith('.gz') ? gunzipSync(readFileSync(path)).toString() : readFileSync(path, 'utf8'))
const base = read('artifacts/meaning-v4-halcyons/selected.json.gz')
const balance = read(join(directory, 'balance-comparison.json.gz'))
const generated = read(join(directory, 'final-generator-check.json.gz'))
const halcyon = read(join(directory, 'halcyon/study.json.gz'))
function study(name: string, note: string, encounter: LetterStrikeEncounter, journey: SemanticJourney) {
  const shown = new Set(journey.positions.flatMap(position => [...position.counterWords, ...position.resistedWords]))
  const positions = journey.positions.map(position => {
    let state = createLetterStrikeGame(encounter)
    for (const step of position.prefix) state = submitLetterStrike(state, step.tileIds)
    return { ...position, tiles: state.tiles.map(tile => ({ letter: tile.letter || '.', gem: tile.gem ?? null })) }
  })
  return { name, note, enemy: encounter.enemy, positions, depths: journey.byDepth,
    meanings: Object.fromEntries([...shown].map(word => [word, encounter.meaningLexicon!.words[word]])),
    chipWins: journey.chipAwayRuns.filter(run => run.status === 'won').length, chipRuns: journey.chipAwayRuns.length }
}
const studies = [study('CHAOS · current publication', 'Full reviewed vocabulary. The opening is rich; the later theme fades and simple chip-away wins are common.', base.candidate.encounter, balance[0].journey),
  ...generated.accepted.map((item: typeof base) => study('CHAOS · sustained-discovery draft', 'Passed development design gates. Full new-inventory semantic review and publication proofs are still required.', item.candidate.encounter, item.analysis.semanticJourney)),
  ...halcyon.map((item: { encounter: LetterStrikeEncounter; enemyHP: number; journey: SemanticJourney }, index: number) => study(
    `HALCYON · study ${index + 1} · ${item.enemyHP} HP / ${item.encounter.startingResolve} lives`,
    'Limited vocabulary study: only 70 explicitly reviewed words are admitted. This is not a full-dictionary daily or a publication-ready puzzle.', item.encounter, item.journey))]
const data = JSON.stringify({ balance: read(join(directory, 'balance-summary.json')), studies }).replaceAll('<', '\\u003c')
writeFileSync(join(directory, 'index.html'), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WYRMLE · Puzzle design workbench</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;color:#eee9dd;background:#24271f}*{box-sizing:border-box}body{margin:0}main{max-width:1100px;margin:auto;padding:40px 24px 80px}h1{font-size:clamp(28px,5vw,46px);letter-spacing:-.04em;margin:8px 0 18px}h2{font-size:23px;margin-top:32px}.eyebrow{color:#a3c187;font-size:12px;text-transform:uppercase;letter-spacing:.16em}.intro{max-width:720px;line-height:1.65;color:#c5c6b8}.panel{border:1px solid #505445;border-radius:18px;padding:24px;background:#2c3026;margin:22px 0}.table{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:14px}th,td{padding:14px 10px;border-bottom:1px solid #484d3e;white-space:nowrap}th{font-size:12px;color:#b9c7a8}.bar{display:inline-block;vertical-align:middle;background:#c77e6c;height:9px;border-radius:9px;margin-left:12px}.controls{display:grid;grid-template-columns:1fr 1fr;gap:16px}label{display:grid;gap:8px;font-size:13px;color:#b9c7a8}select{background:#22251d;color:#eee9dd;border:1px solid #656d55;border-radius:8px;padding:12px;width:100%;min-width:0;font:inherit}.layout{display:grid;grid-template-columns:250px 1fr;gap:30px;margin-top:24px}.board{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;align-content:start}.tile{position:relative;display:grid;place-items:center;aspect-ratio:1;background:#eee9dd;color:#26291f;font:27px ui-monospace,monospace;border-radius:8px}.tile .gem{position:absolute;bottom:3px;right:4px;font:8px system-ui;color:#754d3f}.tile.blank{background:#20241b;color:#737b63}.chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 20px}button{border:1px solid #91ad76;background:#34432b;color:#d4edbe;border-radius:6px;padding:8px 10px;cursor:pointer;font:13px ui-monospace,monospace}.resisted button{border-color:#a36e5d;background:#49352b;color:#f3c4b3}button:hover,button:focus-visible{outline:2px solid #eee9dd;outline-offset:2px}.note{font-size:13px;line-height:1.6;color:#b8bdac}#meaning{min-height:78px;border-top:1px solid #515844;padding-top:18px;line-height:1.6}#ending{line-height:1.6;color:#d6c09a}a{color:#badc9c}small{display:block;margin-top:12px;color:#adb5a1}@media(max-width:650px){main{padding:25px 15px}.panel{padding:17px}.controls,.layout{grid-template-columns:1fr}.board{max-width:260px}.layout{gap:22px}th,td{padding:10px 8px}}
</style><main>
<div class="eyebrow">WYRMLE / authoring study / 26 September 2026</div>
<h1>Make meaning matter again.</h1>
<p class="intro">The board should keep suggesting the enemy’s meaning. The satisfying discovery is a word that breaks it—especially when an obvious word has the right letters and the wrong meaning.</p>
<section class="panel"><h2 style="margin-top:0">What stops neutral chip-away?</h2><p class="note">Same CHAOS board and queue. Ten deterministic runs per variant: two neutral policies, with either no opening counter or one of four strong opening counters. These are witnessed strategies, not player win probabilities.</p><div class="table"><table><thead><tr><th>Variant</th><th>Enemy HP</th><th>Player lives</th><th>Chip-away wins</th><th>Shortest win found</th></tr></thead><tbody id="balance"></tbody></table></div><p class="note">Nine enemy HP is the most promising first adjustment. Extra Revives alone leave many easy neutral finishes. Bounded search does not prove shortest solutions or safety after every move.</p></section>
<h2>Inspect the actual later boards</h2><p class="intro">Choose a study and a sequence. Every position comes from real engine replay. Select a word to inspect its stored meaning. This explorer shows sampled branches; it is not a complete playtest.</p>
<section class="panel"><div class="controls"><label>Study<select id="study"></select></label><label>Played sequence<select id="position"></select></label></div><p id="scope" class="note"></p><div class="layout"><div><div id="board" class="board"></div><small id="health"></small></div><div><div class="eyebrow">Resisted temptations</div><div id="resisted" class="chips resisted"></div><div class="eyebrow">Available counters</div><div id="counters" class="chips"></div><p id="ending"></p><div id="meaning">Select a word to inspect its meaning.</div></div></div></section>
<p class="note">HALCYON uses the peaceful adjective. The small studies deliberately reject unreviewed words; a normal daily needs the complete dictionary inventory reviewed first. Frequency measures familiarity only approximately. The HALCYONS correction is separately packaged in CHAOS v13; the experimental balances are not published.</p>
<p><a href="README.md">Design findings and reproduction</a> · <a href="../icon-concepts-2026-09-26/index.html">Icon concepts — design 1 selected</a></p>
</main><script>
const data=${data};
const el=id=>document.getElementById(id);
for(const row of data.balance){const tr=document.createElement('tr');for(const value of [row.name,row.enemyHP,row.lives,row.chipAwayWins+' / '+row.chipAwayRuns,row.bestWin??'Unknown']){const td=document.createElement('td');td.textContent=value;tr.append(td)}const bar=document.createElement('span');bar.className='bar';bar.style.width=(row.chipAwayWins*9)+'px';tr.children[3].append(bar);el('balance').append(tr)}
data.studies.forEach((study,index)=>el('study').add(new Option(study.name,index)));
function draw(){const study=data.studies[Number(el('study').value)],p=study.positions[Number(el('position').value)];el('scope').textContent=study.note;el('board').replaceChildren();for(const item of p.tiles){const letter=item.letter,tile=document.createElement('div');tile.className='tile'+(letter==='.'?' blank':'');tile.textContent=letter==='.'?'·':letter;if(item.gem){const badge=document.createElement('span');badge.className='gem';badge.textContent=({ward:'LIFE',strike:'HIT',regen:'REVIVE'})[item.gem];tile.append(badge)}el('board').append(tile)}el('health').textContent=study.enemy.word+' · '+p.remainingHits+' HP · '+p.lives+' lives remaining';for(const [id,words]of [['resisted',p.resistedWords],['counters',p.counterWords]]){el(id).replaceChildren();if(!words.length)el(id).textContent='None in the reviewed familiarity range.';for(const word of words){const button=document.createElement('button');button.textContent=word;button.onclick=()=>{const m=study.meanings[word];el('meaning').textContent=word+': '+m.definition+' — '+m.reason};el(id).append(button)}}el('meaning').textContent='Select a word to inspect its meaning.';el('ending').textContent=(p.temptingResistedFinishers?.length&&p.counterFinishers?.length)?'Right letters, wrong meaning: '+p.temptingResistedFinishers.join(', ')+'. Winning counters here: '+p.counterFinishers.join(', ')+'.':'';}
function choose(){el('position').replaceChildren();data.studies[Number(el('study').value)].positions.forEach((p,index)=>el('position').add(new Option(p.prefix.map(m=>m.word).join(' → ')||'Opening board',index)));draw()}
el('study').onchange=choose;el('position').onchange=draw;el('study').value=String(data.studies.length-2);choose();
</script></html>\n`)
console.log(`${directory}/index.html`)
