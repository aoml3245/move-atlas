"""Display families over the attributed catalog. Never remove legacy exercise IDs."""
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from catalog import canonical, korean

ROOT = Path(__file__).resolve().parents[1]
LOAD = {'dumbbell', 'barbell', 'kettlebell', 'cable', 'machine', 'smith', 'band', 'ez_bar'}
# These aliases were compared against their source descriptions, rather than
# treating every same-name/same-equipment candidate as a confirmed duplicate.
RECORD_ALIASES = [
 ['ex_c9b82dda3a0dfa', 'ex_18b2cfef4217ec'],
 ['ex_7f695d323bb7cc', 'ex_0a21d92a82a96a'],
 ['ex_a27ea08f0bf880', 'ex_759637871a043a'],
 ['ex_ae23950048388e', 'ex_f789459bdcf84b'],
 ['ex_557c1a5e98594d', 'ex_b95766c6027766'],
 ['ex_bf310a0ff7f7c8', 'ex_9f990cf636c00f'],
]
WORDS = {
 'dumbbell': r'dumbbells?|\bdb\b', 'barbell': r'barbells?',
 'kettlebell': r'kettlebells?', 'cable': r'cable',
 'machine': r'leverage machine|lever|machine', 'smith': r'smith machine|smith',
 'band': r'resistance bands?|bands?', 'ez_bar': r'ez[ -]barbell|ez[ -]bar|ezbar',
}

def display_name(x):
 s=x['name']
 for g in sorted(set(x['equipment']) & LOAD, key=lambda g: -len(WORDS[g])):
  s=re.sub(r'\b(?:'+WORDS[g]+r')\b', ' ', s, flags=re.I)
 s=re.sub(r'\((?:male|female|front view|side view|back view|RDL)\)', ' ', s, flags=re.I)
 s=re.sub(r'\bbody ?weight\b', ' ', s, flags=re.I)
 s=re.sub(r'\btwo[ -]arm\b', ' ', s, flags=re.I)
 s=re.sub(r'\bwith\s*(?=$|[()])', '', s, flags=re.I)
 s=re.sub(r'\(\s*\)', '', s)
 s=re.sub(r'\s+', ' ', s).strip(' -(),')
 return s or x['name']

def key(x):
 s=canonical(x['name'], [g for g in x['equipment'] if g in LOAD])
 if s=='deadlift rdl romanian':s='deadlift romanian'
 # Medium grip is the catalog's default bench-press entry used by the routine.
 if s=='bench grip medium press':s='bench press'
 if s=='crunches':s='crunch'
 # Unknown apparatus cannot safely become an equipment option for another row.
 return (s, x['activity'], x['id'] if x['needsReview'] else '')

def build():
 raw=(ROOT/'public/catalog.json').read_bytes();catalog=json.loads(raw)
 byid={x['id']:x for x in catalog['exercises']}
 curated=set(re.findall(r"\['(ex_[a-f0-9]{14})'", (ROOT/'public/training.mjs').read_text()))
 groups=defaultdict(list)
 for x in catalog['exercises']:groups[key(x)].append(x)
 aliases={i:ids for ids in RECORD_ALIASES for i in ids}
 result=[]
 for k,rows in groups.items():
  rowids={x['id'] for x in rows}
  rows.sort(key=lambda x:(x['id'] not in curated, -len(x['sources']),len(display_name(x)),x['id']))
  names=[display_name(x) for x in rows]
  name=min(names,key=lambda n:(bool(re.search(r'\bgrip\b',n,re.I)),len(n)))
  if k[0]=='bench press':name='Bench Press'
  if k[0]=='deadlift romanian':name='Romanian Deadlift'
  variants=[];seen=set()
  for x in rows:
   if x['id'] in seen:continue
   ids=[i for i in aliases.get(x['id'],[x['id']]) if i in rowids]
   representative=next((i for i in ids if i in curated),ids[0])
   seen.update(ids)
   variants.append({'id':representative,'exerciseIds':ids})
  result.append({'id':'group_'+hashlib.sha256(json.dumps(k).encode()).hexdigest()[:14],
   'name':name,'nameKo':korean(name),'variants':variants})
 result.sort(key=lambda g:(g['name'].lower(),g['id']))
 payload={'schema':1,'catalogSha256':hashlib.sha256(raw).hexdigest(),
  'meta':{'exerciseCount':len(byid),'groupCount':len(result),
   'policy':'Display families only. Preserve angle, grip, posture, unilateral, assistance, weight, numbered and functional-apparatus qualifiers. Record aliases limited to explicitly reviewed pairs.'},'groups':result}
 ids=[i for g in result for v in g['variants'] for i in v['exerciseIds']]
 assert len(ids)==len(set(ids))==len(byid) and set(ids)==set(byid)
 for g in result:
  for v in g['variants']:
   assert len({tuple(sorted(byid[i]['equipment'])) for i in v['exerciseIds']})==1
 (ROOT/'public/exercise-groups.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
 print(f"Display groups: {len(byid)} variants → {len(result)} exercises")

if __name__=='__main__':build()
