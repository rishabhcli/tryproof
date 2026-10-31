import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').trim().split('\n').map(l=>l.split(/=(.*)/s).slice(0,2)));
const B = env.YOUCAM_BASE, K = env.YOUCAM_API_KEY;
const H = {Authorization:`Bearer ${K}`,'Content-Type':'application/json'};
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function run(task, body){
  const r = await fetch(`${B}/s2s/v2.0/task/${task}`,{method:'POST',headers:H,body:JSON.stringify(body)}).then(r=>r.json());
  if(!r.data?.task_id) throw new Error(task+' start: '+JSON.stringify(r));
  for(let i=0;i<60;i++){
    await sleep(2500);
    const s = await fetch(`${B}/s2s/v2.0/task/${task}/${r.data.task_id}`,{headers:H}).then(r=>r.json());
    const st = s.data?.task_status;
    if(st==='success') return s.data;
    if(st==='error') throw new Error(task+' error: '+JSON.stringify(s));
  }
  throw new Error('timeout');
}
const src = process.argv[2];
const concerns = ['redness','oiliness','radiance','texture','pore','acne','age_spot','dark_circle_v2'];
const a1 = await run('skin-analysis',{src_file_url:src,dst_actions:concerns,format:'json'});
fs.writeFileSync('data/probe/a1.json',JSON.stringify(a1,null,1));
console.log('BEFORE', a1.results.output.map(o=>`${o.type}:${o.ui_score}`).join(' '));
const v = await run('makeup-vto',{version:'1.0',src_file_url:src,effects:[
 {category:'skin_smooth',skinSmoothStrength:60,skinSmoothColorIntensity:50},
 {category:'foundation',palettes:[{color:'#e0b48f',colorIntensity:40,glowIntensity:10,coverageIntensity:70}]},
 {category:'concealer',palettes:[{color:'#e6c7a8',colorIntensity:50,colorUnderEyeIntensity:70,coverageLevel:70}]}]});
fs.writeFileSync('data/probe/v.json',JSON.stringify(v,null,1));
const outUrl = v.results?.url || v.results?.[0]?.download_url;
console.log('VTO ok', !!outUrl);
const a2 = await run('skin-analysis',{src_file_url:outUrl,dst_actions:concerns,format:'json'});
fs.writeFileSync('data/probe/a2.json',JSON.stringify(a2,null,1));
console.log('AFTER ', a2.results.output.map(o=>`${o.type}:${o.ui_score}`).join(' '));
