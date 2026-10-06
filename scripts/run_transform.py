"""Apply the explicit synthetic policy and retain immutability evidence."""
from pathlib import Path
import hashlib,json,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from voice_slate.core import clean

e=Path('evidence');source=e/'native-input.ustx';data=source.read_bytes();before=hashlib.sha256(data).hexdigest()
result=clean(data,json.loads(Path('scripts/policy.json').read_text()),acknowledged=True)
for name,payload in [('cleaned.ustx',result.output),('review.json',(json.dumps(result.review,ensure_ascii=False,indent=2)+'\n').encode())]:
    with (e/name).open('xb')as f:f.write(payload)
after=hashlib.sha256(source.read_bytes()).hexdigest();assert before==after
(e/'source-immutability.json').write_text(json.dumps({'before':before,'after':after,'unchanged':before==after},indent=2)+'\n')
print(f"Explicit policy applied; {len(result.review['changes'])} changes; source unchanged")
