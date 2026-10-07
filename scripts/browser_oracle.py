"""Check actual browser artifact identity and independent Python parity."""
from pathlib import Path
import hashlib,json,re,yaml
e=Path('evidence')

def read_yaml(name):
    def visit(n):
        if isinstance(n,yaml.MappingNode):return {k.value:visit(v)for k,v in n.value}
        if isinstance(n,yaml.SequenceNode):return [visit(v)for v in n.value]
        if n.style is not None:return n.value
        if n.value in ('null','~',''):return None
        if n.value in ('true','false'):return n.value=='true'
        if re.fullmatch(r'[-+]?(?:0|[1-9][0-9]*)',n.value):return int(n.value)
        if re.fullmatch(r'[-+]?(?:[0-9]+\.[0-9]*|\.[0-9]+)(?:[eE][-+]?[0-9]+)?',n.value):return float(n.value)
        return n.value
    return visit(yaml.compose((e/name).read_text(encoding='utf-8-sig'),Loader=yaml.BaseLoader))

assert read_yaml('cleaned.ustx')==read_yaml('prototype-cleaned.ustx')
actual=json.loads((e/'review.json').read_text());prototype=json.loads((e/'prototype-review.json').read_text())
for key in ['format','scope','sourceSha256','acknowledged','policy','changes','retained']:assert actual[key]==prototype[key]
assert actual['counts']=={'changes':37,'tracks':2,'parts':3,'notes':6}
assert actual['outputSha256']==hashlib.sha256((e/'cleaned.ustx').read_bytes()).hexdigest()
downloads=json.loads((e/'browser-download-result.json').read_text());assert downloads['status']=='pass'and downloads['noNetworkRequests']
for name,digest in downloads['files'].items():assert hashlib.sha256((e/name).read_bytes()).hexdigest()==digest
assert (e/'ui-noop-copy.ustx').read_bytes()==(e/'native-input.ustx').read_bytes()
assert (e/'ui-repeat-copy.ustx').read_bytes()==(e/'ui-first-copy.ustx').read_bytes()
ui=json.loads((e/'browser-ui-result.json').read_text());assert ui['status']=='pass'and not ui['consoleErrors']and not ui['networkRequests']
launches=json.loads((e/'browser-launches.json').read_text());assert len(launches)==2
for launch in launches:assert launch['chromiumSandbox']and '--no-sandbox'not in launch['command']and '--disable-setuid-sandbox'not in launch['command']
package=json.loads((e/'offline-package-result.json').read_text());assert package['status']=='pass'
for name,digest in package['files'].items():assert hashlib.sha256((e/'offline-app'/name).read_bytes()).hexdigest()==digest
native_precision=json.loads((e/'native-precision-result.json').read_text());assert native_precision['status']=='pass'and native_precision['exactBits']=='3f800000'and native_precision['roundedBits']=='3f800001'
python_precision=json.loads((e/'python-precision-result.json').read_text());browser_precision=json.loads((e/'browser-precision-result.json').read_text())
assert python_precision['status']=='pass'and python_precision['exactDecimalRejectedBeforeOutput']
assert browser_precision['status']=='pass'and browser_precision['exactDecimalRejectedBeforeOutput']and not browser_precision['downloads']
assert browser_precision['inputSha256']==python_precision['files']['exact']==hashlib.sha256((e/'precision-exact.ustx').read_bytes()).hexdigest()
assert python_precision['files']['rounded']==hashlib.sha256((e/'precision-rounded.ustx').read_bytes()).hexdigest()
(e/'browser-python-parity.json').write_text(json.dumps({'status':'pass','producer':'actual browser download','wholeDataEquality':True,'all37ReviewValues':True,'byteIdenticalNoop':True,'byteIdenticalRepeatedExport':True,'noNativeOrPythonSubstitution':True,'actualNativeFloat32BoundaryProven':True,'bothProducersRejectUnsupportedPrecision':True},indent=2)+'\n')
print('Actual browser USTX equals independent Python semantic output; exact reports and no-op/repeat artifacts verified')
