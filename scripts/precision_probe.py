"""Create exact decimal-boundary inputs; require the Python producer to reject."""
from pathlib import Path
import hashlib,json,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from voice_slate.core import clean,InvalidProject
e=Path('evidence');source=(e/'native-input.ustx').read_text(encoding='utf-8-sig')
needle='y: 3, shape: io';assert needle in source
values={'exact':'1.000000059604644775390625','rounded':'1.0000000596046448'}
hashes={}
for name,value in values.items():
    data=source.replace(needle,'y: '+value+', shape: io',1).encode()
    with (e/('precision-'+name+'.ustx')).open('xb')as f:f.write(data)
    hashes[name]=hashlib.sha256(data).hexdigest()
try:clean((e/'precision-exact.ustx').read_bytes(),{'singer':True},acknowledged=True)
except InvalidProject:pass
else:raise AssertionError('Python producer accepted unsupported numeric precision')
(e/'python-precision-result.json').write_text(json.dumps({'status':'pass','exactDecimalRejectedBeforeOutput':True,'files':hashes},indent=2)+'\n')
