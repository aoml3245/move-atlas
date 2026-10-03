#!/usr/bin/env python3
"""Build an attributed catalog. Never execute upstream code or fetch upstream media."""
from pathlib import Path
from collections import Counter, defaultdict
from html.parser import HTMLParser
import json, re, hashlib, unicodedata

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data' / 'sources'
PUBLIC = ROOT / 'public'

PARTS = {
 'chest':'가슴','lats':'광배근','upper_back':'등·승모근','lower_back':'허리',
 'shoulders':'어깨','biceps':'이두','triceps':'삼두','forearms':'전완',
 'abs':'복부·코어','glutes':'엉덩이','quads':'허벅지 앞','hamstrings':'허벅지 뒤',
 'adductors':'허벅지 안쪽','abductors':'고관절·허벅지 바깥','calves':'종아리','neck':'목','pelvic_floor':'골반저근',
}
GEAR = {
 'dumbbell':'덤벨','barbell':'바벨','bench':'벤치','cable':'케이블 머신','machine':'웨이트 머신',
 'band':'밴드','kettlebell':'케틀벨','pullup_bar':'철봉','dip_bars':'평행봉',
 'smith':'스미스 머신','ez_bar':'EZ바','ball':'짐볼','bosu_ball':'보수볼','medicine_ball':'메디신볼',
 'box':'박스·스텝','foam_roller':'폼롤러','plates':'플레이트·중량추','suspension':'TRX·링',
 'wall':'벽','small_ball':'작은 공',
 'ab_straps':'복근 운동용 팔 슬링',
 'axle_bar':'액슬 바','band_anchor':'밴드 고정 지점',
 'cones':'운동용 콘','stable_support':'튼튼한 지지대',
 'balance_board':'밸런스 보드','seat':'의자·단단한 방석',
 'parallettes':'푸시업용 낮은 평행봉','hangboard':'클라이밍 행보드',
 'power_rack':'파워랙·안전바','bar_anchor':'바벨 고정 지점',
 'sandbag':'샌드백','loading_platform':'적재 플랫폼','atlas_stone':'아틀라스 스톤',
 'arm_blaster':'암 블라스터','fixed_bar':'고정 가로봉','towel':'수건',
 'chair':'튼튼한 의자',
 'hyperextension_bench':'로만체어·백 익스텐션 벤치',
 'captains_chair':'캡틴 체어·팔 받침 레그 레이즈 기구',
 'ankle_cuff':'케이블용 발목 커프','cable_rope':'케이블용 로프 손잡이','cable_bar':'케이블용 바 손잡이',
 'jump_rope':'줄넘기','harness':'슬레드용 하네스',
 'sledgehammer':'운동용 해머','tire':'대형 타이어','foam_pad':'폼패드·단단한 쿠션',
 'rickshaw_frame':'리크쇼 운반·데드리프트 프레임','body_bar':'가벼운 운동용 막대',
 'stretch_strap':'스트레칭 스트랩','chains':'운동용 중량 체인',
 'v_handle':'V바·삼각 손잡이',
 'keg':'스트롱맨 케그','strongman_log':'스트롱맨 로그',
 't_bar_handle':'T바 로우용 손잡이','dip_belt':'중량 딥 벨트',
 'cambered_bar':'캠버드 바벨','wrist_roller':'손목 롤러','flex_bar':'유연한 손목 저항 바',
 'heavy_bag':'매단 샌드백·헤비백','boxing_gloves':'복싱 글러브','hand_gripper':'손 스프링 그리퍼','sling_shot':'프레스 보조 밴드(슬링샷)',
 'sliders':'운동용 미끄럼판','yoke_frame':'요크 운반 프레임',
 'slide_board':'슬라이드 보드','safety_squat_bar':'안전 스쿼트 바','multi_grip_bar':'멀티그립 바',
 'rope':'로프','trap_bar':'트랩바','ab_wheel':'복근 롤러','preacher_bench':'프리처 벤치',
 'cardio_machine':'유산소 머신','sled':'슬레드','partner':'파트너','pool':'수영 환경','kickboard':'수영 킥판','other':'기타 특수 도구','unknown':'도구 확인 필요',
}
SOURCES = {
 'free':{'name':'Free Exercise DB','url':'https://github.com/yuhonas/free-exercise-db','license':'Unlicense','licenseUrl':'/licenses/free-exercise-db.txt'},
 'dataset':{'name':'Exercises Dataset','url':'https://github.com/hasaneyldrm/exercises-dataset','license':'MIT (메타데이터)','licenseUrl':'/licenses/exercises-dataset.txt'},
 'wger':{'name':'wger','url':'https://wger.de','license':'항목별 Creative Commons','licenseUrl':'https://github.com/wger-project/wger#license'},
 'liftosaur':{'name':'Liftosaur','url':'https://github.com/astashov/liftosaur','license':'AGPL-3.0','licenseUrl':'/licenses/liftosaur.txt'},
}
EQUIPMENT_MAP = {
 'dumbbell':'dumbbell','barbell':'barbell','olympic barbell':'barbell','cable':'cable','cable machine':'cable',
 'leverage machine':'machine','leveragemachine':'machine','machine':'machine','smith machine':'smith','smith':'smith',
 'bands':'band','band':'band','resistance band':'band','kettlebells':'kettlebell','kettlebell':'kettlebell',
 'body only':None,'body weight':None,'bodyweight':None,'none (bodyweight exercise)':None,'gym mat':None,
 'e-z curl bar':'ez_bar','ez barbell':'ez_bar','ezbar':'ez_bar','sz-bar':'ez_bar',
 'foam roll':'foam_roller','roller':'foam_roller','exercise ball':'ball','stability ball':'ball','swiss ball':'ball',
 'medicine ball':'medicine_ball','medicineball':'medicine_ball','pull-up bar':'pullup_bar',
 'bench':'bench','incline bench':'bench','trap bar':'trap_bar','trapbar':'trap_bar','weighted':'plates',
 'rope':'rope','assisted':'partner','sled machine':'sled','other':'other',
 'upper body ergometer':'cardio_machine','skierg machine':'cardio_machine','stationary bike':'cardio_machine',
 'elliptical machine':'cardio_machine','stepmill machine':'cardio_machine',
 'bosu ball':'ball','wheel roller':'ab_wheel','tire':'other','hammer':'other',
}

def norm(s):
 s=''.join(c for c in unicodedata.normalize('NFKD', str(s)) if not unicodedata.combining(c)).lower().replace('’', "'")
 return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+',' ',s)).strip()

def muscle(s):
 s=norm(s)
 mapping={'abdominals':'abs','abs':'abs','obliques':'abs','serratus anterior':'abs','rectus abdominis':'abs',
 'obliquus externus abdominis':'abs','biceps femoris':'hamstrings','hamstrings':'hamstrings','quads':'quads',
 'quadriceps':'quads','quadriceps femoris':'quads','biceps':'biceps','brachialis':'biceps','biceps brachii':'biceps',
 'triceps':'triceps','triceps brachii':'triceps','pectorals':'chest','chest':'chest','forearms':'forearms',
 'lats':'lats','upper back':'upper_back','middle back':'upper_back','traps':'upper_back','lower back':'lower_back',
 'erector spinae':'lower_back','shoulders':'shoulders','delts':'shoulders','neck':'neck','calves':'calves',
 'soleus':'calves','gastrocnemius':'calves','glutes':'glutes','abductors':'abductors','adductors':'adductors'}
 if s in mapping:return mapping[s]
 for pattern,part in [(r'pectoralis','chest'),(r'latissimus|teres major','lats'),
   (r'trapezius|levator scapulae|rhomboid','upper_back'),(r'deltoid|infraspinatus|supraspinatus|teres minor|rotator','shoulders'),
   (r'triceps','triceps'),(r'biceps(?! femoris)|brachialis','biceps'),(r'brachioradialis|wrist|carpi|forearm|pronator','forearms'),
   (r'glute','glutes'),(r'quadriceps|vastus|rectus femoris','quads'),(r'hamstring|femoris|semitendin|semimembran','hamstrings'),
   (r'adductor|pectine','adductors'),(r'abductor|tensor fascia|iliopsoas|sartorius','abductors'),
   (r'abdom|oblique|serratus','abs'),(r'gastrocnemius|soleus|calf|calves|tibialis','calves'),
   (r'erector|lower back','lower_back'),(r'sternocleido|neck|splenius','neck')]:
  if re.search(pattern,s):return part
 return None

def unique(xs):return list(dict.fromkeys(x for x in xs if x))

def parse_blocks(text, declaration):
 part=text.split(declaration,1)[1].split('\n};',1)[0]
 return re.findall(r'^  (\w+): \{\n(.*?)^  \},?$',part,re.M|re.S)

def js_strings(body,key):
 m=re.search(r'\b'+key+r':\s*(\[[^\]]*\])',body,re.S)
 return json.loads(re.sub(r',\s*\]',']',m.group(1))) if m else []

class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,data):self.parts.append(data)
def plain(s):
 p=Text();p.feed(s or '');return re.sub(r'\s+',' ',' '.join(p.parts)).strip()

def family(n):
 n=norm(n)
 rules=[
  ('stretch',r'stretch|yoga|child s pose|downward dog|pigeon pose|cobra pose'),
  ('recovery',r'breathing|\bkegel|\bkegels|meditation|^rest\b|pelvic endurance|pelvic tilts|pelvic wave'),
  ('cardio',r'\brunning\b|\brun\b|\bjogging\b|\bwalking\b|treadmill|elliptical|\bcycling\b|stationary bike|\browing machine\b|\bskierg\b|climbmill|stepmill|\bjump rope\b|\bswim|schwimmen|stroke and roll|kick with board|recovery bobbing|bobbing exhale'),
  ('wrist_curl',r'wrist curl|reverse wrist curl'),('leg_curl',r'leg curl|nordic curl|hamstring curl'),
  ('leg_extension',r'leg extension'),('triceps_extension',r'tricep.*extension|skull ?crush|lying french press|push ?down|tricep.*kick ?back'),
  ('curl',r'\bcurl\b|\bcurls\b'),('bench_press',r'bench press|floor press|chest press|(?:incline|decline|lying).*press'),
  ('lateral_raise',r'lateral raise|side lateral|rear delt raise|reverse fly|rear delt fly'),
  ('fly',r'\bfly\b|\bflyes\b|\bflies\b|crossover|butterfly|pec deck'),
  ('front_raise',r'front raise|forward raise'),('shoulder_press',r'shoulder press|military press|overhead press|arnold press'),
  ('pullup',r'pull ?up|chin ?up|\bchins\b'),('pulldown',r'pull ?down'),('row',r'\brow\b|\brows\b'),
  ('deadlift',r'dead ?lift'),('lunge',r'\blunge\b|\blunges\b|split squat'),('squat',r'\bsquat\b|\bsquats\b'),
  ('calf_raise',r'calf|calves'),('pushup',r'push ?up|press ?up'),('dip',r'\bdip\b|\bdips\b'),
  ('shrug',r'\bshrug'),('hip',r'hip thrust|glute bridge|hip bridge|hip abduction|hip adduction|glute kick'),
  ('hinge',r'good morning|back extension|hyperextension|kettlebell swing'),('plank',r'\bplank\b|side bridge'),
  ('crunch',r'\bcrunch|sit ?up|leg raise|knee raise|\bab wheel\b|\bab rollout\b|dead bug|russian twist'),
  ('carry',r'farmer|\bcarry\b|\bwalk\b'),('olympic',r'\bsnatch\b|\bclean\b|\bjerk\b'),
  ('jump',r'\bjump|\bhop\b|\bbound\b|burpee'),
 ]
 for label,pattern in rules:
  if re.search(pattern,n):return label
 return 'other'

FAMILY_NAMES={'stretch':'스트레칭','recovery':'호흡·회복','cardio':'유산소','wrist_curl':'손목 컬','leg_curl':'레그 컬','leg_extension':'레그 익스텐션',
 'triceps_extension':'삼두 운동','curl':'컬','bench_press':'벤치·플로어 프레스','fly':'플라이','lateral_raise':'레터럴 레이즈',
 'front_raise':'프런트 레이즈','shoulder_press':'숄더 프레스','pullup':'풀업·친업','pulldown':'풀다운','row':'로우',
 'deadlift':'데드리프트','squat':'스쿼트','lunge':'런지','calf_raise':'종아리 운동','pushup':'푸시업','dip':'딥스',
 'shrug':'슈러그','hip':'힙 운동','hinge':'힙 힌지','plank':'플랭크','crunch':'코어 운동','carry':'캐리','olympic':'역도','jump':'점프','other':'기타 동작'}
FAMILY_PARTS={'wrist_curl':['forearms'],'leg_curl':['hamstrings'],'leg_extension':['quads'],
 'triceps_extension':['triceps'],'curl':['biceps'],'bench_press':['chest'],'fly':['chest'],
 'lateral_raise':['shoulders'],'front_raise':['shoulders'],'shoulder_press':['shoulders'],
 'pullup':['lats'],'pulldown':['lats'],'row':['lats','upper_back'],'deadlift':['glutes','hamstrings','lower_back'],
 'squat':['quads','glutes'],'lunge':['quads','glutes'],'calf_raise':['calves'],'pushup':['chest'],
 'dip':['triceps','chest'],'shrug':['upper_back'],'hip':['glutes'],'hinge':['lower_back','glutes','hamstrings'],
 'plank':['abs'],'crunch':['abs'],'carry':['forearms','abs'],'olympic':['quads','shoulders'],'jump':['quads','glutes']}

def infer_gear(name, originals, activity, fid, instructions=''):
 n=norm(name);gear=unique(EQUIPMENT_MAP.get(str(x).lower(),'unknown') for x in originals if x is not None)
 hint_name=re.sub(r'\bit band\b','iliotibial',n)
 # An EZ bar is one tool, even when a source calls it an "EZ barbell".
 hint_name=re.sub(r'\be z curl bar\b|\bez barbell\b|\bez curl bar\b','ez bar',hint_name)
 notes=[]
 hints=[(r'\bdumbbell\b','dumbbell'),(r'\bbarbell\b','barbell'),(r'\bkettlebell\b','kettlebell'),
 (r'\bcable\b','cable'),(r'\bsmith\b','smith'),(r'\bband\b|\bbands\b','band'),(r'\bez bar\b|\bezbar\b','ez_bar'),
 (r'exercise ball|stability ball|swiss ball|bosu','ball'),(r'medicine ball','medicine_ball'),
 (r'foam roll|\broller\b|\bsmr\b','foam_roller'),(r'\bab wheel\b|\bab rollout\b','ab_wheel'),
 (r'\bsuspended\b|\bsuspension\b|\btrx\b|\brings\b','suspension'),(r'battle rope|battling rope|jump rope','rope'),
 (r'\btrap bar\b','trap_bar'),(r'\bsled\b','sled'),(r'\bplate\b|\bweighted\b','plates'),
 (r'treadmill|elliptical|stepmill|climbmill|stationary bike|skierg|rowing machine','cardio_machine')]
 for pattern,key in hints:
  if re.search(pattern,hint_name) and key not in gear:gear.append(key);notes.append('동작 이름에서 필요한 도구 보완')
 # An assisted machine is a machine, not necessarily a partner.
 if 'partner' in gear and re.search(r'\bmachine\b',n):gear.remove('partner');gear.append('machine')
 if re.search(r'^lever\b|\bmachine\b|\bhackenschmitt\b',n) and not any(x in gear for x in ['cable','smith','cardio_machine','sled']):gear.append('machine')
 if re.search(r'multi ?press',n):gear.append('smith')
 if re.search(r'\bswim|schwimmen|stroke and roll|kick with board|recovery bobbing|bobbing exhale',n):gear.append('pool')
 if re.search(r'\bring\b|\brings\b',n):gear.append('suspension')
 if re.search(r'\bdeadhang\b|fingerboard|sloper hanging',n):gear.append('pullup_bar')
 if 'machine' not in gear and (re.search(r'\bbench\b|\bpreacher\b',n) or (fid in ['bench_press','fly'] and 'floor' not in n and any(x in gear for x in ['barbell','dumbbell','ez_bar','kettlebell','smith']))):
  gear.append('preacher_bench' if 'preacher' in n else 'bench')
 if 'machine' not in gear and not re.search(r'\bfloor\b|\bball\b|glute bridge',n) and any(g in gear for g in ['barbell','dumbbell','ez_bar','kettlebell']) and (re.search(r'\b(?:incline|decline|seated|lying)\b',n) or ('pullover' in n and 'standing' not in n)):
  gear.append('bench')
 if re.search(r'glute bridge',n):gear=[g for g in gear if g!='bench']
 # Some source equipment fields omit the furniture used in their setup.
 # Read only the opening setup sentences; later optional variations are ignored.
 setup=norm(' '.join(instructions.split('.')[:2]))
 optional_bench=bool(re.search(r'\bor (?:a |an |the )?(?:chair|stand|standing)|\bstanding.{0,40}instead|instead.{0,40}standing',setup))
 if 'machine' not in gear and not optional_bench and re.search(r'choose a flat bench|sit on.{0,80}bench|lie (?:down |face down |face up )?on.{0,40}bench',setup):
  gear.append('bench');notes.append('원본 준비 자세에 명시된 벤치 반영')
 if re.search(r'get onto the.{0,40}machine|adjust the.{0,50}machine',setup) and not any(g in gear for g in ['cable','smith','cardio_machine']):
  gear.append('machine');notes.append('원본 준비 자세에 명시된 머신 반영')
 if fid=='pullup' and 'machine' not in gear:gear.append('pullup_bar')
 if re.search(r'\bmuscle up\b|\binverted row\b|\bhorizontal row\b',n) and not any(g in gear for g in ['machine','suspension']):gear.append('pullup_bar')
 if re.search(r'\bhanging\b',n) and 'machine' not in gear:gear.append('pullup_bar')
 if fid=='dip' and 'machine' not in gear and not re.search(r'\bbench\b|\bchair\b|\brings?\b',n) and 'suspension' not in gear:gear.append('dip_bars')
 if re.search(r'^support hold$',n) and not gear:gear=['unknown']
 if re.search(r'\bbox\b|\bstep up\b|\bstepup\b|bench sprint',n):gear.append('box' if 'bench' not in n else 'bench')
 if len(gear)>1:gear=[x for x in gear if x not in ['unknown','other']]
 if 'cardio_machine' in gear:gear=[g for g in gear if g!='machine']
 known_unloaded=r'breathing|kegel|pelvic|meditation|^rest\b|ankle|wrist circle|cat cow|handstand|deadbug|dead bug|flutter kick|scissor|wall sit|high knees|mountain climb|cossack|pistol squat|hindu squat|hip circle|glute bridge|fire hydrant|happy baby|snap down|squat jump|squat stand|wall angel|shoulder rotation|head tilt|head turn|neck circle|chin tuck'
 if not gear and not originals and not (activity=='stretching' or fid in ['pushup','plank','crunch','jump','cardio','recovery'] or re.search(known_unloaded,n)):gear=['unknown']
 return sorted(set(gear)),bool(notes or len(gear)!=len(unique(EQUIPMENT_MAP.get(str(x).lower()) for x in originals if x is not None)))

def canonical(name, gear):
 s=str(name).lower()
 # Gender/camera annotations describe the illustration, not a new movement.
 s=re.sub(r'\((?:male|female|front view|side view|back view)\)',' ',s)
 s=norm(s)
 substitutions=[
  ('biceps curls','bicep curl'),('biceps curl','bicep curl'),('bicep curls','bicep curl'),
  ('triceps','tricep'),('two handed','two arm'),('2 handed','two arm'),('one handed','one arm'),
  ('single arm','one arm'),('single leg','one leg'),
  ('alternating','alternate'),('flyes','fly'),('flies','fly'),('flys','fly'),('curls','curl'),('rows','row'),
  ('raises','raise'),('extensions','extension'),('push ups','pushup'),('push up','pushup'),('pushups','pushup'),
  ('press ups','pushup'),('press up','pushup'),('pull ups','pullup'),('pull up','pullup'),('pullups','pullup'),
  ('chin ups','chinup'),('chin up','chinup'),('chinups','chinup'),('sit ups','situp'),('sit up','situp'),
  ('pull downs','pulldown'),('pull down','pulldown'),('pulldowns','pulldown'),('push downs','pushdown'),('push down','pushdown'),
  ('dead lift','deadlift'),('deadlifts','deadlift'),('dips','dip'),('squats','squat'),('lunges','lunge'),('shrugs','shrug'),
  ('lying down','lying'),('laying','lying'),('bent over','bentover'),('close grip','narrow grip'),
  ('palm up','supinated grip'),('palms up','supinated grip'),
  ('palm down','pronated grip'),('palms down','pronated grip'),('calves','calf'),('legs','leg'),
  ('stiff legged','stiff leg'),('straight legged','straight leg'),('press up','pushup'),
  ('military press','overhead press'),('side lateral raise','lateral raise'),('side bridge','side plank'),
  ('bicycle crunch','bicycle crunch'),('abdominals','abdominal'),('e z curl bar','ez bar'),
 ]
 for a,b in substitutions:s=re.sub(r'\b'+re.escape(a)+r'\b',b,s)
 equipment_phrases={'dumbbell':['dumbbell','dumbbells'],'barbell':['barbell','barbells'],
 'kettlebell':['kettlebell','kettlebells'],'cable':['cable'],'machine':['leverage machine','lever','machine'],
 'smith':['smith machine','smith'],'band':['resistance band','bands','band'],'ez_bar':['ez barbell','ez bar','ezbar'],
 'ball':['exercise ball','stability ball','swiss ball'],'medicine_ball':['medicine ball'],'trap_bar':['trap bar']}
 for g in gear:
  for word in equipment_phrases.get(g,[]):s=re.sub(r'\b'+re.escape(word)+r'\b',' ',s)
 s=re.sub(r'\bbody ?weight\b|\bbody weight\b',' ',s)
 s=re.sub(r'\b(?:with|on|the|a|an|and|of|for|using|two arm|normal|standard)\b',' ',s)
 fid=family(s)
 if fid in ['squat','lunge','leg_curl','leg_extension','calf_raise']:s=re.sub(r'\bunilateral\b','one leg',s)
 elif fid in ['row','curl','front_raise','lateral_raise','shoulder_press','triceps_extension']:s=re.sub(r'\bunilateral\b','one arm',s)
 if fid in ['curl','shrug'] and not re.search(r'preacher|incline|seated|lying|concentration',s):s=re.sub(r'\bstanding\b',' ',s)
 if fid=='bench_press':s=re.sub(r'\bflat\b',' ',s)
 if fid=='curl' and not re.search(r'leg|wrist|tricep|reverse|hammer',s):s=re.sub(r'\bbicep\b',' ',s)
 # Word order changes do not create a different movement; repeated tokens remain.
 return ' '.join(sorted(norm(s).split())) or norm(name)

# Naming dictionary, not a copy of instructional text. Unknown terms retain the original English.
PHRASES={
 'bench press':'벤치프레스','floor press':'플로어 프레스','chest press':'체스트 프레스','shoulder press':'숄더 프레스',
 'overhead press':'오버헤드 프레스','military press':'밀리터리 프레스','arnold press':'아놀드 프레스',
 'lateral raise':'레터럴 레이즈','front raise':'프런트 레이즈','rear delt raise':'리어 델트 레이즈',
 'reverse fly':'리버스 플라이','bent over':'벤트오버','rear lateral raise':'리어 레터럴 레이즈',
 'biceps curl':'바이셉스 컬','bicep curl':'바이셉스 컬','hammer curl':'해머 컬','preacher curl':'프리처 컬',
 'concentration curl':'컨센트레이션 컬','wrist curl':'손목 컬','leg curl':'레그 컬','leg extension':'레그 익스텐션',
 'triceps extension':'삼두 익스텐션','tricep extension':'삼두 익스텐션','skullcrusher':'스컬크러셔','skull crusher':'스컬크러셔',
 'triceps pushdown':'삼두 푸시다운','triceps kickback':'삼두 킥백','calf raise':'카프 레이즈','calves':'종아리',
 'hip thrust':'힙 스러스트','glute bridge':'글루트 브리지','hip bridge':'힙 브리지','good morning':'굿모닝',
 'romanian deadlift':'루마니안 데드리프트','stiff legged':'스티프 레그','stiff leg':'스티프 레그',
 'pull up':'풀업','pullup':'풀업','chin up':'친업','chinup':'친업','push up':'푸시업','pushup':'푸시업',
 'sit up':'싯업','situp':'싯업','pull down':'풀다운','pulldown':'풀다운','push down':'푸시다운',
 'one arm':'한팔','single arm':'한팔','two arm':'양팔','one leg':'한발','single leg':'한발','two leg':'양발',
 'behind the neck':'비하인드 넥','behind neck':'비하인드 넥','behind the back':'등 뒤','cross body':'크로스바디',
 'close grip':'클로즈 그립','wide grip':'와이드 그립','narrow grip':'내로우 그립','reverse grip':'리버스 그립',
 'neutral grip':'뉴트럴 그립','underhand grip':'언더핸드 그립','overhand grip':'오버핸드 그립',
 'palm up':'손바닥 위','palms up':'손바닥 위','palm down':'손바닥 아래','palms down':'손바닥 아래',
 'exercise ball':'짐볼','stability ball':'짐볼','swiss ball':'짐볼','medicine ball':'메디신볼',
 'body weight':'맨몸','bodyweight':'맨몸','resistance band':'저항 밴드','smith machine':'스미스 머신',
 'leverage machine':'머신','ez barbell':'EZ바','e z curl bar':'EZ바','ez bar':'EZ바','trap bar':'트랩바',
 'ab wheel':'복근 롤러','back extension':'백 익스텐션','leg press':'레그 프레스','leg raise':'레그 레이즈',
 'knee raise':'니 레이즈','split squat':'스플릿 스쿼트','bulgarian':'불가리안','russian twist':'러시안 트위스트',
 'face pull':'페이스 풀','upright row':'업라이트 로우','t bar row':'티바 로우','standing':'스탠딩',
 'seated':'시티드','sitting':'앉아서','lying':'라잉','laying':'라잉','incline':'인클라인','decline':'디클라인',
 'alternate':'얼터네이트','alternating':'얼터네이팅','unilateral':'한쪽','dumbbell':'덤벨','barbell':'바벨',
 'kettlebell':'케틀벨','cable':'케이블','band':'밴드','lever':'머신','machine':'머신','weighted':'중량',
 'assisted':'보조','suspended':'서스펜션','bench':'벤치','floor':'바닥','wall':'벽','box':'박스',
 'squat':'스쿼트','deadlift':'데드리프트','lunge':'런지','row':'로우','curl':'컬','raise':'레이즈',
 'press':'프레스','fly':'플라이','flyes':'플라이','flys':'플라이','crunch':'크런치','plank':'플랭크',
 'dip':'딥','dips':'딥스','shrug':'슈러그','extension':'익스텐션','kickback':'킥백','crossover':'크로스오버',
 'stretch':'스트레칭','stretching':'스트레칭','jump':'점프','burpee':'버피','snatch':'스내치','clean':'클린','jerk':'저크',
 'hammer':'해머','sumo':'스모','front':'프런트','rear':'리어','reverse':'리버스','side':'사이드',
 'biceps':'이두','triceps':'삼두','chest':'가슴','shoulder':'숄더','shoulders':'어깨','neck':'목',
 'leg':'레그','legs':'레그','hip':'힙','glute':'글루트','abdominal':'복부','abdominals':'복부',
 'calf':'카프','wrist':'손목','finger':'손가락','forearm':'전완','back':'백','head':'머리',
 'rotation':'회전','external':'외회전','internal':'내회전','adduction':'내전','abduction':'외전',
 'straight':'스트레이트','bent':'구부린','wide':'와이드','narrow':'내로우','high':'하이','low':'로우',
 'neutral':'뉴트럴','pronated':'오버핸드','supinated':'언더핸드','prone':'엎드린','supine':'누운',
 'kneeling':'무릎 꿇은','knee':'무릎','half':'하프','full':'풀','deep':'딥','close':'클로즈',
 'single':'싱글','double':'더블','power':'파워','walking':'워킹','running':'러닝','jogging':'조깅',
 'treadmill':'트레드밀','elliptical':'일립티컬','bike':'바이크','cycling':'사이클링','rope':'로프',
 'plate':'플레이트','foam roll':'폼롤러','roller':'롤러','smr':'폼롤러 마사지','isometric':'등척성',
 'hold':'홀드','touch':'터치','touchers':'터치','swing':'스윙','swings':'스윙','bridge':'브리지',
 'ball':'볼','rollout':'롤아웃','pullover':'풀오버','pull over':'풀오버','step up':'스텝업','step':'스텝',
 'inverted':'인버티드','hang':'행','hanging':'행잉','v bar':'V바','donkey':'동키','frog':'프로그',
 'bicycle':'바이시클','air':'에어','pistol':'피스톨','sissy':'시시','hack':'핵','jefferson':'제퍼슨',
 'deficit':'디피싯','pause':'포즈','paused':'포즈','explosive':'익스플로시브','plyo':'플라이오',
 'toe':'발끝','toes':'발끝','heel':'뒤꿈치','heels':'뒤꿈치','ankle':'발목','elbow':'팔꿈치','arm':'암',
 'arms':'암','hand':'손','hands':'손','foot':'발','feet':'발','knee':'니','oblique':'복사근',
 'obliques':'복사근','scapular':'견갑','scapula':'견갑','shoulder blades':'견갑','serratus':'전거근',
 'traps':'승모근','lat':'광배','lats':'광배','deltoid':'삼각근','delt':'델트','delts':'델트',
 'hamstring':'햄스트링','hamstrings':'햄스트링','quad':'쿼드','quads':'쿼드','quadriceps':'대퇴사두근',
 'adductor':'내전근','abductor':'외전근','glutes':'둔근','forearms':'전완','thoracic':'흉추','lumbar':'요추',
 'pectoral':'가슴','pec':'가슴','open':'오픈','close':'클로즈','horizontal':'수평','vertical':'수직',
 'leaning':'기울인','forward':'앞으로','backward':'뒤로','overhead':'오버헤드','over':'위로',
 'supported':'지지','support':'지지','elevated':'높인','raised':'높인','extended':'편','flexion':'굴곡',
 'flexor':'굴곡근','extensor':'신전근','retraction':'후인','protraction':'전인','rotation':'회전',
 'in':'인','out':'아웃','around':'어라운드','world':'월드','up':'업','down':'다운','to':'투',
 'and':'앤드','with':'위드','on':'온','at':'앳','of':'오브','the':'','a':'','an':'',
 'upper':'상부','lower':'하부','middle':'중부','cross':'크로스','crab':'크랩','bird dog':'버드독','dead bug':'데드버그',
 'mountain climber':'마운틴 클라이머','superman':'슈퍼맨','hyperextension':'하이퍼익스텐션','suspension':'서스펜션',
 'swimmer':'스위머','swimming':'수영','farmer s walk':'파머스 워크','farmer':'파머','carry':'캐리','walk':'워크',
 'towel':'타월','chair':'의자','push':'푸시','pull':'풀','pushdown':'푸시다운','pullthrough':'풀스루',
 'good mornings':'굿모닝','preacher':'프리처','concentration':'컨센트레이션','french':'프렌치','scott':'스콧',
 'breeding':'플라이','butterfly':'버터플라이','flat':'플랫','cobra':'코브라','child s pose':'차일드 포즈',
 'cat':'캣','cow':'카우','yoga':'요가','pose':'포즈','pigeon':'피전','downward dog':'다운워드 독',
}

def korean(name):
 s=norm(re.sub(r'\((?:male|female|front view|side view|back view)\)',' ',str(name),flags=re.I))
 for a,b in [('raises','raise'),('extensions','extension'),('curls','curl'),('rows','row'),('squats','squat'),('lunges','lunge'),('pullups','pullup'),('pushups','pushup'),('chinups','chinup'),('shrugs','shrug'),('push ups','pushup'),('pull ups','pullup'),('chin ups','chinup')]:s=re.sub(r'\b'+a+r'\b',b,s)
 pattern=r'\b(?:'+'|'.join(re.escape(x) for x in sorted(PHRASES,key=len,reverse=True))+r')\b'
 return re.sub(r'\s+',' ',re.sub(pattern,lambda m:PHRASES[m.group(0)],s)).strip()

def raw_entries():
 entries=[]
 def add(source,id,name,equipment,primary,secondary,activity,instructions='',aliases=None,license=None,url=None,author=None):
  entries.append(dict(source=source,sourceId=str(id),name=name,equipment=equipment,primary=primary,secondary=secondary,activity=activity,instructions=instructions,aliases=aliases or [],license=license or SOURCES[source]['license'],url=url or SOURCES[source]['url'],author=author or '',credits=[]))
 for x in json.loads((RAW/'free-exercise-db.json').read_text()):
  add('free',x['id'],x['name'],[x['equipment']] if x.get('equipment') else [],x['primaryMuscles'],x['secondaryMuscles'],x['category'],'\n'.join(x['instructions']),url='https://github.com/yuhonas/free-exercise-db/blob/main/exercises/'+x['id']+'.json')
 for x in json.loads((RAW/'exercises-dataset.json').read_text()):
  add('dataset',x['id'],x['name'],[x['equipment']],[x['target']],x.get('secondary_muscles',[]),'cardio' if x['category']=='cardio' else 'stretching' if 'stretch' in x['name'] else 'strength',x['instructions'].get('en',''))
 for x in json.loads((RAW/'wger-all.json').read_text()):
  en=next(t for t in x['translations'] if t['language']==2)
  aliases=[]
  for t in x['translations']:
   aliases.append(t['name'])
   for a in t.get('aliases',[]):aliases.append(a.get('alias',a.get('name','')) if isinstance(a,dict) else str(a))
  add('wger',x['id'],en['name'],[g['name'] for g in x['equipment']],[m['name'] for m in x['muscles']],[m['name'] for m in x['muscles_secondary']], 'stretching' if 'stretch' in en['name'].lower() else 'cardio' if x['category']['name'].lower()=='cardio' else 'strength',plain(en.get('description','')),aliases,x['license']['short_name'],'https://wger.de/en/exercise/'+str(x['id'])+'/view/',x.get('license_author',''))
  licenses={1:('CC-BY-SA-3.0','https://creativecommons.org/licenses/by-sa/3.0/'),2:('CC-BY-SA-4.0','https://creativecommons.org/licenses/by-sa/4.0/'),3:('CC0-1.0','https://creativecommons.org/publicdomain/zero/1.0/')}
  entry=entries[-1]
  entry['licenseUrl']=licenses[x['license']['id']][1]
  entry['instructionLicense'],entry['instructionLicenseUrl']=licenses[en['license']]
  entry['author']='; '.join(unique([x.get('license_author',''),en.get('license_author','')]+x.get('total_authors_history',[])+en.get('author_history',[])))
  entry['authorStatus']='provided' if entry['author'] else 'not-supplied-by-upstream'
  for t in x['translations']:
   license_id,license_url=licenses[t['license']]
   entry['credits'].append({'title':t.get('license_title') or t['name'],'languageId':t['language'],'authors':unique([t.get('license_author','')]+t.get('author_history',[])), 'license':license_id,'licenseUrl':license_url,'url':entry['url'],'authorUrl':t.get('license_author_url',''),'originalSourceUrl':t.get('license_derivative_source_url',''),'objectUrl':t.get('license_object_url','')})
   entry['credits'][-1]['authorStatus']='provided' if entry['credits'][-1]['authors'] else 'not-supplied-by-upstream'
 s=(RAW/'liftosaur.ts').read_text();meta={}
 for key,body in parse_blocks(s,'export const metadata:'):
  meta[key]={k:js_strings(body,k) for k in ['targetMuscles','synergistMuscles','sortedEquipment']}
 image_part=(RAW/'liftosaur-images.ts').read_text().split('const availableSmallImages = new Set([',1)[1].split(']);',1)[0]
 actual_images=set(re.findall(r'"([a-z0-9_]+)"',image_part))
 for key,body in parse_blocks(s,'export const allExercisesList:'):
  name=json.loads(re.search(r'\bname: ("[^\n]+"),',body).group(1))
  for eq in meta[key]['sortedEquipment']:
   # Use all declared equipment variants, including ones without an illustration.
   add('liftosaur',key+'_'+eq,name,[eq],meta[key]['targetMuscles'],meta[key]['synergistMuscles'],'cardio' if family(name)=='cardio' else 'strength',url='https://github.com/astashov/liftosaur/blob/master/src/models/exercise.ts')
 return entries

def build():
 entries=raw_entries();groups=defaultdict(list)
 for x in entries:
  fid=family(x['name']);activity=x['activity']
  if fid=='stretch':activity='stretching'
  if fid=='cardio':activity='cardio'
  if fid=='recovery':activity='recovery'
  gear,inferred=infer_gear(x['name'],x['equipment'],activity,fid,x['instructions'])
  x.update(gear=gear,gearInferred=inferred,family=fid,activity=activity,canonical=canonical(x['name'],gear))
  # Stretching remains separate from loaded strength work with an ambiguous name.
 # Fill missing equipment only when an identical normalized movement has one
 # unambiguous equipment set across the other records. Never choose between alternatives.
 equipment_by_name=defaultdict(set)
 muscles_by_name=defaultdict(list)
 for x in entries:
  if 'unknown' not in x['gear']:equipment_by_name[x['canonical']].add(tuple(x['gear']))
  muscles_by_name[x['canonical']]+=x['primary']
 for x in entries:
  candidates=equipment_by_name[x['canonical']]
  if x['gear']==['unknown'] and len(candidates)==1:
   x['gear']=list(next(iter(candidates)));x['gearInferred']=True
  if not x['primary'] and muscles_by_name[x['canonical']]:x['primary']=unique(muscles_by_name[x['canonical']]);x['musclesBorrowed']=True
  groups[(x['canonical'],tuple(x['gear']),x['activity']=='stretching')].append(x)
 catalog=[];merges=[]
 priority={'free':0,'liftosaur':1,'wger':2,'dataset':3}
 for key,rows in groups.items():
  rows.sort(key=lambda x:(priority[x['source']],len(x['name'])))
  representative=rows[0];name=representative['name'];fid=family(name)
  primary=unique(muscle(m) for x in rows for m in x['primary'])
  secondary=unique(muscle(m) for x in rows for m in x['secondary'])
  supplemented=[]
  if fid in ['wrist_curl','leg_curl','leg_extension','triceps_extension','calf_raise']:
   expected=FAMILY_PARTS[fid]
   if primary!=expected:primary=expected;supplemented.append('동작 이름에 따른 주요 부위 정리')
  if not primary and fid in FAMILY_PARTS:primary=FAMILY_PARTS[fid];supplemented.append('동작 이름으로 주요 부위 보완')
  if not primary:
   name_rules=[(r'kegel|pelvic','pelvic_floor'),(r'hamstring|nordic|toe touch','hamstrings'),(r'quad|knee bend|quad set','quads'),
    (r'glute|pigeon|figure four|fire hydrant','glutes'),(r'adduct|butterfly stretch','adductors'),(r'abduct|hip flexor|hip circle','abductors'),
    (r'calf|calves|ankle|tibialis|skipping','calves'),(r'neck|head turn|head tilt|chin tuck','neck'),
    (r'forearm|wrist|finger|hand grip|flexbar|sloper','forearms'),(r'shoulder|rotator|arm circle|ywt|axe hold|y pull|band pull apart','shoulders'),
    (r'pec |chest|ball hug','chest'),(r'lat stretch|back lever|arch hang','lats'),(r'thoracic|open book','upper_back'),
    (r'lower back|cat cow|spine|back bridge|scorpion|cobra|upward facing|skydiver','lower_back'),
    (r'breathing|pelvic tilt|deadbug|dead bug|l hold|bent knee iron cross','abs')]
   primary=unique(part for pattern,part in name_rules if re.search(pattern,norm(name)))
   if primary:supplemented.append('명시된 동작·신체 부위로 분류 보완')
  if re.search(r'reverse nordic',norm(name)):primary=['quads'];supplemented.append('리버스 노르딕의 허벅지 앞쪽 분류')
  if fid=='fly' and re.search(r'reverse|rear',norm(name)):primary=['shoulders'];supplemented.append('리어 델트 동작 분류')
  secondary=[m for m in secondary if m not in primary]
  regions=[]
  if set(primary)&{'chest','lats','upper_back','lower_back','shoulders','biceps','triceps','forearms','neck'}:regions.append('upper')
  if set(primary)&{'glutes','quads','hamstrings','adductors','abductors','calves'}:regions.append('lower')
  if set(primary)&{'abs','lower_back','pelvic_floor'}:regions.append('core')
  activity=representative['activity']
  if activity=='cardio' or (set(regions)&{'upper'} and 'lower' in regions):regions.append('full')
  if activity=='recovery' and not primary:regions.append('recovery')
  if not regions:regions=['uncategorized']
  aliases=unique([r['name'] for r in rows]+[a for r in rows for a in r['aliases']])
  display=korean(name)
  # Gear not encoded in Liftosaur's names must be visible in the title.
  if representative['source']=='liftosaur' and representative['equipment']:
   tool=EQUIPMENT_MAP.get(representative['equipment'][0]);display=(GEAR.get(tool,'맨몸')+' '+display).strip()
  id='ex_'+hashlib.sha256(json.dumps(key,ensure_ascii=False).encode()).hexdigest()[:14]
  pnames=' · '.join(PARTS[x] for x in primary) or '주요 부위 확인 필요'
  toolnames=' · '.join(GEAR[x] for x in representative['gear']) or '맨몸'
  summary=(f'{pnames} 중심의 ' if primary else '')+({'stretching':'스트레칭','cardio':'유산소 운동','recovery':'호흡·회복 항목'}.get(activity,'운동'))+'입니다. '
  summary+=('별도 도구 없이 수행하는 항목입니다.' if not representative['gear'] else '준비할 도구: '+toolnames+'.')
  sources=[{k:r[k] for k in ['source','sourceId','name','url','license','author','credits']} for r in rows]
  for source_record,row in zip(sources,rows):
   source_record['licenseUrl']=row.get('licenseUrl',SOURCES[row['source']]['licenseUrl'])
   if row.get('authorStatus'):source_record['authorStatus']=row['authorStatus']
  provenance={'primaryMuscles':'movement-rule' if supplemented else 'source-normalized','equipment':'source-and-name-rules' if any(r['gearInferred'] for r in rows) else 'source-normalized','regions':'derived-from-primary-muscles','nameKo':'editorial-terminology','summaryKo':'editorial-metadata-summary'}
  item=dict(id=id,name=name,nameKo=display,aliases=aliases,primaryMuscles=primary,secondaryMuscles=secondary,regions=unique(regions),equipment=representative['gear'],activity=activity,movement=fid,movementLabel=FAMILY_NAMES[fid],summaryKo=summary,sources=sources,provenance=provenance,
   needsReview=bool('unknown' in representative['gear'] or (not primary and activity not in ['cardio','recovery'])),supplements=unique(supplemented+(['필요 도구를 이름 또는 일치하는 원본에서 보완'] if any(r['gearInferred'] for r in rows) else [])+(['일치하는 다른 원본의 주요 부위 반영'] if any(r.get('musclesBorrowed') for r in rows) else [])))
  instruction=next((r for r in rows if r['instructions']),None)
  if instruction:item['originalInstructions']={'text':instruction['instructions'],'source':instruction['source'],'license':instruction.get('instructionLicense',instruction['license']),'licenseUrl':instruction.get('instructionLicenseUrl',instruction.get('licenseUrl',SOURCES[instruction['source']]['licenseUrl'])),'url':instruction['url'],'author':instruction['author'],'changes':'HTML tags removed; whitespace normalized. No translation of this original text.'}
  catalog.append(item)
  if len(rows)>1:merges.append({'id':id,'key':key,'names':[r['source']+': '+r['name']+' ['+r['sourceId']+']' for r in rows]})
 # Apply explicit source-reviewed corrections after grouping to preserve IDs
 # used by saved favorites and the ongoing image-production queue.
 corrections_path=ROOT/'data'/'catalog-corrections.json'
 corrections=json.loads(corrections_path.read_text()) if corrections_path.exists() else {}
 for item in catalog:
  correction=corrections.get(item['id'])
  if not correction:continue
  if not any(s['source']==correction['source'] and s['sourceId']==correction['sourceId'] for s in item['sources']):
   raise ValueError('Correction source no longer matches '+item['id'])
  if set(correction['equipment'])-set(GEAR):raise ValueError('Unknown correction gear')
  item['equipment']=correction['equipment']
  item['provenance']['equipment']='reviewed-source-clarification'
  item['equipmentClarification']={k:correction[k] for k in ['source','sourceId','sourceUrl','reason','reviewer']}
  if correction.get('additionalSourceUrl'):
   item['equipmentClarification']['additionalSourceUrl']=correction['additionalSourceUrl']
  item['supplements']=unique(item['supplements']+[correction['noteKo']])
  item['summaryKo']=item['summaryKo'].split('입니다. ')[0]+'입니다. '+('준비할 도구: '+' · '.join(GEAR[g] for g in item['equipment'])+'.' if item['equipment'] else '별도 도구 없이 수행하는 항목입니다.')
  item['needsReview']=bool('unknown' in item['equipment'] or (not item['primaryMuscles'] and item['activity'] not in ['cardio','recovery']))
 if set(corrections)-{x['id'] for x in catalog}:raise ValueError('Unresolved catalog correction ID')
 catalog.sort(key=lambda x:x['name'].casefold())
 report={'checkedAt':'2026-10-02','inputCounts':dict(Counter(x['source'] for x in entries)),'inputTotal':len(entries),'catalogTotal':len(catalog),'mergedAway':len(entries)-len(catalog),'mergedGroups':len(merges),'needsReview':sum(x['needsReview'] for x in catalog),
 'dedupPolicy':'Normalize aliases, word order, plurals and equipment names; retain posture, grip, angle, unilateral, assisted, weighted and numbered variations. No fuzzy similarity auto-merges.',
 'mediaIncluded':False,'classificationPolicy':'Source muscle data normalized into common regions; absent fields and named equipment supplemented with explicit deterministic rules. Editorial summaries are metadata summaries, not training prescriptions.',
 'sourceFiles':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in RAW.iterdir() if f.is_file()}}
 payload={'meta':report,'sources':SOURCES,'muscles':PARTS,'equipment':GEAR,'exercises':catalog}
 payload['meta']['licensePolicy']='Mixed-license collection. Imported expression keeps the source license; see NOTICE.md. No blanket relicensing of third-party material.'
 (PUBLIC/'catalog.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
 (ROOT/'work').mkdir(exist_ok=True)
 (ROOT/'work'/'merge-audit.json').write_text(json.dumps(merges,ensure_ascii=False,indent=2))
 (ROOT/'work'/'catalog-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 # Every imported record is retained in an exercise's provenance, even after merging.
 assert len({x['id'] for x in catalog})==len(catalog)
 assert sum(len(x['sources']) for x in catalog)==len(entries)
 assert len({(s['source'],s['sourceId']) for x in catalog for s in x['sources']})==len(entries)
 assert all(set(x['equipment'])<=set(GEAR) and set(x['primaryMuscles'])<=set(PARTS) for x in catalog)
 print(json.dumps({k:report[k] for k in ['inputCounts','inputTotal','catalogTotal','mergedAway','mergedGroups','needsReview']},ensure_ascii=False,indent=2))

if __name__=='__main__':build()
