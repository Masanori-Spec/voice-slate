import copy,json,os
from pathlib import Path
import subprocess,sys,tempfile,unittest
import yaml

from voice_slate.core import InvalidProject,MAX_BYTES,clean,parse


def fixture():
    """Small handwritten unit input, not the hosted native proof fixture."""
    return {'name':'unit 雪','comment':'retained name and comment','ustx_version':'0.10',
        'expressions':{k:{'abbr':k,'name':k}for k in ['gen','vel','dyn','brec']},
        'tempos':[{'position':0,'bpm':137}],
        'time_signatures':[{'bar_position':0,'beat_per_bar':4,'beat_unit':4}],
        'tracks':[{'track_name':'lead','singer':'synthetic','phonemizer':'default',
                   'renderer_settings':{'renderer':'synthetic','resampler':'synthetic','wavtool':'synthetic'},'track_color':'Orange','track_expressions':[]}],
        'voice_parts':[{'name':'part','position':0,'duration':1920,'track_no':0,'notes':[
            {'position':0,'duration':480,'tone':60,'lyric':'null','tuning':12,
             'pitch':{'data':[{'x':-25,'y':3,'shape':'io'},{'x':80,'y':-2,'shape':'l'}],'snap_first':False},
             'vibrato':{'length':55,'period':173,'depth':33,'in':12,'out':17,'shift':23,'drift':-5,'vol_link':15},
             'phoneme_expressions':[{'index':0,'abbr':'gen','value':20},{'index':0,'abbr':'vel','value':115}],
             'phoneme_overrides':[{'index':0,'phoneme':'alias','offset':12,'preutter_delta':5,'overlap_delta':-3}]}],
             'curves':[{'abbr':'dyn','xs':[0,240],'ys':[0,-10]},{'abbr':'brec','xs':[0,240],'ys':[5,10]}]}],
        'wave_parts':[], 'unselected_extension':{'unknown':'retained','list':[1,2,'on']}}


def encode(obj):return yaml.safe_dump(obj,allow_unicode=True,sort_keys=False).encode()


POLICY={'singer':True,'render':True,'trackColor':True,'phonemeOverrideFields':['phoneme','preutter_delta'],'phonemeExpressions':['gen'],'curves':['dyn']}


class CoreTests(unittest.TestCase):
    def test_selective_copy_preserves_every_other_value(self):
        source=fixture();expected=copy.deepcopy(source);t=expected['tracks'][0];del t['singer'];t['renderer_settings']={};t['track_color']='Blue'
        n=expected['voice_parts'][0]['notes'][0];n['phoneme_expressions']=n['phoneme_expressions'][1:];del n['phoneme_overrides'][0]['phoneme'];del n['phoneme_overrides'][0]['preutter_delta'];expected['voice_parts'][0]['curves']=expected['voice_parts'][0]['curves'][1:]
        raw=encode(source);before=raw[:];result=clean(raw,POLICY,acknowledged=True)
        self.assertEqual(parse(result.output),expected);self.assertEqual(raw,before);self.assertEqual(len(result.review['changes']),9)

    def test_explicit_acknowledgment(self):
        with self.assertRaises(InvalidProject):clean(encode(fixture()),POLICY)

    def test_no_settings_means_byte_identical(self):
        raw=b'\xef\xbb\xbf'+encode(fixture())
        self.assertEqual(clean(raw,{},acknowledged=True).output,raw)

    def test_independent_categories(self):
        p=fixture();result=parse(clean(encode(p),{'singer':True},acknowledged=True).output)
        self.assertEqual(result['tracks'][0]['renderer_settings'],p['tracks'][0]['renderer_settings'])
        self.assertEqual(result['voice_parts'],p['voice_parts'])

    def test_repeat_cleanup_is_idempotent(self):
        a=clean(encode(fixture()),POLICY,acknowledged=True);b=clean(a.output,POLICY,acknowledged=True)
        self.assertEqual(a.output,b.output);self.assertEqual(b.review['changes'],[])

    def test_unknown_policy_and_fields(self):
        for p in [{'surprise':True},{'singer':1},{'phonemeOverrideFields':['index']},{'curves':['unknown']},{'curves':['dyn','dyn']},{'phonemeExpressions':'gen'}]:
            with self.subTest(p=p),self.assertRaises(InvalidProject):clean(encode(fixture()),p,acknowledged=True)

    def test_invalid_structures(self):
        mutators=[lambda p:p.update(ustx_version='0.9'),lambda p:p.update(tracks=[]),lambda p:p.update(tempos=[0]),
            lambda p:p['voice_parts'][0].update(track_no=3),lambda p:p['voice_parts'][0]['notes'][0].update(lyric=True),
            lambda p:p['voice_parts'][0]['notes'][0].update(duration=0),lambda p:p['voice_parts'][0]['notes'][0]['pitch'].update(data=[]),
            lambda p:p['voice_parts'][0]['notes'][0]['vibrato'].update(period=1),
            lambda p:p['voice_parts'][0]['curves'][0].update(ys=[1]),lambda p:p['voice_parts'][0]['curves'][0].update(xs=[240,0]),
            lambda p:p['voice_parts'][0]['notes'][0]['phoneme_expressions'][0].update(abbr=['bad']),
            lambda p:p['voice_parts'][0]['notes'][0]['phoneme_expressions'][0].update(abbr='missing'),
            lambda p:p['tracks'][0].update(renderer_settings='not a map'),lambda p:p.update(wave_parts=[{'relative_path':'outside.wav'}])]
        for i,mutate in enumerate(mutators):
            p=fixture();mutate(p)
            with self.subTest(i=i),self.assertRaises(InvalidProject):parse(encode(p))

    def test_resource_and_yaml_rejections(self):
        cases=[b'x'*(MAX_BYTES+1),b'\xff',b'---\nx: 1\n---\nx: 2\n',b'x: &a [1]\ny: *a\n',b'x: !unsafe y\n',b'x: 1\nx: 2\n',b'<<: {x: 1}',b'? [x,y]\n: bad',b'x: '+b'['*40+b'0'+b']'*40,b'x: .nan',b'x: !!timestamp 2020-01-01',b'%YAML 1.1\n---\nx: 1']
        for i,data in enumerate(cases):
            with self.subTest(i=i),self.assertRaises(InvalidProject):parse(data)

    def test_scalar_and_event_limits(self):
        with self.assertRaises(InvalidProject):parse(b'x: '+b'a'*65537)
        with self.assertRaises(InvalidProject):parse(b'x:\n'+b'- []\n'*125001)

    def test_ambiguous_yaml_scalar_rejections(self):
        for scalar in [b'060',b'0x40',b'0o40',b'1:20',b'!!bool on',b'FALSE',b'1_000',b'9'*4000,b'9'*5000]:
            with self.subTest(scalar=scalar[:20]),self.assertRaises(InvalidProject):parse(b'x: '+scalar)

    def test_yaml12_strings_and_dates_remain_strings(self):
        raw=encode(fixture())+b'plain_on: on\nplain_off: off\nplain_yes: yes\nplain_date: 2020-01-01\n'
        obj=parse(raw);self.assertEqual([obj[k]for k in ['plain_on','plain_off','plain_yes','plain_date']],['on','off','yes','2020-01-01'])
        self.assertEqual(parse(clean(raw,POLICY,acknowledged=True).output)['plain_on'],'on')

    def test_unused_track_descriptors_and_absolute_end(self):
        for desc in [[{}],[{'abbr':'x'},{'abbr':'x'}]]:
            p=fixture();p['tracks'].append({'track_expressions':desc})
            with self.assertRaises(InvalidProject):parse(encode(p))
        p=fixture();p['voice_parts'][0]['position']=2147483647
        with self.assertRaises(InvalidProject):parse(encode(p))

    def test_input_float_and_ambiguity(self):
        p=fixture();p['voice_parts'][0]['notes'][0]['lyric']='on';raw=encode(p)
        self.assertEqual(parse(raw)['voice_parts'][0]['notes'][0]['lyric'],'on')
        p['extra']=float('inf')
        with self.assertRaises(InvalidProject):parse(encode(p))

    def test_cli_exclusive_and_source_unchanged(self):
        with tempfile.TemporaryDirectory()as temp:
            r=Path(temp);source=r/'in.ustx';source.write_bytes(encode(fixture()));policy=r/'policy.json';policy.write_text(json.dumps(POLICY));before=source.read_bytes()
            base=[sys.executable,'-m','voice_slate',str(source),str(r/'out.ustx'),'--policy',str(policy),'--report',str(r/'review.json'),'--acknowledge']
            self.assertEqual(subprocess.run(base,capture_output=True,timeout=5).returncode,0)
            self.assertNotEqual(subprocess.run(base,capture_output=True,timeout=5).returncode,0)
            self.assertEqual(source.read_bytes(),before)
            report=json.loads((r/'review.json').read_text());self.assertTrue(report['acknowledged'])

    def test_cli_fifo_and_symlink_rejection(self):
        if not hasattr(os,'mkfifo'):self.skipTest('POSIX only')
        with tempfile.TemporaryDirectory()as temp:
            r=Path(temp);policy=r/'policy.json';policy.write_text('{}');fifo=r/'input';os.mkfifo(fifo)
            args=[sys.executable,'-m','voice_slate',str(fifo),str(r/'out'),'--policy',str(policy),'--report',str(r/'report'),'--acknowledge']
            self.assertNotEqual(subprocess.run(args,capture_output=True,timeout=2).returncode,0)
            original=r/'original';original.write_bytes(encode(fixture()));link=r/'link';link.symlink_to(original);args[3]=str(link)
            self.assertNotEqual(subprocess.run(args,capture_output=True,timeout=2).returncode,0)

    def test_cli_rejects_output_report_alias(self):
        with tempfile.TemporaryDirectory()as temp:
            r=Path(temp);source=r/'in';source.write_bytes(encode(fixture()));policy=r/'policy';policy.write_text('{}')
            args=[sys.executable,'-m','voice_slate',str(source),str(r/'same'),'--policy',str(policy),'--report',str(r/'same'),'--acknowledge']
            self.assertNotEqual(subprocess.run(args,capture_output=True,timeout=2).returncode,0)
            self.assertFalse((r/'same').exists())

    def test_review_only_does_not_write_copy(self):
        with tempfile.TemporaryDirectory()as temp:
            r=Path(temp);source=r/'in';source.write_bytes(encode(fixture()));policy=r/'policy';policy.write_text(json.dumps(POLICY))
            args=[sys.executable,'-m','voice_slate',str(source),str(r/'out'),'--policy',str(policy),'--report',str(r/'review'),'--review-only']
            self.assertEqual(subprocess.run(args,capture_output=True,timeout=2).returncode,0);self.assertFalse((r/'out').exists())
            self.assertFalse(json.loads((r/'review').read_text())['acknowledged'])


if __name__=='__main__':unittest.main()
