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
export function previewStatusText(animation,config){return `${animation||'Static preview'} · Fixed camera${config.watermark?.trim()?' · '+config.watermark.trim():''}`;}
export function previewAnimation(names,index=-2){
  if(index===-1)return null;
  if(index>=0)return names[index]??null;
  return names.find(name=>name.trim().toLowerCase()==='idle')||names.find(name=>/(^|[._\s-])idle$/i.test(name.trim()))||null;
}
export function setPreviewPlayback(viewer,config){
  const name=previewAnimation(viewer.availableAnimations||[],config.previewAnimationIndex??-2);
  viewer.pause();delete viewer.dataset.playingAnimation;
  if(name){viewer.animationName=name;viewer.currentTime=0;viewer.dataset.playingAnimation=name;if(!document.hidden)viewer.play();}
  else viewer.currentTime=0;
  return name;
}
