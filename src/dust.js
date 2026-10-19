// Пылинки в лучах света: один маленький canvas, 18 (телефон) / 36 штук, стоит при reduced-motion и в скрытой вкладке
export function startDust(cv,reduce){
  const x=cv.getContext('2d'); if(!x||reduce)return;
  const mob=matchMedia('(max-width:760px)').matches, N=mob?18:36, R=Math.random;
  let W=0,H=0; const P=[];
  const fit=()=>{W=cv.width=innerWidth;H=cv.height=innerHeight};
  fit(); addEventListener('resize',fit);
  // окна справа: пылинок больше у правой стороны, летят медленно вверх с лёгким покачиванием
  for(let i=0;i<N;i++)P.push({x:(.25+R()*.75)*W,y:R()*H,r:.7+R()*1.6,v:.06+R()*.16,a:R()*6.28,s:.3+R()*.7,o:.25+R()*.55});
  let t0=0;
  const tick=t=>{
    if(!document.hidden){
      const dt=Math.min(48,t-t0)||16; t0=t;
      const women=document.documentElement.getAttribute('data-hall')!=='men';
      x.clearRect(0,0,W,H);
      for(const p of P){
        p.y-=p.v*dt*.06; p.a+=p.s*dt*.0009; p.x+=Math.sin(p.a)*.18-.03;
        if(p.y<-4){p.y=H+4;p.x=(.25+R()*.75)*W}
        if(p.x<-4)p.x=W+4;
        const fade=Math.min(1,Math.min(p.y,H-p.y)/90), tw=.65+.35*Math.sin(p.a*3);
        x.globalAlpha=p.o*fade*tw*(women?.55:.8);
        x.fillStyle=women?'#c9a36a':'#ffe7bf';
        x.beginPath(); x.arc(p.x,p.y,p.r,0,6.283); x.fill();
      }
    }else t0=t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
