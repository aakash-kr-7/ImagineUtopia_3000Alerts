"""Explicit Wazuh/Suricata input adapter for AIT-ADS-shaped JSON.
Never infer per-alert truth from attack-phase intervals. Unmapped rules remain
unmapped. This adapter is not an external validation result.
"""
import argparse
import hashlib
import ipaddress
import json
from datetime import datetime, timezone
from pathlib import Path

TYPE_BY_TECHNIQUE={'T1110.003':'password_spray','T1078':'suspicious_login','T1566.001':'phishing_attachment','T1059.001':'powershell','T1003.001':'credential_dump','T1021.002':'remote_service','T1053.005':'scheduled_task','T1041':'outbound_transfer','T1486':'encryption_activity','T1071.004':'dns_beacon','T1087.002':'discovery'}

def convert(row, index, source_name):
    if not isinstance(row, dict):
        raise ValueError('Expected an object')
    timestamp=row.get('timestamp') or row.get('@timestamp')
    if not timestamp:
        raise ValueError('Missing timestamp')
    dt=datetime.fromisoformat(timestamp.replace('Z','+00:00'))
    if dt.tzinfo is None:
        raise ValueError('Naive timestamp requires documented timezone')
    rule=row.get('rule',{});data=row.get('data',{});agent=row.get('agent',{})
    level=int(rule.get('level',0))
    if not 0<=level<=15:
        raise ValueError('Wazuh rule.level outside 0..15')
    severity=0 if level<=3 else 1 if level<=6 else 2 if level<=9 else 3 if level<=12 else 4
    entities=[]
    if agent.get('name'):
        entities.append('host:'+str(agent['name']))
    for key in ['srcuser','dstuser']:
        if data.get(key): entities.append('user:'+str(data[key]))
    for key in ['srcip','dstip']:
        if data.get(key):
            try: entities.append('ip:'+str(ipaddress.ip_address(data[key])))
            except ValueError: pass
    techniques=rule.get('mitre',{}).get('id',[])
    alert_type=next((TYPE_BY_TECHNIQUE[t] for t in techniques if t in TYPE_BY_TECHNIQUE),'external_rule')
    alert={'alert_id':'AIT-'+hashlib.sha256(f'{source_name}:{index}'.encode()).hexdigest()[:20],
           'timestamp':dt.astimezone(timezone.utc).isoformat().replace('+00:00','Z'),
           'source':'ids' if 'suricata' in rule.get('groups',[]) else 'edr',
           'alert_type':alert_type,'severity':severity,'entities':list(dict.fromkeys(entities))[:8],
           'description':str(rule.get('description','External detection'))[:2000],
           'raw_reference':f'ait://{source_name}/row/{index}'}
    from backend.app import Alert
    return Alert(**alert).model_dump(exclude_none=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--input',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
    path=Path(args.input);count=0;excluded=[]
    with path.open() as f:
        rows=json.load(f) if path.suffix=='.json' else (json.loads(line) for line in f if line.strip())
        if isinstance(rows,dict): rows=rows.get('alerts',[])
        with open(args.output,'w') as out:
            for index,row in enumerate(rows):
                try: out.write(json.dumps(convert(row,index,path.name))+'\n');count+=1
                except (ValueError,TypeError,KeyError) as error: excluded.append({'row':index,'reason':str(error)})
    Path(args.output+'.manifest.json').write_text(json.dumps({'dataset':'AIT-ADS','source':'https://zenodo.org/records/8263181','adapter':'Wazuh/Suricata explicit fields v1','input_file':path.name,'input_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'included':count,'excluded':excluded,'labels_generated':False,'external_evaluation_performed':False,'limitations':['AMiner format is not supported.','Rule metadata mapping only; no description-based inference.','No asset inventory supplied.','Phase labels are not per-alert attack truth.']},indent=2))
    print(f'Converted {count} alerts; excluded {len(excluded)} rows. No ground truth created.')

if __name__=='__main__': main()
