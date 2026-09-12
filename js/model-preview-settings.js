export const PREVIEW_DEFAULTS=Object.freeze({previewYaw:25,previewElevation:15,previewDistance:115,previewPanX:0,previewPanY:0,previewAnimationIndex:-2});
export function applyPreviewCamera(viewer,config){
  viewer.setAttribute('min-camera-orbit','auto auto 1%');
  viewer.setAttribute('max-camera-orbit','auto auto 500%');
  viewer.setAttribute('camera-orbit',previewOrbit(config));
  if(viewer.loaded){
    const center=viewer.getBoundingBoxCenter(),size=viewer.getDimensions();
    const unit=Math.max(size.x,size.y,size.z)/100;
    const yaw=(config.previewYaw??25)*Math.PI/180,elevation=(config.previewElevation??15)*Math.PI/180;
    const x=(config.previewPanX??0)*unit,y=(config.previewPanY??0)*unit;
    viewer.cameraTarget=`${center.x+Math.cos(yaw)*x-Math.sin(yaw)*Math.sin(elevation)*y}m ${center.y+Math.cos(elevation)*y}m ${center.z-Math.sin(yaw)*x-Math.cos(yaw)*Math.sin(elevation)*y}m`;
  }
  viewer.jumpCameraToGoal();
}
export function previewOrbit(config){return `${config.previewYaw??25}deg ${90-(config.previewElevation??15)}deg ${config.previewDistance??115}%`;}
// 網站預覽視窗下方的狀態列：不顯示動畫名稱 / Fixed camera，只有浮水印（有的話）
export function previewStatusText(animation,config){return config.watermark?.trim()||'';}
// previewAnimationIndex：-2 自動 idle、-1 靜止、-3 同卡片姿勢（播卡片選的動畫並停在卡片那一格）、>=0 指定動畫
export function previewAnimation(names,index=-2,config={}){
  if(index===-1)return null;
  if(index===-3)return (config.animationIndex>=0?names[config.animationIndex]:null)??null;
  if(index>=0)return names[index]??null;
  return names.find(name=>name.trim().toLowerCase()==='idle')||names.find(name=>/(^|[._\s-])idle$/i.test(name.trim()))||null;
}
export function setPreviewPlayback(viewer,config){
  const index=config.previewAnimationIndex??-2;
  const name=previewAnimation(viewer.availableAnimations||[],index,config);
  viewer.pause();delete viewer.dataset.playingAnimation;
  if(name&&index===-3){
    // 同卡片姿勢：先讓動畫啟動，再暫停並跳到卡片的時間點
    const time=Math.max(0,Number(config.time)||0);
    viewer.animationName=name;viewer.dataset.playingAnimation=name+' (pose)';
    viewer.play();
    let tries=0;const freeze=()=>{viewer.pause();viewer.currentTime=time;if(++tries<3)setTimeout(freeze,80);};
    setTimeout(freeze,60);
  }
  else if(name){viewer.animationName=name;viewer.currentTime=0;viewer.dataset.playingAnimation=name;if(!document.hidden)viewer.play();}
  else viewer.currentTime=0;
  return name;
}
