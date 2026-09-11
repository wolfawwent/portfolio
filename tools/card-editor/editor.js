const $=id=>document.getElementById(id);
const status=$('status');
function report(text,kind=''){status.textContent=text;status.className=kind;}
let engine,currentBuffer=null,currentId=null,records=[],loading=false,loadSequence=0,busy=false,dirty=false;
async function api(path,options={}){const r=await fetch('/__editor/api/'+path,{...options,cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'本機服務無法完成操作。');return data;}
const bytes64=buffer=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(new Blob([buffer]));});
function validName(){const s=$('cardName').value.trim();if(!s)throw Error('請填入卡片名稱。');if(Array.from(s).length>40||/[\u0000-\u001f\u007f]/u.test(s))throw Error('名稱請使用最多 40 個字，且不要包含換行或控制字元。');return s;}
function updateSettings(){for(const el of document.querySelectorAll('[data-setting]')){const key=el.dataset.setting,value=engine.config[key];el.value=value;document.querySelector(`[data-output="${key}"]`).value=key==='scale'?Math.round(value*100)+'%':['yaw','pitch','roll'].includes(key)?value+'°':value.toFixed(1);}}
function updateAnimation(){const has=engine.duration>0;$('playPause').disabled=!has;$('timeline').disabled=!has;$('playPause').textContent=engine.config.playing&&has?'暫停':'播放';$('playPause').setAttribute('aria-pressed',String(engine.config.playing&&has));$('timeline').max=engine.duration||1;$('timeline').value=engine.config.time||0;$('timeLabel').value=`${(engine.config.time||0).toFixed(2)} / ${engine.duration.toFixed(2)} s`;}
function enable(){const yes=!!currentBuffer&&!busy&&!loading;$('saveCard').disabled=!yes;$('exportPNG').disabled=!yes;$('modelControls').disabled=!yes;}
async function loadBuffer(pendingBuffer,fileName,settings,id=null,cardName=null){
  const request=++loadSequence;loading=true;++engine.generation;enable();report('正在讀取模型與動畫…');
  try{
    const buffer=await pendingBuffer;if(request!==loadSequence)return;
    const loaded=await engine.load(buffer,settings);if(!loaded||request!==loadSequence)return;
    currentBuffer=buffer;currentId=id;dirty=!id;$('fileName').textContent=fileName;$('emptyHint').hidden=true;
    if(cardName!==null){$('cardName').value=cardName;engine.name=cardName;engine.draw();}
    const select=$('animation');select.replaceChildren(new Option('原始姿勢（無動畫）','-1'));
    engine.clips.forEach((clip,i)=>select.add(new Option(clip.name||`動畫 ${i+1}`,String(i))));select.value=engine.config.animationIndex;
    updateSettings();updateAnimation();report(engine.clips.length?`已載入 ${engine.clips.length} 段動畫，燈光已套用。`:'模型沒有動畫；可以直接調整構圖並儲存。','success');
  }catch(e){if(request===loadSequence)report('載入失敗：'+e.message,'error');}
  finally{if(request===loadSequence){loading=false;enable();}}
}
async function refreshCards(){records=await api('cards');const select=$('savedCards');select.replaceChildren(new Option('新增卡片',''));for(const card of records)select.add(new Option(card.name,card.id));select.value=currentId||'';}
async function start(){
  if(!['127.0.0.1','localhost'].includes(location.hostname))throw Error('請在自己的電腦執行「啟動卡片工具.ps1」開啟工作台。');
  await api('session');
  const {CardRenderer,DEFAULTS}=await import('./card-renderer.js');
  engine=new CardRenderer($('cardCanvas'));await engine.init();$('editor').hidden=false;await refreshCards();report('選擇 GLB 模型，或開啟已儲存的卡片。');
  $('modelFile').addEventListener('change',async()=>{const file=$('modelFile').files[0];if(!file)return;if(!/\.glb$/i.test(file.name)||file.size>64*1024*1024){report('請選擇 64 MB 以內的 .glb 檔案。','error');return;}await loadBuffer(file.arrayBuffer(),file.name);});
  $('cardName').addEventListener('input',()=>{engine.name=$('cardName').value;dirty=true;engine.draw();$('nameHint').textContent=Array.from(engine.name.trim()).length>40?'名稱超過 40 個字，請縮短後再儲存。':'最多 40 個字；自動縮排於下方名牌內。';});
  document.querySelectorAll('[data-setting]').forEach(el=>el.addEventListener('input',()=>{engine.setSetting(el.dataset.setting,Number(el.value));dirty=true;updateSettings();}));
  $('animation').addEventListener('change',()=>{engine.selectAnimation(Number($('animation').value));dirty=true;updateAnimation();engine.draw();});
  $('playPause').addEventListener('click',()=>{engine.config.playing=!engine.config.playing;dirty=true;updateAnimation();});
  $('timeline').addEventListener('input',()=>{engine.config.playing=false;engine.seek(Number($('timeline').value));dirty=true;updateAnimation();});
  $('resetPose').addEventListener('click',()=>{for(const key of ['x','y','scale','yaw','pitch','roll'])engine.config[key]=DEFAULTS[key];engine.applyTransform();updateSettings();engine.draw();dirty=true;});
  let drag=null;const canvas=$('cardCanvas');
  canvas.addEventListener('pointerdown',e=>{if(!currentBuffer||busy||loading||e.button!==0)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const r=canvas.getBoundingClientRect();engine.moveBy((e.clientX-drag.x)/r.width,(e.clientY-drag.y)/r.height);drag.x=e.clientX;drag.y=e.clientY;dirty=true;updateSettings();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
  $('controls').addEventListener('submit',async e=>{
    e.preventDefault();if(!currentBuffer||busy||loading)return;
    try{
      const name=validName();busy=true;enable();$('controls').inert=true;report('正在儲存模型、縮圖與卡片設定…');
      engine.name=name;engine.draw();const config=engine.getSettings(),png=canvas.toDataURL('image/png').split(',')[1];
      const record=await api('save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentId,name,config,model:await bytes64(currentBuffer),png})});
      currentId=record.id;dirty=false;await refreshCards();report('已儲存到本機作品集。重新整理網站即可看到；尚未推送到 GitHub。','success');
    }catch(error){report(error.message,'error');}finally{busy=false;$('controls').inert=false;enable();}
  });
  $('exportPNG').addEventListener('click',()=>{try{engine.name=validName();engine.draw();const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='portfolio-card.png';a.click();}catch(e){report(e.message,'error');}});
  $('loadCard').addEventListener('click',async()=>{
    if(busy||loading)return;if(dirty&&!confirm('目前修改尚未儲存，仍要開啟其他卡片嗎？'))return;
    const card=records.find(c=>c.id===$('savedCards').value);
    if(!card){engine.generation++;engine.clear();currentBuffer=null;currentId=null;dirty=false;$('cardName').value='';engine.name='';$('modelFile').value='';$('fileName').textContent='尚未選擇模型';$('emptyHint').hidden=false;$('animation').replaceChildren(new Option('原始姿勢（無動畫）','-1'));engine.config={...DEFAULTS};engine.draw();updateSettings();updateAnimation();enable();report('已開啟空白卡片。');return;}
    await loadBuffer(fetch('/'+card.model,{cache:'no-store'}).then(response=>{if(!response.ok)throw Error('找不到已儲存的 GLB。');return response.arrayBuffer();}),card.name,card.config,card.id,card.name);
  });
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  let previous=performance.now();function tick(now){if(!document.hidden&&!busy){engine.step((now-previous)/1000);updateAnimation();}previous=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
  // Public readback for local browser QA; it grants no server privileges.
  window.cardEditor={get renderer(){return engine;},get currentId(){return currentId;}};
}
start().catch(e=>report(e.message,'error'));
