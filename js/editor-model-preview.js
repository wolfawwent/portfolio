import {applyPreviewCamera,previewOrbit,setPreviewPlayback} from './model-preview-settings.js?v=watermark-1';
export function applyBlendMode(viewer,config){
  if(!config||!config.blend||!viewer.model)return;
  try{for(const m of viewer.model.materials){if(m.getAlphaMode?.()!=='BLEND')m.setAlphaMode('BLEND');}}catch(e){console.warn('[preview] blend',e);}
}
export function createEditorPreview(host,status,getConfig){
  let popup=null;
  function sync(model=false){if(popup&&!popup.closed)popup.postMessage({type:'card-preview',config:getConfig(),...(model?{buffer}: {})},location.origin);}
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===popup&&event.data?.type==='preview-ready')sync(true);});
  window.addEventListener('beforeunload',()=>popup?.close());
  let buffer=null,viewer=null,url=null,sequence=0,visible=false,runtime;
  function clear(){++sequence;if(viewer){viewer.pause();viewer.remove();viewer=null;}if(url){URL.revokeObjectURL(url);url=null;}host.replaceChildren();}
  async function show(){
    visible=true;if(viewer){if(viewer.dataset.playingAnimation)viewer.play();return;}if(!buffer){status.textContent='請先選擇模型。';return;}
    const token=++sequence;status.textContent='正在載入獨立模型預覽…';
    try{
      if(!runtime)runtime=import('../assets/vendor/model-viewer-4.3.1.min.js').catch(e=>{runtime=null;throw e;});
      await runtime;if(token!==sequence||!visible)return;
      viewer=document.createElement('model-viewer');const current=viewer;
      viewer.style.cssText='display:block;width:100%;height:320px';viewer.setAttribute('interaction-prompt','none');
      applyPreviewCamera(viewer,getConfig());viewer.setAttribute('field-of-view','30deg');
      viewer.setAttribute('shadow-intensity','.5');viewer.setAttribute('animation-crossfade-duration','0');
      viewer.setAttribute('alt','網站模型預覽');
      viewer.addEventListener('load',()=>{if(token!==sequence||viewer!==current)return;applyBlendMode(viewer,getConfig());const name=setPreviewPlayback(viewer,getConfig());applyPreviewCamera(viewer,getConfig());if(!visible)viewer.pause();status.textContent=name?'播放：'+name:'靜止預覽';});
      viewer.addEventListener('error',()=>{if(token===sequence)status.textContent='模型預覽載入失敗，請收合後重開。';});
      url=URL.createObjectURL(new Blob([buffer],{type:'model/gltf-binary'}));host.replaceChildren(viewer);viewer.src=url;
    }catch(e){if(token===sequence)status.textContent='無法載入預覽：'+e.message;}
  }
  document.addEventListener('visibilitychange',()=>{if(!viewer)return;if(document.hidden)viewer.pause();else if(visible&&viewer.dataset.playingAnimation)viewer.play();});
  return {
    load(value){clear();buffer=value;sync(true);if(visible)show();},
    toggle(open){visible=open;if(open)show();else clear();},
    openWindow(){popup=window.open('/__editor/preview.html','card-model-preview','popup,width=1100,height=850');if(!popup)status.textContent='請允許此網站開啟彈出視窗。';else popup.focus();},
    update(animation=false){sync();if(!viewer)return;applyPreviewCamera(viewer,getConfig());if(animation){const name=setPreviewPlayback(viewer,getConfig());if(!visible)viewer.pause();status.textContent=name?'播放：'+name:'靜止預覽';}},
  };
}
