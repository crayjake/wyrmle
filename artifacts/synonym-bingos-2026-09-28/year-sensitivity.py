"""Research sensitivity scan; no game or puzzle writes.

Run from any directory with Python 3. Prints JSON to stdout. It permits
source-backed inflections only of a different source lemma; adjective
similarity is a separate, explicitly broader candidate mode.
"""
import json,gzip
from pathlib import Path
from collections import defaultdict,Counter
ROOT = Path(__file__).resolve().parents[2]
D=json.loads(gzip.decompress((ROOT / 'src/lexicon/data/oewn-2025-meanings-v1.json.gz').read_bytes()))
F=json.loads((ROOT / 'src/generator/data/familiarity-v1.json').read_text())
freq={w:z/100 for z,ws in F['bins'] for w in ws.split()}
lemmas=defaultdict(set); forms=defaultdict(set)
for word,rows in D['words'].items():
 if not 3<=len(word)<=16:continue
 for entry,form in rows:
  lemma=D['entries'][entry][1].upper()
  for si in D['entries'][entry][3]:
   syn=D['senses'][si][2]
   forms[syn].add((word,lemma))
   if form==0:lemmas[syn].add((word,lemma))
counts={w:Counter(w) for w in D['words'] if 3<=len(w)<=16}
links=defaultdict(set)
for i,syn in enumerate(D['synsets']):
 if syn[1] not in ('a','s'):continue
 for edge in syn[3]:
  if edge[0]=='similar' and D['synsets'][edge[1]][1] in ('a','s'):
   links[i].add(edge[1]);links[edge[1]].add(i)
results={}
for mode in ('exact_lemmas','exact_other_lemma_forms','one_adjective_similarity_other_lemma_forms'):
 pairs={}
 for syn,enemyrows in lemmas.items():
  target_synsets={syn}|(links[syn] if mode.startswith('one_') else set())
  for enemy,enemy_lemma in enemyrows:
   if len(enemy)>8:continue
   for target_syn in target_synsets:
    for answer,answer_lemma in (lemmas if mode=='exact_lemmas' else forms)[target_syn]:
     if answer==enemy or answer_lemma==enemy_lemma or enemy in answer:continue
     if any(counts[answer][c]<n for c,n in counts[enemy].items()):continue
     armour=sum(min(n,counts[answer][c]-n) for c,n in counts[enemy].items())
     row=pairs.setdefault((enemy,answer),{'enemy':enemy,'answer':answer,'enemyZipf':freq[enemy],'answerZipf':freq[answer],'armour':armour,'evidence':[]})
     row['evidence'].append({'enemySynset':D['synsets'][syn][0],'answerSynset':D['synsets'][target_syn][0],'answerLemma':answer_lemma,'exactSynset':syn==target_syn})
 rows=list(pairs.values())
 out={}
 for name,emin,bmin in [('familiar_both',3,3),('familiar_enemy_less_common_bingo',3,2.2),('current_discovery_frequency_thresholds',2.4,2.2)]:
  rs=[r for r in rows if r['enemyZipf']>=emin and r['answerZipf']>=bmin]
  out[name]={}
  for length_label, lo, hi in [('answers_3_to_16',3,16),('answers_7_to_15',7,15)]:
   bounded=[r for r in rs if lo<=len(r['answer'])<=hi]
   out[name][length_label]={a:{'enemies':len({r['enemy'] for r in bounded if r['armour']>=a}),'pairs':sum(r['armour']>=a for r in bounded)} for a in range(5)}
 results[mode]=out
print(json.dumps(results,indent=2))
