export const PREVIEW_DEFAULTS=Object.freeze({previewYaw:25,previewElevation:15,previewDistance:115,previewAnimationIndex:-2});
export function previewOrbit(config){return `${config.previewYaw??25}deg ${90-(config.previewElevation??15)}deg ${config.previewDistance??115}%`;}
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
