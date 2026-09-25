from pathlib import Path
import gzip, json, hashlib, importlib.util, inspect, collections
ROOT=Path('/home/jake/Documents/wyrmle')
source_path=Path('/tmp/wyrmle-semantic-source-roles.json')
source=json.loads(source_path.read_text())
metadata=json.loads((ROOT/'src/lexicon/data/oewn-2025-meanings-v1-metadata.json').read_text())
catalog_bytes=(ROOT/'src/lexicon/data/oewn-2025-meanings-v1.json.gz').read_bytes()
assert hashlib.sha256(catalog_bytes).hexdigest()==metadata['catalog']['sha256']
catalog=json.loads(gzip.decompress(catalog_bytes))
raw_synsets={row[0]:row for row in catalog['synsets']}
existing=set(source['synsets'])
added=[]
def visit(synset_id, depth):
    row=raw_synsets[synset_id]
    relations=[]
    for edge in row[3]:
        kind,target=edge[:2]
        target_row=catalog['synsets'][target]
        satellite=kind=='similar' and row[1]=='s' and target_row[1]=='a'
        if kind in ('hypernym','entails','causes') or satellite:
            relations.append({'type':kind,'target':target_row[0]})
            if satellite: added.append((synset_id,target_row[0]))
    source['synsets'][synset_id]={'definition':row[2][0],'relations':relations}
    if depth:
        for edge in relations:
            if depths.get(edge['target'],-1)<depth-1:
                depths[edge['target']]=depth-1
                visit(edge['target'],depth-1)
depths={}
for synset_id in sorted(existing):
    if depths.get(synset_id,-1)<2:
        depths[synset_id]=2
        visit(synset_id,2)
source['synsets']={key:source['synsets'][key] for key in sorted(source['synsets'])}
source.pop('sourceDigest')
source['sourceDigest']=hashlib.sha256(json.dumps(source,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
Path('/tmp/wyrmle-semantic-source-satellite.json').write_text(json.dumps(source,ensure_ascii=False,separators=(',',':'))+'\n')
spec=importlib.util.spec_from_file_location('infer',ROOT/'scripts/semantics/infer.py')
infer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(infer)
function=inspect.getsource(infer.directional_proofs).replace(
 'if edge["type"] in ("hypernym", "entails", "causes"):',
 'if edge["type"] in ("hypernym", "entails", "causes") or (edge["type"] == "similar" and current.endswith("-s") and edge["target"].endswith("-a")):')
namespace={'deque':collections.deque}
exec(function,namespace)
proof_function=namespace['directional_proofs']
ids=sorted(source['senses'])
output=Path('/tmp/wyrmle-semantic-assessment-satellite')
output.mkdir(exist_ok=True)
counts={}
for enemy in sorted(source['profiles']):
    raw=json.loads(gzip.decompress((Path('/tmp/wyrmle-semantic-assessment-final')/(enemy.lower()+'.json.gz')).read_bytes()))
    profile=source['profiles'][enemy]
    proofs=proof_function(source,profile,ids)
    changed=[]
    for word,record in raw['words'].items():
        reviewed=profile['relations'].get(word)
        if reviewed and reviewed['relation'] in ('opposite','similar'): continue
        matches=[(sid,proof) for sid in source['words'][word] for proof in proofs.get(sid,[])]
        if not matches: continue
        sid,proof=min(matches,key=lambda item:(0 if item[1]['relation']=='opposite' else 1,len(item[1]['path'])))
        new={**record,'senseId':sid,'proof':proof,'relation':proof['relation'],'method':'source-direction-proof','selectedAnchor':proof['anchor']}
        if record!=new:
            changed.append({'word':word,'before':record,'after':new})
        raw['words'][word]=new
    config=raw['metadata']['configuration']
    config['adjectiveSatellitePrefix']='explicit-similar-satellite-s-to-head-a-only-counts-toward-two-total-edges'
    config_hash=infer.digest(infer.canonical(config).encode())
    raw['metadata'].update(configurationHash=config_hash,sourceDigest=source['sourceDigest'])
    raw['metadata']['methods']=dict(collections.Counter(r['method'] for r in raw['words'].values()))
    (output/(enemy.lower()+'.json.gz')).write_bytes(gzip.compress(infer.canonical(raw).encode(),mtime=0))
    counts[enemy]={'changedRecords':len(changed),'changedLabels':sum(c['before']['relation']!=c['after']['relation'] for c in changed)}
    (output/(enemy.lower()+'-changes.json')).write_text(json.dumps(changed,separators=(',',':'))+'\n')
    print(enemy,counts[enemy],flush=True)
Path('/tmp/wyrmle-satellite-proof-summary.json').write_text(json.dumps({'configurationHash':config_hash,'sourceDigest':source['sourceDigest'],'addedSynsets':len(set(source['synsets'])-existing),'satelliteEdges':len(set(added)),'counts':counts},indent=2)+'\n')
print(Path('/tmp/wyrmle-satellite-proof-summary.json').read_text())
