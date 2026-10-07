import subprocess, json, os, collections, datetime
env=dict(os.environ, ETFDIV_FULL='1')
r=subprocess.run(['python3','scripts/update_etfdiv.py'],capture_output=True,text=True,env=env); print(r.stdout[-3000:]); print(r.stderr[-2000:])
d=json.load(open('data/etfdiv.json'))
E=d['etfs']; ev=d['events']; print(len(E), len(ev), collections.Counter(e['rec'] for e in ev).most_common(10))
noev=[(c,E[c]['n'],E[c]['h'][0][0]) for c in E if not any(e['t']==c for e in ev)]
print('no KIND event', len(noev), noev)
print('lastRec sample', [(E[c]['n'],E[c]['h'][0][0],E[c]['lastRec']) for c in list(E)[:3]])
print(E.get('0194R0'))
