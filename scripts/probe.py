import subprocess, os
r=subprocess.run(['python3','scripts/update_etfdiv.py'],capture_output=True,text=True,env=dict(os.environ, ETFDIV_FULL='1')); print(r.stdout[-1500:], r.stderr[-1500:])
