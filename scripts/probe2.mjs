import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').trim().split('\n').map(l=>l.split(/=(.*)/s).slice(0,2)));
const B = env.YOUCAM_BASE, K = env.YOUCAM_API_KEY;
const H = {Authorization:`Bearer ${K}`,'Content-Type':'application/json'};
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function upload(buf, name, type){
  const r = await fetch(`${B}/s2s/v2.0/file`,{method:'POST',headers:H,body:JSON.stringify({files:[{content_type:type,file_name:name,file_size:buf.length}]})}).then(r=>r.json());
  const f = r.data.files[0], q = f.requests[0];
  const put = await fetch(q.url,{method:'PUT',headers:q.headers,body:buf});
  if(!put.ok) throw new Error('PUT '+put.status);
  return f.file_id;
}
async function run(task, body){
  const r = await fetch(`${B}/s2s/v2.0/task/${task}`,{method:'POST',headers:H,body:JSON.stringify(body)}).then(r=>r.json());
  if(!r.data?.task_id) throw new Error(task+' start: '+JSON.stringify(r));
  for(let i=0;i<60;i++){ await sleep(2500);
    const s = await fetch(`${B}/s2s/v2.0/task/${task}/${r.data.task_id}`,{headers:H}).then(r=>r.json());
    if(s.data?.task_status==='success') return s.data;
    if(s.data?.task_status==='error') throw new Error(task+' error: '+JSON.stringify(s).slice(0,400)); }
  throw new Error('timeout');
}
const v = JSON.parse(fs.readFileSync('data/probe/v.json'));
const img = Buffer.from(await (await fetch(v.results.url)).arrayBuffer());
fs.writeFileSync('data/probe/vto.jpg',img);
const fid = await upload(img,'vto_probe.jpg','image/jpeg');
const concerns = ['redness','oiliness','radiance','texture','pore','acne','age_spot','dark_circle_v2'];
const a2 = await run('skin-analysis',{src_file_id:fid,dst_actions:concerns,format:'json'});
fs.writeFileSync('data/probe/a2.json',JSON.stringify(a2,null,1));
const a1 = JSON.parse(fs.readFileSync('data/probe/a1.json'));
const m = Object.fromEntries(a1.results.output.map(o=>[o.type,o.ui_score]));
console.log('type: before -> after');
for(const o of a2.results.output) if(m[o.type]!==undefined) console.log(o.type, m[o.type],'->',o.ui_score);
