/* PNG-only hover compositor. Shared image cache; one animated card at a time. */
(() => {
  let catalogue,active;
  const cache=new Map(),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const filename=r=>`card_${r.config?.category||'entity'}_${r.name.trim().replace(/[<>:"/\\|?*]/g,'_').replace(/[ .]+$/g,'')}.png`;
  async function layers(file){
    if(!catalogue)catalogue=fetch('/assets/cards/manifest.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('catalogue');return r.json();}).catch(e=>{catalogue=null;throw e;});
    const records=await catalogue,matches=records.filter(r=>typeof r.name==='string'&&filename(r)===file);
    if(matches.length!==1)return null;
    const layer=matches[0].parallax;if(layer?.version!==1)return null;
    const keys=['background','model','foreground'];
    if(!keys.every(k=>/^assets\/cards\/parallax\/[a-z0-9-]+\.png$/i.test(layer[k]||'')))return null;
    const key=layer.model;
    if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
    const pending=Promise.all(keys.map(async k=>{const img=new Image();img.src='/'+layer[k];await img.decode();if(img.naturalWidth!==1000||img.naturalHeight!==1600)throw Error('dimensions');return img;})).catch(e=>{cache.delete(key);throw e;});
    cache.set(key,pending);while(cache.size>6)cache.delete(cache.keys().next().value);return pending;
  }
  window.CardParallax={attach(card){
    let canvas,ctx,images,inside=false,tx=0,ty=0,x=0,y=0,raf=0,token=0,last=0;
    function clear(){++token;cancelAnimationFrame(raf);inside=false;canvas?.remove();canvas=null;images=null;x=y=0;card.classList.remove('has-parallax');if(active===clear)active=null;}
    function point(e){const r=card.getBoundingClientRect();tx=Math.max(-1,Math.min(1,2*(e.clientX-r.left)/r.width-1));ty=Math.max(-1,Math.min(1,2*(e.clientY-r.top)/r.height-1));}
    function draw(now){
      if(!canvas||!card.isConnected||document.hidden||motion.matches){clear();return;}
      const dt=Math.min(.05,(now-last)/1000);last=now;const a=1-Math.exp(-14*dt);
      x+=((inside?tx:0)-x)*a;y+=((inside?ty:0)-y)*a;
      ctx.clearRect(0,0,1000,1600);ctx.drawImage(images[0],0,0);
      ctx.save();ctx.beginPath();ctx.rect(140,0,860,1340);ctx.clip();ctx.beginPath();ctx.rect(140,0,860,1340);ctx.rect(140,0,216,260);ctx.rect(752,1142,248,198);ctx.clip('evenodd');
      ctx.drawImage(images[1],Math.round(-x*18),Math.round(-y*12));ctx.restore();ctx.drawImage(images[2],0,0);
      canvas.dataset.offsetX=String(Math.round(-x*18));canvas.dataset.offsetY=String(Math.round(-y*12));
      if(!inside&&Math.abs(x)+Math.abs(y)<.01){clear();return;}
      raf=requestAnimationFrame(draw);
    }
    card.addEventListener('pointerenter',async e=>{
      if(e.pointerType==='touch'||motion.matches||card.parentElement.classList.contains('is-dragging'))return;
      active?.();active=clear;inside=true;point(e);const request=++token;
      try{const loaded=await layers(card.dataset.file);if(request!==token||!inside||!loaded)return;
        images=loaded;canvas=document.createElement('canvas');canvas.className='card__parallax';canvas.width=1000;canvas.height=1600;canvas.setAttribute('aria-hidden','true');ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
        card._img.after(canvas);ctx.drawImage(images[0],0,0);last=performance.now();draw(last);card.classList.add('has-parallax');
      }catch{clear();}
    });
    card.addEventListener('pointermove',e=>{if(inside)point(e);});
    card.addEventListener('pointerleave',()=>{inside=false;++token;});
    card._stopParallax=clear;
  }};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)active?.();});
  motion.addEventListener('change',()=>{if(motion.matches)active?.();});
})();
