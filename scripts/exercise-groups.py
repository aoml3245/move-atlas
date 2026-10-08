"""Display families over the attributed catalog. Never remove legacy exercise IDs."""
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from catalog import canonical, korean, norm

ROOT = Path(__file__).resolve().parents[1]
LOAD = {'dumbbell', 'barbell', 'kettlebell', 'cable', 'machine', 'smith', 'band', 'ez_bar'}
LOADED_ACTIVITIES = {'strength', 'powerlifting', 'olympic weightlifting', 'strongman'}
ACTIVITY_LABELS = {'strength':'근력', 'stretching':'스트레칭', 'cardio':'유산소', 'plyometrics':'점프·폭발력', 'powerlifting':'파워리프팅', 'olympic weightlifting':'역도', 'strongman':'스트롱맨', 'recovery':'회복'}
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
 # Remove known equipment before grammatical aliases: "Biceps Cable Curl"
 # otherwise misses "Biceps Curl", and DB is absent from canonical().
 s=canonical(display_name(x), [])
 if s=='deadlift rdl romanian':s='deadlift romanian'
 # Medium grip is the catalog's default bench-press entry used by the routine.
 if s=='bench grip medium press':s='bench press'
 if s=='crunches':s='crunch'
 # Unknown apparatus cannot safely become an equipment option for another row.
 activity='loaded' if x['activity'] in LOADED_ACTIVITIES else x['activity']
 return (s, activity, x['id'] if x['needsReview'] else '')

CONDITION_LABELS = {
 'wide':'넓게', 'narrow':'좁게', 'close':'좁게', 'medium':'중간',
 'neutral':'뉴트럴', 'parallel':'평행', 'reverse':'리버스', 'revers':'리버스',
 'mixed':'혼합', 'underhand':'언더핸드', 'overhand':'오버핸드',
 'supinated':'언더핸드', 'pronated':'오버핸드', 'pronate':'오버핸드',
 'hammer':'해머', 'shoulder':'어깨 너비', 'v':'V 손잡이', 'clean':'클린',
 'high incline':'높은 인클라인', 'incline':'인클라인', 'decline':'디클라인', 'flat':'플랫',
 'half kneeling':'반무릎', 'half kneel':'반무릎', 'standing':'서서',
 'seated':'앉아서', 'sitting':'앉아서', 'lying down':'누워서', 'lying':'누워서',
 'laying':'누워서', 'prone':'엎드려서', 'supine':'바로 누워서', 'kneeling':'무릎 자세',
 'alternating':'교대', 'alternate':'교대', 'unilateral':'한쪽', 'bilateral':'양쪽',
 'self assisted':'자가 보조', 'assisted':'보조', 'weighted':'추가 중량', 'unweighted':'중량 없이',
 'isometric':'등척성', 'static hold':'정적 유지', 'static':'정적', 'paused':'멈춤', 'pause':'멈춤',
 'negative':'네거티브', 'eccentric':'이완 중심', 'concentric':'수축 중심', 'slow':'천천히',
 'deficit':'디피싯', 'from deficit':'디피싯', 'partial':'부분 범위', 'full range':'전체 범위', 'hold':'유지',
}

def condition_name(x):
 """Move explicit qualifiers into options; keep the original record identity."""
 s=re.sub(r'\((?:male|female|front view|side view|back view|front pov|side pov|back pov)\)', ' ', x['name'], flags=re.I)
 # Camera/quality annotations change the asset, not the exercise.
 s=re.sub(r'\b(?:male|female|hd)\s*$', ' ', s, flags=re.I)
 s=re.sub(r'(\d+)\s*[вВ]?°', r'\1 degrees', s)
 s=norm(s)
 conditions=[]
 def remove(pattern,kind,label=None):
  nonlocal s
  def replace(match):
   value=match.group(0)
   text=label(value) if label else CONDITION_LABELS.get(value,korean(value))
   item={'type':kind,'value':value,'label':text}
   if item not in conditions:conditions.append(item)
   return ' '
  s=re.sub(r'\b(?:'+pattern+r')\b',replace,s)
 def grip_label(value):
  return ' · '.join(CONDITION_LABELS.get(t,t) for t in value.split() if t!='grip')+' 그립'
 remove(r'(?:wide|close|narrow|medium|neutral|parallel|reverse|revers|mixed|underhand|overhand|supinated|pronated|pronate|hammer|shoulder|v|clean)(?:\s+(?:parallel|close|narrow|wide))?\s+grip','grip',grip_label)
 remove(r'palms?\s+(?:facing\s+)?(?:in|up|down)','grip',lambda v: {'in':'손바닥 안쪽','up':'손바닥 위','down':'손바닥 아래'}[v.split()[-1]])
 if re.search(r'\bchin\s*(?:up|ups)\b|\bchinup\b',s):
  if not any(c['type']=='grip' and re.search(r'parallel|neutral|mixed|underhand|overhand|pronated|supinated|palms?',c['value']) for c in conditions):
   conditions.append({'type':'grip','value':'underhand','label':'언더핸드'})
  s=re.sub(r'\bchin\s*(?:up|ups)\b|\bchinup\b','pullup',s)
 # Reverse fly/crunch/lunge/deadlift and forearm rotation are still movements.
 if re.search(r'\b(?:curls?|rows?|rowing|press|pulldown|pull\s*down|pull\s*ups?|chin\s*ups?|dips?)\b',s) and not re.search(r'\b(?:fly|flyes|lunge|crunch|deadlift|nordic)\b',s):
  remove(r'underhand|overhand|pronated|supinated','grip')
  if re.search(r'\b(?:curl|curls|row|rowing|bench press|lat pulldown)\b',s):remove(r'reverse|revers','grip')
  if re.search(r'\b(?:curl|curls|press)\b',s):remove(r'hammer','grip')
  if not re.search(r'\bstance\b',s):remove(r'wide|narrow','grip')
 remove(r'high incline|incline|decline|flat','angle')
 remove(r'(?:30|45|60)\s*(?:degrees?|deg)','angle',lambda v: re.search(r'\d+',v)[0]+'도')
 remove(r'half kneeling|half kneel|standing|seated|sitting|lying down|lying|laying|prone|supine|kneeling','posture')
 def limb_label(v):
  side='한' if v.split()[0] in ['one','1','single'] else '양'
  return side+('팔' if 'arm' in v else '손' if 'hand' in v else '발')
 remove(r'(?:one|1|single|two|2|double)\s+(?:arms?|armed|hands?|handed|legs?|legged)','limbs',limb_label)
 remove(r'alternating|alternate|unilateral|bilateral','limbs')
 remove(r'self assisted|assisted|weighted|unweighted','assistance')
 remove(r'isometric|static hold|static|paused|pause|negative|eccentric|concentric|slow|from deficit|deficit|partial|full range','execution')
 remove(r'hold','execution')
 remove(r'v\s+\d+','version',lambda v:'변형 '+re.search(r'\d+',v)[0])
 # Only remove a named attachment when its actual equipment is recorded.
 # Rope climbing/jumping and straight-arm pulldowns remain distinct motions.
 for tool,pattern,label in [('cable_rope',r'(?:with )?rope(?: attachment)?','로프 손잡이'),('v_handle',r'(?:with )?v bar(?: attachment)?','V 손잡이'),('cable_bar',r'bar attachment','바 손잡이')]:
  if tool in x['equipment']:remove(pattern,'attachment',lambda v,label=label:label)
 remove(r'left|right','side',lambda v:'왼쪽' if v=='left' else '오른쪽')
 s=re.sub(r'\b(?:with|on|from)\s*$',' ',s)
 s=re.sub(r'\s+',' ',s).strip()
 s=re.sub(r'\b(?:biceps|bicep)\b','biceps',s)
 s=re.sub(r'\b(?:triceps|tricep)\b','triceps',s)
 s=re.sub(r'\b(?:skull crusher|skullcrushers)\b','skullcrusher',s)
 s=re.sub(r'\bbent arms\b','bent arm',s)
 s=re.sub(r'\b(?:stability|swiss) ball\b','exercise ball',s)
 s=re.sub(r'\bbreeding\b','fly',s)
 s=re.sub(r'\bquads stretch\b','quad stretch',s)
 s=re.sub(r'\bgood mornings\b','good morning',s)
 s=re.sub(r'\bswings\b','swing',s)
 s=re.sub(r'\brack pulls\b','rack pull',s)
 # These are motion aliases; adding a different action (rotation, press,
 # pullover, etc.) keeps a distinct family through the remaining words.
 s=re.sub(r'\b(?:military|overhead) press\b','shoulder press',s)
 s=re.sub(r'\b(?:rear delt raise|rear lateral raise|rear fly|reverse flye?s?|reverse flyes)\b','rear delt fly',s)
 if re.search(r'\brear delt fly\b',s):remove(r'bent over|bentover','posture',lambda v:'상체 숙여서')
 if set(x['primaryMuscles']) & {'lats','upper_back'}:
  s=re.sub(r'\b(?:lat pull down|lateral pulldown|pulldown)\b','lat pulldown',s)
  s=re.sub(r'\blat lat pulldown\b','lat pulldown',s)
 if 'triceps' in x['primaryMuscles']:
  s=re.sub(r'\b(?:triceps )?push\s*downs?\b','triceps pushdown',s)
  s=re.sub(r'\b(?:triceps )?pushdown\b','triceps pushdown',s)
 return re.sub(r'\s+',' ',s).strip(),conditions

def condition_key(x):
 name,_=condition_name(x)
 plain=norm(display_name({**x,'name':name}))
 muscles=set(x['primaryMuscles'])
 if plain=='press':
  if 'chest' in muscles: name='chest press'
  elif muscles=={'shoulders'}: name='shoulder press'
 if plain=='extension' and muscles=={'triceps'}:name='triceps extension'
 base=key({**x,'name':name})
 # A source's explicitly left/right neck stretch is one display motion even
 # if that source omitted its muscle field. Unknown apparatus stays unknown.
 if plain=='levator scapulae stretch':base=(*base[:2],'')
 # Stripping "incline"/"standing" from a vague press must not combine a
 # shoulder movement with a chest movement. Keep ambiguous muscle anchors.
 anchor=tuple(sorted(x['primaryMuscles'])) if base[0] in {'press','extension','raise','rotation','fly','pull','curl'} else ()
 return (*base,anchor)

def build():
 raw=(ROOT/'public/catalog.json').read_bytes();catalog=json.loads(raw)
 byid={x['id']:x for x in catalog['exercises']}
 curated=set(re.findall(r"\['(ex_[a-f0-9]{14})'", (ROOT/'public/training.mjs').read_text()))
 legacy=defaultdict(list)
 for x in catalog['exercises']:legacy[key(x)].append(x)
 keys=sorted(legacy);parent=list(range(len(keys)))
 def find(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return i
 seen_keys={}
 for i,k in enumerate(keys):
  for x in legacy[k]:
   candidate=condition_key(x)
   if candidate in seen_keys:
    a,b=find(i),find(seen_keys[candidate])
    if a!=b:parent[max(a,b)]=min(a,b)
   else:seen_keys[candidate]=i
 groups=defaultdict(list)
 for i,k in enumerate(keys):groups[find(i)].extend(legacy[k])
 aliases={i:ids for ids in RECORD_ALIASES for i in ids}
 result=[]
 for _,rows in groups.items():
  rowids={x['id'] for x in rows}
  family_keys=sorted({key(x) for x in rows})
  rows.sort(key=lambda x:(x['id'] not in curated,len(condition_name(x)[1]),-len(x['sources']),len(display_name(x)),x['id']))
  names=[display_name({**x,'name':condition_name(x)[0]}) for x in rows] if len(family_keys)>1 else [display_name(x) for x in rows]
  names=[n for n in names if n] or [display_name(rows[0])]
  name=min(names,key=lambda n:(len(n),n.lower())).title()
  simple_keys={condition_key(x)[0] for x in rows}
  visible_keys=simple_keys if len(family_keys)>1 else {k[0] for k in family_keys}
  for plain,title in [('bench press','Bench Press'),('deadlift romanian','Romanian Deadlift'),('pushup','Pushups'),('pullup','Pullups')]:
   if plain in visible_keys:name=title
  muscles={m for x in rows for m in x['primaryMuscles']}
  for plain,title in [('chest press','Chest Press'),('press shoulder','Shoulder Press'),('extension tricep','Triceps Extension'),('delt fly rear','Rear Delt Fly'),('lat pulldown','Lat Pulldown'),('pushdown tricep','Triceps Pushdown')]:
   if plain in simple_keys:name=title
  if len(family_keys)>1:
   if name=='Curl' and muscles<={'biceps','forearms'}:name='Biceps Curl'
   if name=='Press' and 'chest' in muscles and muscles<={'chest','triceps'}:name='Chest Press'
   if name=='Press' and muscles=={'shoulders'}:name='Shoulder Press'
   if name=='Extension' and muscles=={'triceps'}:name='Triceps Extension'
  variants=[];seen=set()
  for x in rows:
   if x['id'] in seen:continue
   ids=[i for i in aliases.get(x['id'],[x['id']]) if i in rowids]
   representative=next((i for i in ids if i in curated),ids[0])
   seen.update(ids)
   variants.append({'id':representative,'exerciseIds':ids,'conditions':condition_name(byid[representative])[1]})
  # Family display IDs may change as families expand; durable IDs always refer
  # to the original exercise/condition, never to this display-only family.
  result.append({'id':'group_'+hashlib.sha256(json.dumps(family_keys).encode()).hexdigest()[:14],
   'name':name,'nameKo':korean(name),'variants':variants})
 # Names alone are not proof of a shared movement: a stretching/core source
 # may use the same title for a different action. Make retained cards clear.
 named=defaultdict(list)
 for g in result:named[g['nameKo']].append(g)
 for matches in named.values():
  if len(matches)<2:continue
  for g in matches:
   activities=sorted({byid[i]['activity'] for v in g['variants'] for i in v['exerciseIds']})
   g['nameKo']+=' · '+'·'.join(ACTIVITY_LABELS[a] for a in activities)
 result.sort(key=lambda g:(g['name'].lower(),g['id']))
 payload={'schema':3,'catalogSha256':hashlib.sha256(raw).hexdigest(),
  'meta':{'exerciseCount':len(byid),'equipmentGroupCount':len(legacy),'groupCount':len(result),
   'policy':'Display families normalize known equipment abbreviations, motion aliases and strength-sport categories, with grip, angle, posture, unilateral, assistance, execution, side, attachment and numbered options. Preserve functional movement/apparatus distinctions, original IDs, instructions, pictures and all equipment/condition records. Ambiguous same titles retain activity labels. Record aliases limited to explicitly reviewed pairs.'},'groups':result}
 ids=[i for g in result for v in g['variants'] for i in v['exerciseIds']]
 assert len(ids)==len(set(ids))==len(byid) and set(ids)==set(byid)
 assert len({g['nameKo'] for g in result})==len(result), 'Display titles still collide; review the motion before merging.'
 for g in result:
  for v in g['variants']:
   assert len({tuple(sorted(byid[i]['equipment'])) for i in v['exerciseIds']})==1
 (ROOT/'public/exercise-groups.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
 print(f"Display groups: {len(byid)} variants → {len(result)} exercises")

if __name__=='__main__':build()
