import {previewOrbit,setPreviewPlayback} from './model-preview-settings.js';
export function createEditorPreview(host,status,getConfig){
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
      viewer.setAttribute('camera-orbit',previewOrbit(getConfig()));viewer.setAttribute('field-of-view','30deg');
      viewer.setAttribute('shadow-intensity','.5');viewer.setAttribute('animation-crossfade-duration','0');
      viewer.setAttribute('alt','網站模型預覽');
      viewer.addEventListener('load',()=>{if(token!==sequence||viewer!==current)return;const name=setPreviewPlayback(viewer,getConfig());viewer.jumpCameraToGoal();if(!visible)viewer.pause();status.textContent=name?'播放：'+name:'靜止預覽';});
      viewer.addEventListener('error',()=>{if(token===sequence)status.textContent='模型預覽載入失敗，請收合後重開。';});
      url=URL.createObjectURL(new Blob([buffer],{type:'model/gltf-binary'}));host.replaceChildren(viewer);viewer.src=url;
    }catch(e){if(token===sequence)status.textContent='無法載入預覽：'+e.message;}
  }
  document.addEventListener('visibilitychange',()=>{if(!viewer)return;if(document.hidden)viewer.pause();else if(visible&&viewer.dataset.playingAnimation)viewer.play();});
  return {
    load(value){clear();buffer=value;if(visible)show();},
    toggle(open){visible=open;if(open)show();else clear();},
    update(animation=false){if(!viewer)return;viewer.setAttribute('camera-orbit',previewOrbit(getConfig()));viewer.jumpCameraToGoal();if(animation){const name=setPreviewPlayback(viewer,getConfig());if(!visible)viewer.pause();status.textContent=name?'播放：'+name:'靜止預覽';}},
  };
}
