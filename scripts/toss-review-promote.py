"""Scoped hotfix release for the recovered July production source.
Never grants IAM, supplies credentials, or enables billing. Candidate smoke precedes traffic.
"""
import json, re, subprocess, sys, urllib.request, urllib.error, time
from pathlib import Path
PROJECT='kindy-493701'; REGION='asia-northeast3'; SERVICE='kindy'
GCLOUD='/opt/homebrew/bin/gcloud'
OUT=Path('/Users/jongwonlee/dev/kindy-web.v2/docs/reports/toss-release-2026-09-22')

def g(*args):
    return subprocess.check_output([GCLOUD,*args,'--project='+PROJECT,'--format=json'],text=True)

def service():return json.loads(g('run','services','describe',SERVICE,'--region='+REGION))

def http(url, method='GET'):
    req=urllib.request.Request(url,data=b'{}' if method=='POST' else None,method=method,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=45) as r:return r.status,r.read().decode()
    except urllib.error.HTTPError as e:return e.code,e.read().decode()

def smoke(base, attempts=1):
    def matching(path, needle, method="GET", expected=200):
        for _ in range(attempts):
            code,body=http(base+path,method)
            if code==expected and needle in body:return
        raise AssertionError((path,code,"candidate response not observed"))
    for path,needle in [('/','주식회사 젠타'),('/review/payment','34,900'),('/legal/refund','남아 있는 미이용 기간'),('/legal/business','주식회사 젠타'),('/auth/login','주식회사 젠타')]:
        matching(path,needle)
    matching('/api/payments/toss/billing-key','billing_not_ready','POST',503)
    matching('/review/payment/result?authKey=fake&customerKey=fake','결제 성공 증빙이 아닙니다')
    print('Smoke passed:',base,flush=True)

mode=sys.argv[1]
if mode=='candidate':
    image=sys.argv[2]
    assert re.fullmatch(r'gcr.io/kindy-493701/kindy@sha256:[0-9a-f]{64}',image)
    before=service();traffic=before['status']['traffic']
    active=[t for t in traffic if t.get('percent',0)>0]
    assert len(active)==1 and active[0]['percent']==100
    assert active[0]['revisionName']=='kindy-00010-sir','Production changed since audit; re-review required'
    env=before['spec']['template']['spec']['containers'][0].get('env',[])
    assert not any(e['name'] in ['TOSS_SECRET_KEY','BILLING_KEY_SECRET'] for e in env)
    record={'oldRevision':active[0]['revisionName'],'image':image,'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()}
    OUT.mkdir(exist_ok=True,parents=True)
    (OUT/'release.json').write_text(json.dumps(record,indent=2))
    g('run','services','update',SERVICE,'--region='+REGION,'--image='+image,'--no-traffic','--tag=tossreview','--update-env-vars=KINDY_TOSS_BILLING_ENABLED=0')
    after=service();tag=next(t for t in after['status']['traffic'] if t.get('tag')=='tossreview')
    record.update(candidateRevision=tag['revisionName'],candidateUrl=tag['url'])
    (OUT/'release.json').write_text(json.dumps(record,indent=2))
    assert sum(t.get('percent',0) for t in after['status']['traffic'] if t.get('revisionName')==record['oldRevision'])==100
    # Existing private ingress is preserved; container smoke is required by promote.
    record['candidateSmokePassed']=False
    (OUT/'release.json').write_text(json.dumps(record,indent=2))
    print(json.dumps(record,indent=2))
elif mode=='promote':
    record=json.loads((OUT/'release.json').read_text())
    build=json.loads(g('builds','describe',sys.argv[2]))
    assert build['status']=='SUCCESS'
    assert record['image'] in build['steps'][0]['args']
    record['containerSmokeBuild']=sys.argv[2]
    record['candidateSmokePassed']=True
    current=service()
    assert sum(t.get('percent',0) for t in current['status']['traffic'] if t.get('revisionName')==record['oldRevision'])==100
    revision=json.loads(g('run','revisions','describe',record['candidateRevision'],'--region='+REGION))
    assert revision['status']['imageDigest']==record['image']
    try:
        for percent in [5,25,50,100]:
            target=record['candidateRevision']+'='+str(percent)
            if percent<100:target+=','+record['oldRevision']+'='+str(100-percent)
            g('run','services','update-traffic',SERVICE,'--region='+REGION,'--to-revisions='+target)
            smoke('https://kindy.kr', attempts=100 if percent==5 else 30)
        smoke('https://kindy.kr')
        record['productionVerified']=True
        (OUT/'release.json').write_text(json.dumps(record,indent=2))
        print('Production promoted and verified:',record['candidateRevision'])
    except Exception:
        g('run','services','update-traffic',SERVICE,'--region='+REGION,'--to-revisions='+record['oldRevision']+'=100')
        raise
else:raise SystemExit('candidate <digest> | promote')
