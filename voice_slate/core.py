"""Bounded data-only YAML cleanup; no native rendering or external file access."""
from __future__ import annotations

import copy
import hashlib
import math
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

import yaml
from yaml.events import AliasEvent, CollectionStartEvent, CollectionEndEvent, ScalarEvent

MAX_BYTES = 8 * 1024 * 1024
MAX_EVENTS = 250_000
MAX_DEPTH = 32
OVERRIDE_FIELDS = {"phoneme", "offset", "preutter_delta", "overlap_delta", "attack_time_delta", "release_time_delta"}
POLICY_FIELDS = {"singer", "render", "trackColor", "phonemeOverrideFields", "phonemeExpressions", "curves"}


class InvalidProject(ValueError):
    pass


class UniqueLoader(yaml.SafeLoader):
    def construct_object(self, node, deep=False):
        if isinstance(node,yaml.ScalarNode):
            tag=node.tag.removeprefix('tag:yaml.org,2002:')
            if tag=='int' and not re.fullmatch(r'[-+]?(?:0|[1-9][0-9]*)',node.value):
                raise InvalidProject('Only decimal integer syntax is supported')
            if tag=='float' and not re.fullmatch(r'[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?',node.value):
                raise InvalidProject('Only finite decimal float syntax is supported')
            if tag=='bool' and node.value not in ('true','false'):
                if node.value.lower()in ('true','false'):raise InvalidProject('Only lowercase boolean literals are supported')
                return node.value  # YAML 1.2: on/off/yes/no are strings.
            if tag=='timestamp':return node.value  # No implicit date type in YAML 1.2.
            if tag not in {'str','int','float','bool','null'}:raise InvalidProject('Unsupported scalar type')
        value=super().construct_object(node,deep=deep)
        if isinstance(node,yaml.ScalarNode)and node.tag=='tag:yaml.org,2002:int'and value==0 and node.value.startswith('-'):
            raise InvalidProject('Signed integer zero cannot be preserved')
        if isinstance(node,yaml.ScalarNode)and node.tag=='tag:yaml.org,2002:float':
            try:
                original=Decimal(node.value);serialized=Decimal(str(value))
                if original!=serialized or (original.is_zero()and original.is_signed()!=serialized.is_signed()):
                    raise InvalidProject('Numeric precision cannot be preserved; no output was produced')
            except (InvalidOperation,OverflowError)as error:
                raise InvalidProject('Unsupported numeric precision')from error
        return value

    def construct_mapping(self, node, deep=False):
        result = {}
        for key_node, value_node in node.value:
            if not isinstance(key_node, yaml.ScalarNode):
                raise InvalidProject("Only string mapping keys are supported")
            key = self.construct_object(key_node, deep=deep)
            if not isinstance(key,str):raise InvalidProject("Only string mapping keys are supported")
            if key in result:
                raise InvalidProject(f"Duplicate mapping key: {key}")
            result[key] = self.construct_object(value_node, deep=deep)
        return result


def parse(data: bytes):
    if not isinstance(data, bytes) or len(data) > MAX_BYTES:
        raise InvalidProject("Input exceeds 8 MiB")
    try:
        text = data.decode('utf-8-sig', errors='strict')
        depth = count = documents = 0
    except (UnicodeError, TypeError) as error:
        raise InvalidProject("Input must be UTF-8") from error
    allowed_tags = {None} | {'tag:yaml.org,2002:' + x for x in ['str','int','float','bool','null','seq','map']}
    try:
        for event in yaml.parse(text, Loader=yaml.SafeLoader):
            count += 1
            if count > MAX_EVENTS:
                raise InvalidProject("YAML event limit exceeded")
            if isinstance(event, AliasEvent) or getattr(event, 'anchor', None):
                raise InvalidProject("YAML aliases and anchors are unsupported")
            if getattr(event, 'tag', None) not in allowed_tags:
                raise InvalidProject("Unsupported YAML tag")
            if isinstance(event,ScalarEvent)and event.tag=='tag:yaml.org,2002:bool'and event.value not in ('true','false'):
                raise InvalidProject("Invalid explicit boolean")
            if isinstance(event,ScalarEvent)and event.style is None and re.fullmatch(r'[-+]?0[oObB][0-9_]+',event.value):
                raise InvalidProject("Nondecimal integer spelling is unsupported")
            if isinstance(event, yaml.events.DocumentStartEvent):
                documents += 1
                if documents > 1 or event.version or event.tags:
                    raise InvalidProject("One YAML document without directives is required")
            if isinstance(event, CollectionStartEvent):
                depth += 1
                if depth > MAX_DEPTH:
                    raise InvalidProject("YAML depth limit exceeded")
            elif isinstance(event, CollectionEndEvent):
                depth -= 1
            elif isinstance(event, ScalarEvent) and len(event.value) > 65536:
                raise InvalidProject("Scalar length limit exceeded")
        obj = yaml.load(text, Loader=UniqueLoader)
    except (yaml.YAMLError, RecursionError, ValueError, OverflowError) as error:
        raise InvalidProject("Malformed or unsupported YAML") from error
    def bounded(value):
        if value is None or isinstance(value, (str, bool)):
            return
        if isinstance(value, (int, float)):
            if abs(value) > 2**53 - 1 or (isinstance(value,float)and not math.isfinite(value)):
                raise InvalidProject("Nonfinite or imprecise numeric value")
        elif isinstance(value, list):
            for child in value: bounded(child)
        elif isinstance(value, dict):
            for child in value.values(): bounded(child)
        else:
            raise InvalidProject("Only plain YAML data is supported")
    bounded(obj)
    validate(obj)
    return obj


def mapping(value, label):
    if not isinstance(value, dict): raise InvalidProject(f"{label} must be a mapping")
    return value


def sequence(value, label, maximum):
    if not isinstance(value, list) or len(value) > maximum: raise InvalidProject(f"Invalid {label} collection")
    return value


def integer(value, label, low=0, high=2**31-1):
    if type(value) is not int or not low <= value <= high: raise InvalidProject(f"Invalid {label}")


def number(value,label,low=-1e9,high=1e9):
    if type(value)not in (int,float)or not math.isfinite(value)or not low<=value<=high:raise InvalidProject(f"Invalid {label}")


def validate(project):
    mapping(project, 'project')
    if project.get('ustx_version') != '0.10': raise InvalidProject("Only USTX 0.10 is supported")
    expressions = mapping(project.get('expressions'), 'expression definitions')
    for key, desc in expressions.items():
        mapping(desc, 'expression descriptor')
        if desc.get('abbr') != key: raise InvalidProject("Expression definition key/abbr mismatch")
    tracks = sequence(project.get('tracks'), 'tracks', 64)
    if not tracks: raise InvalidProject("At least one track is required")
    for track in tracks:
        mapping(track, 'track')
        for key in ['singer','phonemizer','track_name','track_color']:
            if key in track and track[key]is not None and not isinstance(track[key],str):raise InvalidProject(f"Invalid track {key}")
        if 'renderer_settings' in track:
            mapping(track['renderer_settings'], 'renderer settings')
            for value in track['renderer_settings'].values():
                if value is not None and not isinstance(value,str):raise InvalidProject("Invalid renderer binding")
        seen=set()
        for desc in sequence(track.get('track_expressions', []), 'track expression definitions', 256):
            mapping(desc,'track expression definition');abbr=desc.get('abbr')
            if not isinstance(abbr,str)or not abbr or abbr in seen:raise InvalidProject("Invalid or duplicate track expression abbreviation")
            seen.add(abbr)
    tempos=sequence(project.get('tempos'),'tempos',1000)
    meters=sequence(project.get('time_signatures'),'time signatures',1000)
    for tempo in tempos:mapping(tempo,'tempo')
    for meter in meters:mapping(meter,'meter')
    if not tempos or not meters or tempos[0].get('position')!=0 or meters[0].get('bar_position')!=0:raise InvalidProject("Timing maps must start at zero")
    last=-1
    for tempo in tempos:
        mapping(tempo,'tempo');integer(tempo.get('position'),'tempo position');number(tempo.get('bpm'),'tempo',1,1000)
        if tempo['position']<=last:raise InvalidProject("Tempo positions must increase")
        last=tempo['position']
    last=-1
    for meter in meters:
        mapping(meter,'meter');integer(meter.get('bar_position'),'meter position');integer(meter.get('beat_per_bar'),'beats per bar',1,64);integer(meter.get('beat_unit'),'beat unit',1,64)
        if meter['bar_position']<=last or meter['beat_unit']not in (1,2,4,8,16,32,64):raise InvalidProject("Invalid time signature map")
        last=meter['bar_position']
    if project.get('wave_parts', []) not in ([], None): raise InvalidProject("Wave parts are outside this voice-only scope")
    parts = sequence(project.get('voice_parts'), 'voice parts', 256)
    note_count = 0
    for part in parts:
        mapping(part, 'voice part')
        integer(part.get('track_no'), 'track number', high=len(tracks)-1)
        integer(part.get('position'), 'part position')
        integer(part.get('duration'), 'part duration', low=1)
        if part['position']+part['duration']>2**31-1:raise InvalidProject("Absolute part end exceeds native integer range")
        notes = sequence(part.get('notes'), 'notes', 10000)
        note_count += len(notes)
        if note_count > 10000: raise InvalidProject("Note limit exceeded")
        definitions = dict(expressions)
        for desc in tracks[part['track_no']].get('track_expressions', []):
            mapping(desc, 'track expression'); key=desc.get('abbr')
            if not isinstance(key,str): raise InvalidProject("Invalid track expression abbreviation")
            definitions[key]=desc
        previous_end = -1
        for note in notes:
            mapping(note, 'note')
            integer(note.get('position'), 'note position'); integer(note.get('duration'), 'note duration', low=10)
            integer(note.get('tone'), 'note tone', low=0, high=127)
            if note['position'] < previous_end: raise InvalidProject("Unordered or overlapping notes are unsupported")
            previous_end = note['position'] + note['duration']
            if previous_end > part['duration']: raise InvalidProject("Note exceeds its part")
            if not isinstance(note.get('lyric'),str): raise InvalidProject("Lyric must be a quoted string when ambiguous")
            pitch=mapping(note.get('pitch'),'pitch');points=sequence(pitch.get('data'),'pitch points',10000)
            if len(points)<2 or type(pitch.get('snap_first'))is not bool:raise InvalidProject("Invalid pitch shape")
            last_x=-math.inf
            for point in points:
                mapping(point,'pitch point');number(point.get('x'),'pitch X');number(point.get('y'),'pitch Y')
                if point['x']<=last_x or point.get('shape')not in ('io','i','o','l'):raise InvalidProject("Invalid pitch point order/shape")
                last_x=point['x']
            vibrato=mapping(note.get('vibrato'),'vibrato')
            for key,low,high in [('length',0,100),('period',5,500),('depth',5,200),('in',0,100),('out',0,100),('shift',0,100),('drift',-100,100),('vol_link',-100,100)]:number(vibrato.get(key),'vibrato '+key,low,high)
            if vibrato['in']+vibrato['out']>100:raise InvalidProject("Vibrato fades exceed its length")
            for exp in sequence(note.get('phoneme_expressions',[]),'phoneme expressions',256):
                mapping(exp,'phoneme expression')
                if not isinstance(exp.get('abbr'),str)or exp['abbr'] not in definitions: raise InvalidProject("Unresolved phoneme expression")
                if exp.get('index')is not None:integer(exp['index'],'expression index',high=255)
                number(exp.get('value'),'expression value')
            for override in sequence(note.get('phoneme_overrides',[]),'phoneme overrides',256):
                mapping(override,'phoneme override');integer(override.get('index'),'phoneme index',high=255)
                if override.get('phoneme')is not None and not isinstance(override['phoneme'],str):raise InvalidProject("Phoneme alias must be a string")
                if override.get('offset')is not None:integer(override['offset'],'phoneme offset',low=-2**31)
                for key in OVERRIDE_FIELDS-{'phoneme','offset'}:
                    if override.get(key)is not None:number(override[key],'phoneme '+key)
        for curve in sequence(part.get('curves',[]),'curves',256):
            mapping(curve,'curve')
            if not isinstance(curve.get('abbr'),str)or curve['abbr'] not in definitions: raise InvalidProject("Unresolved curve expression")
            xs=sequence(curve.get('xs'),'curve x coordinates',100000);ys=sequence(curve.get('ys'),'curve y coordinates',100000)
            if len(xs)!=len(ys): raise InvalidProject("Curve coordinates have different lengths")
            for x in xs:integer(x,'curve X')
            for y in ys:integer(y,'curve Y',low=-2**31)
            if any(a>=b for a,b in zip(xs,xs[1:])):raise InvalidProject("Curve X coordinates must increase")


def policy_checked(policy, project):
    mapping(policy, 'policy')
    if set(policy)-POLICY_FIELDS: raise InvalidProject("Unknown cleanup setting")
    result={k:policy.get(k,False)for k in ['singer','render','trackColor']}
    if any(type(v)is not bool for v in result.values()): raise InvalidProject("Settings must be true or false")
    for key in ['phonemeOverrideFields','phonemeExpressions','curves']:
        values=policy.get(key,[])
        if not isinstance(values,list) or len(values)>256 or any(not isinstance(x,str)for x in values) or len(set(values))!=len(values):
            raise InvalidProject("Cleanup lists need unique field names")
        if key=='phonemeOverrideFields' and set(values)-OVERRIDE_FIELDS: raise InvalidProject("Unsupported phoneme override field")
        result[key]=values.copy()
    definitions=set(project['expressions'])
    for track in project['tracks']: definitions.update(d['abbr']for d in track.get('track_expressions',[]))
    if any(x not in definitions for x in result['phonemeExpressions']+result['curves']):
        raise InvalidProject("Unknown selected expression abbreviation")
    return result


@dataclass
class Result:
    output: bytes
    review: dict


def clean(data: bytes, policy: dict, *, acknowledged=False):
    if acknowledged is not True: raise InvalidProject("Explicit review acknowledgment is required")
    original=parse(data); choices=policy_checked(policy,original);project=copy.deepcopy(original);changes=[]
    def remove(obj,key,path):
        if key in obj:
            changes.append({'path':path+[key],'before':obj[key],'operation':'remove'})
            del obj[key]
    for ti,track in enumerate(project['tracks']):
        path=['tracks',ti]
        if choices['singer']: remove(track,'singer',path)
        if choices['render']:
            for key in ['renderer','resampler','wavtool']:remove(track.get('renderer_settings',{}),key,path+['renderer_settings'])
        if choices['trackColor'] and track.get('track_color')!='Blue':
            changes.append({'path':path+['track_color'],'before':track.get('track_color'),'after':'Blue','operation':'set'})
            track['track_color']='Blue'
    for pi,part in enumerate(project['voice_parts']):
        pp=['voice_parts',pi]
        for ni,note in enumerate(part['notes']):
            np=pp+['notes',ni]
            for oi,override in enumerate(note.get('phoneme_overrides',[])):
                for key in choices['phonemeOverrideFields']:remove(override,key,np+['phoneme_overrides',oi])
            values=note.get('phoneme_expressions',[])
            for ei,exp in enumerate(values):
                if exp['abbr']in choices['phonemeExpressions']:changes.append({'path':np+['phoneme_expressions',ei],'before':exp,'operation':'remove'})
            if 'phoneme_expressions'in note:note['phoneme_expressions']=[v for v in values if v['abbr']not in choices['phonemeExpressions']]
        curves=part.get('curves',[])
        for ci,curve in enumerate(curves):
            if curve['abbr']in choices['curves']:changes.append({'path':pp+['curves',ci],'before':curve,'operation':'remove'})
        if 'curves'in part:part['curves']=[v for v in curves if v['abbr']not in choices['curves']]
    output=data if not changes else yaml.safe_dump(project,allow_unicode=True,sort_keys=False,width=1000).encode('utf-8')
    if len(output)>MAX_BYTES: raise InvalidProject("Output size limit exceeded")
    assert parse(output)==project
    return Result(output,{'format':'VoiceSlate review 1','scope':'USTX 0.10 voice-only selective settings copy',
        'sourceSha256':hashlib.sha256(data).hexdigest(),'outputSha256':hashlib.sha256(output).hexdigest(),
        'acknowledged':True,'policy':choices,'changes':changes,
        'retained':'Unselected data values, including lyrics, names and comments, remain. This is not anonymization.'})
