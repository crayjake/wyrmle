/* Standalone animation studies. No game code, storage or daily state is changed. */
(function () {
  'use strict';
  const board = window.WyrmBoard;
  const requested = new URLSearchParams(location.search).get('mode');
  const mode = ['feet', 'inch', 'guide'].includes(requested) ? requested : 'feet';
  const requestedReveal = new URLSearchParams(location.search).get('reveal');
  const treatment = ['classic','soft','quiet'].includes(requestedReveal) ? requestedReveal : 'classic';
  const studyId = requestedReveal || mode;
  const DURATION = 12;
  const START = 0.7, TRAVEL_END = 10.9, SETTLED = 11.5;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  const style = document.createElement('style');
  style.textContent = board.css + `
    html,body{width:375px!important;height:629px!important;margin:0!important;overflow:hidden!important;background:#25281f}
    .container{width:375px!important;height:629px!important;overflow:hidden!important;pointer-events:none}
    *,*::before,*::after{animation:none!important;transition:none!important}
    .walk-layer{position:absolute;inset:0;pointer-events:none;z-index:8;overflow:hidden}
    .walk-piece,.walk-foot{position:absolute;left:0;top:0;will-change:transform}
    .walk-piece{width:0;height:0;color:var(--green)}
    .walk-piece>.wyrm-life-segment,.walk-piece>.wyrm-life-head{position:absolute;transform:translate(-50%,-50%)}
    .walk-foot{width:4px;height:2px;border-radius:.5px;background:var(--green);transform-origin:center}
    .study-glyph{position:relative;display:inline-block;white-space:pre;line-height:inherit}
    .study-final{opacity:0}
    .study-mask{position:absolute;inset:0;text-align:center;color:var(--blue);opacity:.68}
    .study-wash{position:absolute;inset:1px;background:var(--green);pointer-events:none;opacity:0;transform-origin:left center}
    .study-scan{position:absolute;height:2px;background:var(--green);opacity:0;transform-origin:left;pointer-events:none;z-index:2}
    .refill-study-mask{position:absolute;inset:0;display:grid;place-items:center;color:var(--blue);font:14px 'Cutive Mono',monospace;transform:translateY(-.8px)}
    .letter-combat .tile.strike{--special-colour:var(--blue)}
    .letter-combat .tile.ward{--special-colour:var(--green)}
    .letter-combat .tile.regen{--special-colour:var(--red)}
    .letter-combat .tile.special{border-color:color-mix(in srgb,var(--special-colour) 65%,transparent)}
    .letter-combat .tile.special.selected{border-color:var(--special-colour)}
    .letter-combat .tile.special .tile-special{color:var(--special-colour)}
  `;
  document.head.append(style);
  document.body.innerHTML = board.html;
  const main = document.querySelector('main');
  main.querySelectorAll('.tile.ward').forEach(node=>{
    const label=node.querySelector('.tile-special-label');
    if(label)label.textContent='LIFE';
    const symbol=node.querySelector('.tile-special-symbol');
    if(symbol)symbol.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>';
    for(const attribute of ['aria-label','title']){
      if(node.hasAttribute(attribute))node.setAttribute(attribute,node.getAttribute(attribute).replace(/HEART/g,'LIFE'));
    }
  });
  const meter = main.querySelector('.health-segments .wyrm-life-meter');
  meter.style.visibility = 'hidden';
  const layer = document.createElement('div'); layer.className = 'walk-layer'; main.append(layer);
  const rest = board.parts;
  const headRest = rest[rest.length - 1];
  const offsets = rest.map(part => headRest.x - part.x);
  const partNodes = rest.map(part => {
    const wrap = document.createElement('span'); wrap.className = 'walk-piece';
    wrap.innerHTML = part.kind === 'head'
      ? '<span class="wyrm-life-head is-filled"><span class="wyrm-life-tongue"></span></span>'
      : `<span class="wyrm-life-segment ${part.kind === 'tail' ? 'wyrm-life-tail' : ''} is-filled"></span>`;
    layer.append(wrap); return wrap;
  });
  const footNodes = Array.from({length:6}, () => { const foot=document.createElement('span');foot.className='walk-foot';layer.prepend(foot);return foot; });

  function wrapGlyph(element, letter) {
    element.textContent='';
    const wrap=document.createElement('span');wrap.className='study-glyph';
    const real=document.createElement('span');real.className='study-final';real.textContent=letter;
    const mask=document.createElement('span');mask.className='study-mask';mask.textContent='?';
    wrap.append(real,mask);element.append(wrap);return {real,mask};
  }
  const targets={enemy:[],tiles:[],refills:[]};
  main.querySelectorAll('.enemy-letter').forEach((node,index)=> {
    node.style.transform='none';node.style.opacity='1';
    const glyph=wrapGlyph(node.querySelector('.enemy-letter-glyph'),board.enemy[index].letter);
    const wash=document.createElement('span');wash.className='study-wash';node.append(wash);
    targets.enemy.push({node,...glyph,wash,at:Infinity});
  });
  main.querySelectorAll('.tile').forEach((node,index)=> {
    node.style.transform='none';node.style.opacity='1';node.disabled=true;
    const glyph=wrapGlyph(node.querySelector('.tile-letter'),board.tiles[index].letter);
    const wash=document.createElement('span');wash.className='study-wash';node.append(wash);
    targets.tiles.push({node,...glyph,wash,special:node.querySelector('.tile-special'),at:Infinity});
  });
  main.querySelectorAll('.refill-square').forEach((node,index)=> {
    const real=node.querySelector('.refill-letter');
    const count=node.querySelector('.refill-count');
    const mask=document.createElement('span');mask.className='refill-study-mask';mask.textContent='?';node.append(mask);
    const wash=document.createElement('span');wash.className='study-wash';node.append(wash);
    targets.refills.push({node,real,mask,count,wash,at:Infinity,number:board.refills[index].count});
  });
  main.querySelector('.refill-supply').setAttribute('aria-label','Refills are decoding.');
  const definition=main.querySelector('.enemy-definition');
  const order=[0,1,2,3,7,6,5,4,8,9,10,11,15,14,13,12];

  // Distance-sampled curves, with one continuous journey starting at the head
  // of the real life meter. No stage hides, offscreen entrances or grid snaps.
  function route(points) {
    const unit=(a,b)=>{const n=Math.hypot(b.x-a.x,b.y-a.y)||1;return {x:(b.x-a.x)/n,y:(b.y-a.y)/n};};
    const tangents=points.map((p,i)=>p.angle!==undefined?{x:Math.cos(p.angle),y:Math.sin(p.angle)}
      :i===0?unit(p,points[1]):i===points.length-1?unit(points[i-1],p):unit(points[i-1],points[i+1]));
    const samples=[];const arrivals=[0];let length=0;
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],span=Math.hypot(b.x-a.x,b.y-a.y)*.32;
      const c={x:clamp(a.x+tangents[i].x*span,11,364),y:a.y+tangents[i].y*span};
      const d={x:clamp(b.x-tangents[i+1].x*span,11,364),y:b.y-tangents[i+1].y*span};
      for(let k=i?1:0;k<=48;k++){
        const t=k/48,u=1-t;
        const x=u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x;
        const y=u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y;
        const dx=3*(u*u*(c.x-a.x)+2*u*t*(d.x-c.x)+t*t*(b.x-d.x));
        const dy=3*(u*u*(c.y-a.y)+2*u*t*(d.y-c.y)+t*t*(b.y-d.y));
        const previous=samples.at(-1);if(previous)length+=Math.hypot(x-previous.x,y-previous.y);
        samples.push({x,y,angle:Math.atan2(dy,dx),distance:length});
      }
      arrivals.push(length);
    }
    return {length,arrivals,sample(distance){
      if(distance<0){const p=samples[0];return {x:p.x+distance*Math.cos(p.angle),y:p.y+distance*Math.sin(p.angle),angle:p.angle};}
      if(distance>=length)return {...samples.at(-1)};
      let lo=1,hi=samples.length-1;while(lo<hi){const m=(lo+hi)>>1;if(samples[m].distance<distance)lo=m+1;else hi=m;}
      const a=samples[lo-1],b=samples[lo],t=(distance-a.distance)/(b.distance-a.distance||1);
      let angle=b.angle-a.angle;while(angle>Math.PI)angle-=Math.PI*2;while(angle<-Math.PI)angle+=Math.PI*2;
      return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),angle:a.angle+angle*t};
    }};
  }
  const points=[{x:headRest.x,y:headRest.y,angle:0}];
  function point(x,y,event,angle){points.push({x,y,event,angle});}
  function target(kind,index){const p=board[kind][index];point(p.x,p.y,{kind,index});}
  if(mode==='guide'){
    point(114,headRest.y);
    point(43,117.5,{row:'enemy'},Math.PI/2);
    point(20,207,undefined,Math.PI/2);
    for(let row=0;row<4;row++)point(20,board.tiles[row*4].y,{row},Math.PI/2);
    point(20,574);
    point(354,574);
    point(354,210,undefined,-Math.PI/2);
    point(354,headRest.y,{row:'refills'});
    point(172,headRest.y);
    point(127,94);
    point(19,94);
    point(12,headRest.y);
    point(headRest.x,headRest.y,undefined,0);
  }else{
    point(113,83);
    board.enemy.forEach((_,i)=>target('enemy',i));
    point(348,board.enemy.at(-1).y);
    point(357,headRest.y);
    for(let i=board.refills.length-1;i>=0;i--)target('refills',i);
    point(154,headRest.y);
    point(24,95);
    point(13,224,undefined,Math.PI/2);
    for(let n=0;n<order.length;n++){
      const i=order[n];target('tiles',i);
      if(n===3||n===7||n===11){const next=order[n+1];point(i%4===3?346:17,(board.tiles[i].y+board.tiles[next].y)/2);}
    }
    point(13,board.tiles[order.at(-1)].y);
    point(13,225,undefined,-Math.PI/2);
    point(13,108,undefined,-Math.PI/2);
    point(12,headRest.y);
    point(headRest.x,headRest.y,undefined,0);
  }
  const path=route(points);
  const events=[];
  // Slow down departure/docking slightly without introducing stops at letters.
  const distanceAt=t=>{
    const duration=TRAVEL_END-START,ramp=.5,x=clamp(t-START,0,duration);
    const easeIn=z=>z/2-ramp*Math.sin(Math.PI*z/ramp)/(2*Math.PI);
    const travelled=x<ramp?easeIn(x):x>duration-ramp?duration-ramp-easeIn(duration-x):x-ramp/2;
    return path.length*travelled/(duration-ramp);
  };
  function timeAt(distance){let lo=START,hi=TRAVEL_END;for(let i=0;i<25;i++){const mid=(lo+hi)/2;if(distanceAt(mid)<distance)lo=mid;else hi=mid;}return (lo+hi)/2;}
  points.forEach((p,i)=>{
    if(!p.event)return;
    const at=timeAt(path.arrivals[i]);
    if(p.event.kind){targets[p.event.kind][p.event.index].at=at;return;}
    const row=p.event.row;
    const indices=row==='enemy'?board.enemy.map((_,i)=>i):row==='refills'?board.refills.map((_,i)=>i):[row*4,row*4+1,row*4+2,row*4+3];
    const kind=row==='enemy'?'enemy':row==='refills'?'refills':'tiles';
    indices.forEach((index,j)=>targets[kind][index].at=at+j*.13);
    events.push({kind,indices,at});
  });
  const scans=events.map(event=>{
    const scan=document.createElement('span');scan.className='study-scan';layer.prepend(scan);
    const a=board[event.kind][event.indices[0]],b=board[event.kind][event.indices.at(-1)];
    scan.style.left=(a.left+2)+'px';scan.style.top=(a.top+a.height-4)+'px';scan.style.width=(b.left+b.width-a.left-4)+'px';
    return {scan,...event};
  });
  let time=0,playing=false,frame=0,origin=0;
  function render(t){
    time=clamp(t,0,DURATION);
    const settling=smooth((time-(TRAVEL_END-.25))/(SETTLED-TRAVEL_END+.25));
    const amount=smooth((time-START)/.35)*(1-smooth((time-(TRAVEL_END-.45))/.75));
    const distance=distanceAt(time);
    const gait=window.WyrmGaits.sample(mode,time-START,amount);
    const poses=rest.map((resting,i)=>{
      const base=path.sample(distance-offsets[i]),g=gait.parts[i];
      const x=base.x+Math.cos(base.angle)*g.forward-Math.sin(base.angle)*g.side;
      const y=base.y+Math.sin(base.angle)*g.forward+Math.cos(base.angle)*g.side;
      const pose={x:mix(x,resting.x,settling),y:mix(y,resting.y,settling),angle:base.angle*(1-settling)};
      const node=partNodes[i];
      // A soft head turn; the square body keeps its familiar upright silhouette.
      const turn=i===rest.length-1?pose.angle:0;
      node.style.transform=`translate3d(${pose.x}px,${pose.y}px,0) rotate(${turn}rad) scale(${g.scaleX},${g.scaleY})`;
      return pose;
    });
    footNodes.forEach((node,i)=>{
      const foot=gait.feet[i];if(!foot){node.style.opacity='0';return;}
      const pose=poses[foot.part];
      const x=pose.x+Math.cos(pose.angle)*foot.forward-Math.sin(pose.angle)*foot.side;
      const y=pose.y+Math.sin(pose.angle)*foot.forward+Math.cos(pose.angle)*foot.side;
      node.style.transform=`translate3d(${x-2}px,${y-1}px,0) rotate(${pose.angle+foot.angle*Math.PI/180}rad)`;
      node.style.opacity=String(foot.opacity*(1-settling));
    });
    Object.entries(targets).forEach(([kind,group])=>group.forEach((target,index)=>{
      const elapsed=time-target.at;
      const glitch = treatment === 'classic' || treatment === 'soft';
      const reveal = glitch ? (elapsed >= 0 ? 1 : 0) : smooth(elapsed/(mode==='inch'?.32:.17));
      const letter = target.real;
      if(letter){letter.style.opacity=String(reveal);if(mode==='inch')letter.style.clipPath=`inset(0 ${100*(1-reveal)}% 0 0)`;}
      target.mask.style.opacity=String((glitch ? 1 : .65)*(1-reveal));
      let glyph=elapsed<0?'?':elapsed<.07?'·':elapsed<.13?'▪':'?';
      if(glitch && elapsed<0){
        const tick=Math.floor(time/(kind==='enemy'?.070:.065));
        let hash=(Math.imul(tick+11,2654435761)^Math.imul(index+3,1597334677)^(kind==='enemy'?913:kind==='tiles'?237:741))>>>0;
        hash=Math.imul(hash^(hash>>>16),2246822507)>>>0;
        glyph='ABCDEFGHIJKLMNOPQRSTUVWXYZ?#%&@'[hash%31];
      }
      if(target.mask.textContent!==glyph)target.mask.textContent=glyph;
      target.mask.style.color=glitch&&kind!=='enemy'?'var(--emph)':'var(--blue)';
      target.wash.style.opacity=String(glitch||elapsed<0?0:mode==='inch'?.16*Math.sin(Math.PI*clamp(elapsed/.36)):.07*Math.sin(Math.PI*clamp(elapsed/.22)));
      let scale=1,lift=0;
      const duration=kind==='enemy'?(treatment==='classic'?.18:.16):(treatment==='classic'?.45:.22);
      if(glitch && elapsed>=0 && elapsed<duration && kind!=='refills'){
        const scales=kind==='enemy'?[1,treatment==='classic'?1.1:1.03,1]:treatment==='classic'?[1,1.16,.95,1]:[1,1.04,1];
        const lifts=kind==='enemy'?[0,0,0]:treatment==='classic'?[0,-5,1,0]:[0,-1,0];
        const segment=clamp(elapsed/duration)*(scales.length-1),i=Math.min(scales.length-2,Math.floor(segment));
        const p=1-Math.pow(1-(segment-i),3);
        scale=mix(scales[i],scales[i+1],p);lift=mix(lifts[i],lifts[i+1],p);
      }
      target.node.style.transform=`translateY(${lift}px) scale(${scale})`;
      target.node.style.opacity=String(!glitch||kind==='refills'?1:elapsed<0?(kind==='enemy'?.6:.5):mix(kind==='enemy'?.6:.5,1,smooth(elapsed/duration)));
      if(target.special)target.special.style.opacity=String(reveal);
      if(target.count)target.count.textContent=reveal>.5?target.number:'?';
      target.node.dataset.studyRevealed=String(reveal===1);
      if(kind==='refills'&&!board.refills[index].letter&&reveal===1)target.mask.style.opacity='0';
    }));
    const lastEnemy=Math.max(...targets.enemy.map(target=>target.at));
    definition.style.opacity=String(smooth((time-lastEnemy-.15)/.2));definition.style.transform='none';
    scans.forEach(({scan,at,indices})=>{const p=(time-at)/(indices.length*.13+.1);scan.style.opacity=String(p<0||p>1?0:.5*Math.sin(Math.PI*p));scan.style.transform=`scaleX(${clamp(p)})`;});
    if(time>=SETTLED)main.querySelector('.refill-supply').setAttribute('aria-label','Decoded refill reserve.');
    else main.querySelector('.refill-supply').setAttribute('aria-label','Refills are decoding.');
    document.documentElement.dataset.time=String(time);
  }
  function tick(now){if(!playing)return;render((now-origin)/1000);parent.postMessage({type:'walking-progress',mode:studyId,time,duration:DURATION},'*');if(time>=DURATION){playing=false;return;}frame=requestAnimationFrame(tick);}
  function pause(){playing=false;cancelAnimationFrame(frame);}
  function play(){pause();if(time>=DURATION)render(0);playing=true;origin=performance.now()-time*1000;frame=requestAnimationFrame(tick);}
  function seek(t){pause();render(t);}
  window.demo={play,pause,seek,duration:DURATION,mode:studyId,getSnapshot:()=>({time,playing,parts:partNodes.map(node=>node.style.transform),revealed:Object.fromEntries(Object.entries(targets).map(([k,v])=>[k,v.filter(x=>x.node.dataset.studyRevealed==='true').length]))})};
  window.addEventListener('message',event=>{const data=event.data;if(data?.type==='walking-play')play();if(data?.type==='walking-pause')pause();if(data?.type==='walking-seek')seek(data.time);});
  render(0);
  document.fonts.ready.then(()=>{parent.postMessage({type:'walking-ready',mode:studyId},'*');if(new URLSearchParams(location.search).get('autoplay')==='1')play();});
}());
