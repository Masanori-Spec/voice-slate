"""Write a fresh USTX copy and affected-value review; never overwrite inputs."""
import argparse
import json
import os
from pathlib import Path
import stat
import sys

from .core import MAX_BYTES, InvalidProject, clean


def bounded(path, limit):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    with os.fdopen(fd,'rb')as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):raise InvalidProject('Only regular input files are supported')
        data=stream.read(limit+1)
    if len(data)>limit:raise InvalidProject('Input size limit exceeded')
    return data


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('source');p.add_argument('output');p.add_argument('--policy',required=True);p.add_argument('--report',required=True)
    p.add_argument('--acknowledge',action='store_true');p.add_argument('--review-only',action='store_true')
    args=p.parse_args()
    outputs=[Path(args.report)] if args.review_only else [Path(args.output),Path(args.report)]
    paths=[Path(args.source).resolve(),Path(args.policy).resolve(),*[x.resolve()for x in outputs]]
    if len(set(paths))!=len(paths):raise InvalidProject('Input/output/report paths must be distinct')
    if not args.review_only and not args.acknowledge:raise InvalidProject('Review affected values with --review-only, then use --acknowledge')
    policy=json.loads(bounded(args.policy,65536))
    result=clean(bounded(args.source,MAX_BYTES),policy,acknowledged=True)
    result.review['acknowledged']=not args.review_only
    payloads=[(json.dumps(result.review,ensure_ascii=False,indent=2)+'\n').encode()]
    if not args.review_only:payloads.insert(0,result.output)
    opened=[]
    try:
        for path in outputs:opened.append((path,os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)))
        for (path,fd),data in zip(opened,payloads):
            with os.fdopen(fd,'wb',closefd=False)as stream:stream.write(data)
    except BaseException:
        for path,fd in opened:
            try:path.unlink()
            except OSError:pass
        raise
    finally:
        for path,fd in opened:os.close(fd)
    print(f"Reviewed {len(result.review['changes'])} explicit changes; original file unchanged")


if __name__=='__main__':
    try:main()
    except (InvalidProject,OSError,ValueError)as error:
        print(f'VoiceSlate: {error}',file=sys.stderr);sys.exit(2)
