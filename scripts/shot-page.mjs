// Скриншот любой страницы целиком на 375 и 1440: node scripts/shot-page.mjs <url> <outdir>
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
async function loadPlaywright(){try{return await import('playwright')}catch{}
  const npx=path.join(os.homedir(),'.npm/_npx');
  for(const d of fs.existsSync(npx)?fs.readdirSync(npx):[]){const p=path.join(npx,d,'node_modules/playwright/index.mjs');if(fs.existsSync(p))return import(pathToFileURL(p).href)}
  throw new Error('playwright не найден')}
function findChromium(){const base=path.join(os.homedir(),'Library/Caches/ms-playwright');if(!fs.existsSync(base))return;
  for(const d of fs.readdirSync(base).filter(d=>d.startsWith('chromium_headless_shell-')).sort().reverse())
    for(const sub of ['chrome-headless-shell-mac-arm64/chrome-headless-shell','chrome-headless-shell-mac-x64/chrome-headless-shell']){const p=path.join(base,d,sub);if(fs.existsSync(p))return p}}
const url=process.argv[2], out=process.argv[3]||'shots'; fs.mkdirSync(out,{recursive:true});
const pw=await loadPlaywright(), chromium=pw.chromium||pw.default.chromium;
const b=await chromium.launch({executablePath:findChromium()});
for(const [w,h] of [[1440,900],[375,812]]){
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
  await p.goto(url,{waitUntil:'networkidle'}); await p.waitForTimeout(800);
  const ov=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  await p.screenshot({path:`${out}/page-${w}.png`,fullPage:true}); console.log(w,'горизонтальный вылет px:',ov); await p.close();
}
await b.close();
