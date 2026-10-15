// Скриншоты зала на 1440 и 375 в нескольких точках скролла: node scripts/shot-zal.mjs [url] [outdir]
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
async function loadPlaywright(){try{return await import('playwright')}catch{}
  const npx=path.join(os.homedir(),'.npm/_npx');
  for(const d of fs.existsSync(npx)?fs.readdirSync(npx):[]){const p=path.join(npx,d,'node_modules/playwright/index.mjs');if(fs.existsSync(p))return import(pathToFileURL(p).href)}
  throw new Error('playwright не найден')}
function findChromium(){const base=path.join(os.homedir(),'Library/Caches/ms-playwright');if(!fs.existsSync(base))return;
  for(const d of fs.readdirSync(base).filter(d=>d.startsWith('chromium_headless_shell-')).sort().reverse())
    for(const sub of ['chrome-headless-shell-mac-arm64/chrome-headless-shell','chrome-headless-shell-mac-x64/chrome-headless-shell']){const p=path.join(base,d,sub);if(fs.existsSync(p))return p}}
const url=process.argv[2]||'http://localhost:5173/', out=process.argv[3]||'shots'; fs.mkdirSync(out,{recursive:true});
const pw=await loadPlaywright(), chromium=pw.chromium||pw.default.chromium;
const b=await chromium.launch({executablePath:findChromium()});
for(const [w,h] of [[1440,900],[375,812]]){
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto(url,{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
  for(const f of [0,.5,1,2,3.2]){
    await p.evaluate(y=>{document.getElementById('lane').scrollTop=y},f*h); await p.waitForTimeout(1400);
    await p.screenshot({path:`${out}/${w}-${f}.png`});
  }
  console.log(w,'errors:',errs.length?errs:'none'); await p.close();
}
await b.close();
