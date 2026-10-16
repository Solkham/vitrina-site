import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
async function loadPlaywright(){try{return await import('playwright')}catch{}
  const npx=path.join(os.homedir(),'.npm/_npx');
  for(const d of fs.existsSync(npx)?fs.readdirSync(npx):[]){const p=path.join(npx,d,'node_modules/playwright/index.mjs');if(fs.existsSync(p))return import(pathToFileURL(p).href)}
  throw new Error('playwright не найден')}
function findChromium(){const base=path.join(os.homedir(),'Library/Caches/ms-playwright');if(!fs.existsSync(base))return;
  for(const d of fs.readdirSync(base).filter(d=>d.startsWith('chromium_headless_shell-')).sort().reverse())
    for(const sub of ['chrome-headless-shell-mac-arm64/chrome-headless-shell','chrome-headless-shell-mac-x64/chrome-headless-shell']){const p=path.join(base,d,sub);if(fs.existsSync(p))return p}}
const url=process.argv[2]||'http://localhost:5173/';
const pw=await loadPlaywright(), chromium=pw.chromium||pw.default.chromium;
const b=await chromium.launch({executablePath:findChromium()});
let bad=0;
for(const [w,h] of [[375,812],[1440,900]]){
  const p=await b.newPage({viewport:{width:w,height:h}});
  await p.goto(url,{waitUntil:'networkidle'}); await p.waitForTimeout(2000);
  const r=await p.evaluate(()=>[...document.querySelectorAll('.rack .plaque b')].map(e=>({n:e.textContent,sw:e.scrollWidth,cw:e.clientWidth,fs:getComputedStyle(e).fontSize})));
  console.log(`--- ${w}x${h}`);
  for(const x of r){const ok=x.sw<=x.cw;if(!ok)bad++;console.log(`${x.n}: ${ok?'ок':'обрезано'} (${x.sw}/${x.cw}, ${x.fs})`)}
  // финал: конец ленты, пересечение .end с табличкой последней каталки
  const o=await p.evaluate(async()=>{const l=document.getElementById('lane');l.scrollTop=l.scrollHeight;await new Promise(r=>setTimeout(r,1500));
    const pl=[...document.querySelectorAll('.rack .plaque')].pop(),end=document.querySelector('.end');
    const a=pl.getBoundingClientRect(),c=end.querySelector('h2,h3,p,button')?[...end.children].map(k=>k.getBoundingClientRect()):[end.getBoundingClientRect()];
    return {plaque:[a.top|0,a.bottom|0,a.left|0,a.right|0],endKids:c.map(k=>[k.top|0,k.bottom|0,k.left|0,k.right|0]),overlap:c.some(k=>k.top<a.bottom&&k.bottom>a.top&&k.left<a.right&&k.right>a.left),vh:innerHeight}});
  console.log('финал',JSON.stringify(o)); if(o.overlap)bad++;
  await p.close();
}
await b.close(); console.log(bad?'НЕ ВСЁ ОК':'ВСЁ ОК'); process.exit(bad?1:0);
