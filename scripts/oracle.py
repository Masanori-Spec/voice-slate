"""Independent literal oracle: imports neither prototype nor native author."""
from pathlib import Path
import copy,hashlib,json,re,yaml

E=Path('evidence')
def plain_yaml(text):
    # Independent fixed-evidence reader: BaseLoader has no implicit resolvers.
    # Interpret canonical plain decimal/boolean/null scalars; quoted values,
    # on/off/yes/no and date-looking values stay strings (YAML 1.2).
    def visit(node):
        if isinstance(node,yaml.MappingNode):return {k.value:visit(v)for k,v in node.value}
        if isinstance(node,yaml.SequenceNode):return [visit(v)for v in node.value]
        value=node.value
        if node.style is not None:return value
        if value in ('true','false'):return value=='true'
        if value in ('null','~',''):return None
        if re.fullmatch(r'[-+]?(?:0|[1-9][0-9]*)',value):return int(value)
        if re.fullmatch(r'[-+]?(?:[0-9]+\.[0-9]*|\.[0-9]+)(?:[eE][-+]?[0-9]+)?',value):return float(value)
        return value
    return visit(yaml.compose(text,Loader=yaml.BaseLoader))
load=lambda name:plain_yaml((E/name).read_text(encoding='utf-8-sig'))
source=load('native-input.ustx');actual=load('cleaned.ustx')
assert source['ustx_version']=='0.10'
assert source['name']=='VoiceSlate Native Fixture'
assert source['comment']=='Synthetic values remain unless selected'
assert source['key']==3
assert source['tempos']==[{'position':0,'bpm':137},{'position':1920,'bpm':149}]
assert source['time_signatures']==[{'bar_position':0,'beat_per_bar':4,'beat_unit':4},{'bar_position':2,'beat_per_bar':3,'beat_unit':4}]
PARTS=[('Part 1',0,0,1920),('Part 2',0,3840,1920),('Part 3',1,960,1920)]
# Six independently written note tuples and three-point pitch sentinels.
NOTES=[
 (0,240,60,'あ',0,[(-25,3),(5,-2),(80,1)],110,7,12,'custom-0',20),
 (600,360,61,'null',12,[(-25,4),(5,-3),(80,2)],111,8,13,'custom-1',21),
 (0,240,62,'雪',24,[(-25,5),(5,-4),(80,3)],112,9,14,'custom-2',22),
 (600,360,63,'la',36,[(-25,6),(5,-5),(80,4)],113,10,15,'custom-3',23),
 (0,240,64,'echo',48,[(-25,7),(5,-6),(80,5)],114,11,16,'custom-4',24),
 (600,360,65,'終',60,[(-25,8),(5,-7),(80,6)],115,12,17,'custom-5',25),
]
VIBRATO={'length':55,'period':173,'depth':33,'in':12,'out':17,'shift':23,'drift':-5,'vol_link':15}
CURVES=[
 [('dyn',[0,-10,0]),('brec',[5,10,5]),('pitd',[0,30,-10])],
 [('dyn',[0,-11,0]),('brec',[5,11,5]),('pitd',[0,31,-10])],
 [('dyn',[0,-12,0]),('brec',[5,12,5]),('pitd',[0,32,-10])],
]
assert len(source['tracks'])==2 and len(source['voice_parts'])==3
for i,t in enumerate(source['tracks']):
 assert t['singer']==['VoiceSlate Missing 0','VoiceSlate Missing 1'][i]
 assert t['track_name']==['Lead α','Harmony 雪'][i]
 assert t['track_color']==['Orange','Purple'][i]
 assert t['volume']==[-3.5,-2.5][i]and t['pan']==[-0.2,0.3][i]
 assert t['renderer_settings']=={'renderer':f'SYNTHETIC_RENDERER_{i}','resampler':f'SYNTHETIC_RESAMPLER_{i}','wavtool':f'SYNTHETIC_WAVTOOL_{i}'}
 assert t['track_expressions'][0]['abbr']=='vsl'
for pi,(part,expected_part)in enumerate(zip(source['voice_parts'],PARTS)):
 assert tuple(part[k]for k in ['name','track_no','position','duration'])==expected_part
 assert len(part['notes'])==2
 assert [(c['abbr'],c['ys'])for c in part['curves']]==CURVES[pi]
 assert all(c['xs']==[0,240,600]for c in part['curves'])
 for ni,note in enumerate(part['notes']):
  pos,dur,tone,lyric,tuning,points,vel,vsl,offset,alias,gen=NOTES[pi*2+ni]
  assert tuple(note[k]for k in ['position','duration','tone','lyric','tuning'])==(pos,dur,tone,lyric,tuning)
  assert note['pitch']=={'data':[{'x':x,'y':y,'shape':'io'}for x,y in points],'snap_first':False}
  assert note['vibrato']==VIBRATO
  assert note['phoneme_expressions']==[{'index':0,'abbr':'clr','value':1},{'index':0,'abbr':'gen','value':gen},{'index':0,'abbr':'vel','value':vel},{'index':0,'abbr':'vsl','value':vsl}]
  assert note['phoneme_overrides']==[{'index':0,'phoneme':alias,'offset':offset,'preutter_delta':5,'overlap_delta':-3,'attack_time_delta':2,'release_time_delta':-1}]

# Exact whole-document expected result. Only these literal fixture paths may
# change; unfamiliar/unselected data is compared too, not reconstructed.
expected=copy.deepcopy(source)
for t in expected['tracks']:
 del t['singer']
 t['renderer_settings']={}
 t['track_color']='Blue'
for part in expected['voice_parts']:
 part['curves']=part['curves'][1:]
 for note in part['notes']:
  note['phoneme_expressions']=note['phoneme_expressions'][2:]
  del note['phoneme_overrides'][0]['phoneme']
  del note['phoneme_overrides'][0]['preutter_delta']

def assert_output(value):assert value==expected,'A retained value changed or selected data remains'
assert_output(actual)
assert actual['expressions']==source['expressions']

review=json.loads((E/'review.json').read_text());assert review['acknowledged']is True and len(review['changes'])==37
assert review['sourceSha256']==hashlib.sha256((E/'native-input.ustx').read_bytes()).hexdigest()
assert review['outputSha256']==hashlib.sha256((E/'cleaned.ustx').read_bytes()).hexdigest()
paths=[]
for ti in range(2):
 paths += [('tracks',ti,'singer'),('tracks',ti,'track_color')]
 paths += [('tracks',ti,'renderer_settings',k)for k in ['renderer','resampler','wavtool']]
for pi in range(3):
 paths += [('voice_parts',pi,'curves',0)]
 for ni in range(2):
  paths += [('voice_parts',pi,'notes',ni,'phoneme_expressions',k)for k in [0,1]]
  paths += [('voice_parts',pi,'notes',ni,'phoneme_overrides',0,k)for k in ['phoneme','preutter_delta']]
assert len(paths)==37 and set(map(tuple,(x['path']for x in review['changes'])))==set(paths)
for change in review['changes']:
 value=source
 for k in change['path']:value=value[k]
 assert change['before']==value

# The production deserializer itself, BEFORE AddDefaultExpressions/AfterLoad/
# ValidateFull, must see the same 37 effects and all retained musical values.
native_input=json.loads((E/'native-input-prevalidation.json').read_text())
native_output=json.loads((E/'native-output-prevalidation.json').read_text())
native_expected=copy.deepcopy(native_input)
for t in native_expected['tracks']:
 t.update(singer=None,renderer=None,resampler=None,wavtool=None,TrackColor='Blue')
for part in native_expected['parts']:
 part['curves']=part['curves'][1:]
 for note in part['notes']:
  note['expressions']=note['expressions'][2:]
  note['overrides'][0].update(phoneme=None,preutterDelta=None)
def assert_native_output(value):assert value==native_expected,'Production deserializer sees altered retained data'
assert_native_output(native_output)
canonical_input=load('native-input-canonical.ustx');canonical_output=load('native-output-canonical.ustx')
assert canonical_input==source
assert canonical_output==expected

loaded=json.loads((E/'native-loaded.json').read_text());reopened=json.loads((E/'native-reopened.json').read_text())
assert loaded==reopened
normalized=copy.deepcopy(native_output)
for t in normalized['tracks']:t['phonemizer']=None
assert loaded==normalized,'Unexpected native musical normalization'
assert load('native-saved.ustx')==expected
assert (E/'native-saved.ustx').read_bytes()==(E/'native-reopened-saved.ustx').read_bytes()

negative=[]
for name,label in [('negative-pitch','changed retained pitch point'),('negative-curve','deleted unselected breath curve')]:
    try:assert_output(load(name+'.ustx'))
    except AssertionError:pass
    else:raise AssertionError('Raw negative control passed: '+name)
    try:assert_native_output(json.loads((E/(name+'-prevalidation.json')).read_text()))
    except AssertionError:negative.append(label)
    else:raise AssertionError('Native deserializer negative control passed: '+name)
immutable=json.loads((E/'source-immutability.json').read_text());assert immutable['unchanged']and immutable['before']==immutable['after']==review['sourceSha256']
assert hashlib.sha256((E/'native-input.ustx').read_bytes()).hexdigest()==immutable['before']
result={'status':'pass','tracks':2,'voiceParts':3,'notes':6,'explicitChanges':37,'rawWholeDocumentEquality':True,
 'productionDeserializerBeforeValidation':True,'retainedMusicalState':True,'freshNativeLoadSaveReopen':True,
 'nativeNormalization':'AfterLoad consumes the serialized track phonemizer name; Save restores the unchanged runtime type.',
 'sourceUnchanged':True,'negativeControls':negative,'cleanedSha256':review['outputSha256']}
(E/'independent-oracle-result.json').write_text(json.dumps(result,indent=2)+'\n')
print('Independent whole-document/literal/native oracle passed, including both corruption controls')
