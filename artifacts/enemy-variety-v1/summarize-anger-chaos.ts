import { readFile, writeFile } from 'node:fs/promises'
import { createLetterStrikeGame, submitLetterStrike } from '../../src/game/letterStrike.ts'
import { solvePuzzle } from '../../src/generator/solve.ts'
import { getWordCommonness, localLexicalProvider } from '../../src/generator/lexicalProvider.ts'

for (const enemy of ['ANGER','CHAOS']) {
  const result = JSON.parse(await readFile(`artifacts/enemy-variety-v1/${enemy}.json`, 'utf8'))
  const summary = {enemy, attempted: result.attempted, accepted:result.acceptedCount, rejected:result.rejectionCounts,
    candidates:result.ranked.map(item=> ({seed:item.candidate.seed, accepted:item.validation.accepted, reasons:item.validation.reasons, score:item.quality.total, archetypes:item.candidate.goal.archetypes, finishWords:[...new Set(item.analysis.winningLines.map(line=>line.moves.at(-1)?.word))], turnCounts:[...new Set(item.analysis.winningLines.map(line=>line.turns))], openings:[...new Set(item.analysis.winningLines.map(line=>line.moves[0]?.word))],
     lines:item.analysis.winningLines.map(line=>({words:line.moves.map(m=>m.word),turns:line.turns,resolveRemaining:line.resolveRemaining,finalHits:line.moves.at(-1)?.hits.length,finalSemantic:line.moves.at(-1)?.semanticLabel})),
     clutches:item.analysis.clutchLines.map(c=>({remaining:c.remainingLetters,prefix:c.prefix.map(m=>m.word),finishes:[...new Set(c.winningMoves.map(m=>m.word))],hits:[...new Set(c.winningMoves.map(m=>m.hits.length))]}))}))}
  const best=result.accepted[0]
  if (best) {
    const solve = solvePuzzle(best.candidate.encounter,{maxStates:350,beamWidth:50,maxWinningLines:100,maxMovesPerState:100,vocabulary:localLexicalProvider.vocabulary().map(x=>x.word),wordCommonness:w=>getWordCommonness(w)??0,hintLine:best.candidate.construction.plannedTileIds})
    await writeFile(`artifacts/enemy-variety-v1/${enemy}-best-deeper.json`,JSON.stringify(solve.winningLines,null,2))
    summary.deeper = {seed:best.candidate.seed,states:solve.statesExplored,bestWinDepth:solve.bestWinDepth,minimumTurnsProven:solve.minimumTurnsProven,openings:[...new Set(solve.winningLines.map(l=>l.moves[0]?.word))],finishWords:[...new Set(solve.winningLines.map(l=>l.moves.at(-1)?.word))],turnCounts:[...new Set(solve.winningLines.map(l=>l.turns))],lines:solve.winningLines.map(line=>{let state=createLetterStrikeGame(best.candidate.encounter);const detailed=[]; for (const move of line.moves) {const before=state;state=submitLetterStrike(state,move.tileIds);if(state.playedWords.length !== before.playedWords.length+1)throw new Error('Invalid move');detailed.push({word:move.word,tileIds:move.tileIds,resolve:state.playerResolve,hits:move.hits.length,remaining:state.enemyLetters.filter(l=>l.hitsRemaining>0).map(l=>l.letter).join(''),ward:move.wardUsed,strike:move.strikeUsed,semantic:move.semanticLabel});}if(state.status!=='won')throw new Error('Invalid win');return detailed;})}
  }
  await writeFile(`artifacts/enemy-variety-v1/${enemy}-summary.json`,JSON.stringify(summary,null,2))
  console.log(JSON.stringify(summary))
}
