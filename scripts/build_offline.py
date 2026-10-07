"""Deterministic source-only offline package, including the YAML source notice."""
from pathlib import Path
import hashlib,json,zipfile
r=Path(__file__).resolve().parents[1]
files=['index.html','web/core.js','web/app.js','web/sample.js','web/style.css','web/vendor/js-yaml.umd.min.js','web/vendor/LICENSE-js-yaml.txt','README-OFFLINE.txt']
with zipfile.ZipFile(r/'voice-slate-offline.zip','w',zipfile.ZIP_STORED)as z:
 for name in files:
  info=zipfile.ZipInfo(name,(2026,10,6,0,0,0));info.compress_type=zipfile.ZIP_STORED;info.external_attr=0o100644<<16;z.writestr(info,(r/name).read_bytes())
m={n:hashlib.sha256((r/n).read_bytes()).hexdigest()for n in files}
(r/'offline-manifest.json').write_text(json.dumps({'files':m,'zip_sha256':hashlib.sha256((r/'voice-slate-offline.zip').read_bytes()).hexdigest()},indent=2)+'\n')
print('Built eight-file offline source ZIP')
