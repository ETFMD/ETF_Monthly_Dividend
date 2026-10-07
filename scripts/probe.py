import subprocess,json
print(subprocess.run(['python3','scripts/update_mcap.py'],capture_output=True,text=True))
d=json.load(open('data/mcap.json'))
print(d['asOf'], d['prevDate'], len(d['rows']))
for r in d['rows']: print(r)
print(sorted(set(r['c'] for r in d['rows'])))
print(subprocess.run(['python3','scripts/update_mcap.py'],capture_output=True,text=True))
