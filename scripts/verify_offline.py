"""Verify shipped bytes and materialize the exact app used by browser tests."""
from pathlib import Path
import hashlib,json,stat,zipfile
r=Path(__file__).resolve().parents[1];e=r/'evidence';e.mkdir(exist_ok=True)
expected={'index.html','web/core.js','web/app.js','web/sample.js','web/style.css','web/vendor/js-yaml.umd.min.js','web/vendor/LICENSE-js-yaml.txt','README-OFFLINE.txt'}
m=json.loads((r/'offline-manifest.json').read_text());assert set(m['files'])==expected
a=r/'voice-slate-offline.zip';assert hashlib.sha256(a.read_bytes()).hexdigest()==m['zip_sha256']
vendor=json.loads((r/'vendor-manifest.json').read_text())
assert vendor['version']=='5.4.2'and vendor['sourceCommit']=='494400bd45cad078123cfc057e674a9a0a8d9983'
for name,digest in vendor['files'].items():assert hashlib.sha256((r/'web/vendor'/name).read_bytes()).hexdigest()==digest
with zipfile.ZipFile(a)as z:
 assert len(z.infolist())==8 and set(z.namelist())==expected and sum(i.file_size for i in z.infolist())<1_000_000
 for info in z.infolist():
  assert not stat.S_ISLNK(info.external_attr>>16);b=z.read(info.filename);assert b==(r/info.filename).read_bytes();assert hashlib.sha256(b).hexdigest()==m['files'][info.filename]
  p=e/'offline-app'/info.filename;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
(e/'offline-package-result.json').write_text(json.dumps({'status':'pass','zip_sha256':m['zip_sha256'],'files':m['files'],'yamlSource':vendor},indent=2)+'\n')
print('Exact offline package and upstream YAML source verified')
