import subprocess, json, os, collections
env=dict(os.environ, ETFDIV_FULL='1')
r=subprocess.run(['python3','scripts/update_etfdiv.py'],capture_output=True,text=True,env=env); print(r.stdout[-3000:]); print(r.stderr[-3000:])
d=json.load(open('data/etfdiv.json'))
print({k:(len(v) if isinstance(v,(list,dict)) else v) for k,v in d.items()})
E=d['etfs']; print(collections.Counter((e.get('n') or '').split(' ')[0] for e in E.values()).most_common(40))
print([ (c,e['n'],e.get('p'),e.get('ttm'),e['h'][:2]) for c,e in list(E.items())[:5]])
ev=d['events']; print(len(ev)); print(collections.Counter(e['rec'] for e in ev).most_common(20))
print(ev[:3]); print([e for e in ev if e.get('tax') is not None][:3])
print('exSrc', collections.Counter(e['exSrc'] for e in ev))
# monthly ETFs with no event in last 40 days
import datetime
today=datetime.date.today()
noev=[ (c,E[c]['n'],E[c]['h'][0][0]) for c in E if not any(e['t']==c for e in ev)]
print('no KIND event', len(noev), noev[:60])
# compare calc ex vs naver ex
mis=[]
for e in ev:
    h=E.get(e['t'],{}).get('h',[])
    nx=[x[0] for x in h if 0<(datetime.date.fromisoformat(e['rec'])-datetime.date.fromisoformat(x[0])).days<=7]
    if nx and nx[0]!=e['ex']: mis.append((e['n'],e['rec'],e['ex'],e['exSrc'],nx[0]))
print('ex mismatch', len(mis), mis[:20])
print(sorted(d['exMap'].items())[:5])
r=subprocess.run(['python3','scripts/update_etfdiv.py'],capture_output=True,text=True); print('2nd', r.stdout[-500:], r.stderr[-500:])
