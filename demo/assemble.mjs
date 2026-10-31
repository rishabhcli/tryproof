// Combines raw recording + narration clips into demo/tryproof-demo.mp4 (live run segment is sped up).
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const D = '/Users/m3-max/Documents/GitHub/tryproof/demo';
const m = JSON.parse(fs.readFileSync(`${D}/marks.json`));
const dur = [1, 2, 3, 4, 5, 6].map((i) => parseFloat(fs.readFileSync(`${D}/audio/dur${i}.txt`, 'utf8')));
const off = m.offset;
const A1 = m.liveStart, B1 = m.liveDone, C1 = m.end;
const lead = A1 - m.p6;                                    // part of narration 6 that plays over normal-speed footage
const Bt = Math.max(10, dur[5] + 0.6 - lead);              // target length of the sped-up live segment
const f = (B1 - A1) / Bt;
const t = (x) => (off + x).toFixed(3);
const vf = `[0:v]trim=start=${t(0)}:end=${t(A1)},setpts=PTS-STARTPTS[va];` +
  `[0:v]trim=start=${t(A1)}:end=${t(B1)},setpts=(PTS-STARTPTS)/${f.toFixed(4)}[vb];` +
  `[0:v]trim=start=${t(B1)}:end=${t(C1)},setpts=PTS-STARTPTS[vc];` +
  `[va][vb][vc]concat=n=3:v=1:a=0,fps=30,format=yuv420p[v]`;
const starts = [m.p1, m.p2, m.p3, m.p4, m.p5, m.p6];
const af = starts.map((s, i) => `[${i + 1}:a]adelay=${Math.round(s * 1000)}|${Math.round(s * 1000)}[a${i}]`).join(';') + ';' +
  starts.map((_, i) => `[a${i}]`).join('') + `amix=inputs=6:duration=longest:normalize=0[a]`;
const videoLen = A1 + Bt + (C1 - B1);
const audioEnd = m.p6 + dur[5];
const total = Math.max(videoLen, audioEnd) + 0.5;
const args = ['-y', '-i', m.video, ...[1, 2, 3, 4, 5, 6].flatMap((i) => ['-i', `${D}/audio/p${i}.mp3`]),
  '-filter_complex', `${vf};${af}`, '-map', '[v]', '-map', '[a]', '-t', total.toFixed(2),
  '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', `${D}/tryproof-demo.mp4`];
console.log('speed factor', f.toFixed(2), 'video', videoLen.toFixed(1), 'audioEnd', audioEnd.toFixed(1), 'total', total.toFixed(1));
execFileSync('/opt/homebrew/bin/ffmpeg', args, { stdio: 'inherit' });
