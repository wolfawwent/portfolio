import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const DEFAULTS=Object.freeze({x:0,y:0,scale:1,yaw:0,pitch:0,roll:0,animationIndex:-1,time:0,playing:true});
const W=1000,H=1400,FX=100,FY=260,FS=.9,FW=720,FH=1080,VIEW=34;
const rad=THREE.MathUtils.degToRad;
function dispose(root){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root?.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of [].concat(o.material)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
  geometries.forEach(g=>g.dispose());textures.forEach(t=>{t.dispose();t.source?.data?.close?.();});materials.forEach(m=>m.dispose());
}
export function inspectGLB(buffer){
  if(buffer.byteLength<20||buffer.byteLength>64*1024*1024)throw Error('請選擇 64 MB 以內的 GLB 模型。');
  const v=new DataView(buffer);
  if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==buffer.byteLength||v.getUint32(16,true)!==0x4e4f534a)throw Error('檔案不是有效的 GLB 2.0 模型。');
  const length=v.getUint32(12,true);if(length>buffer.byteLength-20)throw Error('GLB 資料不完整。');
  let json;try{json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));}catch{throw Error('無法讀取 GLB 內容。');}
  for(const item of [...(json.buffers||[]),...(json.images||[])])if(item.uri&&!item.uri.startsWith('data:'))throw Error('請將貼圖內嵌後重新匯出 GLB；不支援外部貼圖路徑。');
  return json;
}
export class CardRenderer{
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.config={...DEFAULTS};this.name='';this.generation=0;this.root=null;this.clips=[];
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    this.renderer.setSize(W,H);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-VIEW*W/H/2,VIEW*W/H/2,VIEW/2,-VIEW/2,.1,200);this.camera.position.set(0,0,80);
    this.holder=new THREE.Group();this.normalized=new THREE.Group();this.holder.add(this.normalized);this.scene.add(this.holder);
    this.scene.add(new THREE.HemisphereLight(0xe8efff,0x453045,1.65));
    const key=new THREE.DirectionalLight(0xffd39a,3.6);key.position.set(-25,45,35);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
    Object.assign(key.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:.1,far:150});key.shadow.bias=-.00015;key.shadow.normalBias=.04;key.shadow.radius=2;this.scene.add(key);
    const rim=new THREE.DirectionalLight(0x8edaff,2.8);rim.position.set(25,15,-22);this.scene.add(rim);
    const fill=new THREE.DirectionalLight(0xd7e6ff,1.2);fill.position.set(5,0,35);this.scene.add(fill);
    this.draco=new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/');
    this.ktx=new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/').detectSupport(this.renderer);
    this.loader=new GLTFLoader().setDRACOLoader(this.draco).setKTX2Loader(this.ktx).setMeshoptDecoder(MeshoptDecoder);
  }
  async init(){
    this.frame=new Image();this.frame.src='/assets/cards/frame.png';
    const font=new FontFace('CardUnifont','url(/assets/fonts/unifont.otf)');
    await Promise.all([this.frame.decode(),font.load().then(f=>document.fonts.add(f))]);
    this.createCardDepthLayers();
    this.fontReady=true;this.draw();
  }
  async load(buffer,settings){
    inspectGLB(buffer);const generation=++this.generation;
    const gltf=await this.loader.parseAsync(buffer,'');
    if(generation!==this.generation){dispose(gltf.scene);return false;}
    const box=new THREE.Box3().setFromObject(gltf.scene),dim=box.getSize(new THREE.Vector3());
    if(box.isEmpty()||!Number.isFinite(dim.length())||dim.length()<1e-8){dispose(gltf.scene);throw Error('GLB 內沒有可顯示的模型。');}
    this.clear();this.root=gltf.scene;this.clips=gltf.animations||[];this.config={...DEFAULTS,...settings};
    this.root.traverse(o=>{
      if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
      o.material=[].concat(o.material).map(m=>{
        if(m.isMeshBasicMaterial){const old=m;m=new THREE.MeshStandardMaterial({map:old.map,color:old.color,transparent:old.transparent,opacity:old.opacity,alphaTest:old.alphaTest,side:old.side,roughness:.92,metalness:0});old.dispose();}
        for(const value of Object.values(m))if(value?.isTexture){value.magFilter=THREE.NearestFilter;value.minFilter=THREE.NearestFilter;value.generateMipmaps=false;value.needsUpdate=true;}
        return m;
      });
      if(o.material.length===1)o.material=o.material[0];
    });
    this.normalized.add(this.root);this.mixer=new THREE.AnimationMixer(this.root);
    this.selectAnimation(settings?.animationIndex??(this.clips.length?0:-1));
    if(settings?.time)this.seek(settings.time);
    this.scene.updateMatrixWorld(true);
    box.setFromObject(this.root);const size=box.getSize(new THREE.Vector3()),mid=box.getCenter(new THREE.Vector3());
    const s=26/Math.max(size.y,size.x*.7,size.z*.5,1e-6);
    this.normalized.scale.setScalar(s);this.normalized.position.copy(mid).multiplyScalar(-s);
    this.applyTransform();this.draw();return true;
  }
  clear(){if(this.mixer){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.root);}if(this.root){this.normalized.remove(this.root);dispose(this.root);}this.root=null;this.mixer=null;this.action=null;this.clips=[];this.normalized.position.set(0,0,0);this.normalized.scale.setScalar(1);this.holder.position.set(0,0,0);this.holder.rotation.set(0,0,0);this.holder.scale.setScalar(1);}
  selectAnimation(index){
    this.mixer?.stopAllAction();this.action=null;this.config.animationIndex=-1;this.config.time=0;
    if(Number.isInteger(index)&&this.clips[index]){this.config.animationIndex=index;this.action=this.mixer.clipAction(this.clips[index]);this.action.reset().play();this.mixer.setTime(0);}
  }
  get duration(){return this.action?.getClip().duration||0;}
  seek(time){if(this.action){this.mixer.setTime(Math.max(0,Math.min(Number(time)||0,Math.max(0,this.duration-.00001))));this.config.time=this.action.time;}this.draw();}
  setSetting(key,value){this.config[key]=value;this.applyTransform();this.draw();}
  applyTransform(){const c=this.config;this.holder.position.set(c.x,c.y+1,0);this.holder.scale.setScalar(c.scale);this.holder.rotation.set(rad(c.pitch),rad(c.yaw),rad(c.roll),'YXZ');}
  step(delta){if(this.config.playing&&this.action){this.mixer.update(Math.min(delta,.05));this.config.time=this.action.time;}this.draw();}
  drawName(){
    const name=this.name.trim()||'作品名稱';
    // Draw at final export resolution: never resize the finished label by FS.
    const left=Math.round(FX+180*FS),top=Math.round(FY+986*FS);
    if(this.labelName===name&&this.labelCanvas){
      this.ctx.drawImage(this.labelCanvas,left,top);
      return;
    }
    const tile=document.createElement('canvas');
    tile.width=Math.round(440*FS);tile.height=Math.round(88*FS);
    const context=tile.getContext('2d');
    context.imageSmoothingEnabled=false;
    const glyph=document.createElement('canvas');
    glyph.width=tile.width;glyph.height=16;
    const pen=glyph.getContext('2d',{willReadFrequently:true});
    pen.font='16px CardUnifont';
    pen.textBaseline='alphabetic';
    pen.fillStyle='#352133';
    const measure=text=>Math.ceil(pen.measureText(text).width);
    const margin=12,gap=6;
    let lines=[],factor=1;
    for(const scale of [3,2,1]){
      const wrapped=[''];
      for(const character of Array.from(name)){
        const last=wrapped.length-1;
        if(wrapped[last]&&measure(wrapped[last]+character)*scale>tile.width-margin*2){
          wrapped.push(character);
        }else{
          wrapped[last]+=character;
        }
      }
      if(wrapped.length<=2&&wrapped.length*16*scale+(wrapped.length-1)*gap<=tile.height-4){
        lines=wrapped;factor=scale;break;
      }
    }
    // Overlong, unsaved input remains clipped to the nameplate.
    if(!lines.length)lines=[name];
    const totalHeight=lines.length*16*factor+(lines.length-1)*gap;
    lines.forEach((line,index)=>{
      pen.clearRect(0,0,glyph.width,glyph.height);
      // Unifont's 16px cell has a 14px ascent. Integer baseline avoids fractional placement.
      pen.fillText(line,0,14);
      const bitmap=pen.getImageData(0,0,glyph.width,glyph.height);
      for(let i=0;i<bitmap.data.length;i+=4){
        bitmap.data[i]=0x35;bitmap.data[i+1]=0x21;bitmap.data[i+2]=0x33;
        bitmap.data[i+3]=bitmap.data[i+3]>=128?255:0;
      }
      pen.putImageData(bitmap,0,0);
      const width=Math.min(measure(line),glyph.width);
      if(!width)return;
      const x=Math.floor((tile.width-width*factor)/2);
      const y=Math.floor((tile.height-totalHeight)/2)+index*(16*factor+gap);
      context.drawImage(glyph,0,0,width,16,x,y,width*factor,16*factor);
    });
    this.labelName=name;this.labelCanvas=tile;
    this.ctx.drawImage(tile,left,top);
  }

  createCardDepthLayers(){
    const unitsPerPixel=VIEW/H;
    const frameTexture=new THREE.Texture(this.frame);
    frameTexture.colorSpace=THREE.SRGBColorSpace;
    frameTexture.magFilter=THREE.NearestFilter;
    frameTexture.minFilter=THREE.NearestFilter;
    frameTexture.generateMipmaps=false;
    frameTexture.needsUpdate=true;
    const material=new THREE.MeshBasicMaterial({
      map:frameTexture,alphaTest:.5,depthTest:true,depthWrite:true,toneMapped:false
    });
    this.cardFrame=new THREE.Mesh(new THREE.PlaneGeometry(FW*unitsPerPixel,FH*unitsPerPixel),material);
    this.cardFrame.name='card-frame-depth-plane';
    this.cardFrame.position.set((FX+FW/2-W/2)*unitsPerPixel,(H/2-FY-FH/2)*unitsPerPixel,0);
    this.scene.add(this.cardFrame);

    // Outside the card, rear geometry is hidden; front geometry can protrude.
    // This only writes depth, so it cannot introduce black rectangles into the image.
    const mask=document.createElement('canvas');mask.width=W;mask.height=H;
    const pen=mask.getContext('2d');pen.fillStyle='#fff';pen.fillRect(0,0,W,H);
    pen.clearRect(FX,FY,FW,FH);
    const outsideTexture=new THREE.CanvasTexture(mask);
    outsideTexture.magFilter=THREE.NearestFilter;
    outsideTexture.minFilter=THREE.NearestFilter;
    outsideTexture.generateMipmaps=false;
    this.cardOutside=new THREE.Mesh(
      new THREE.PlaneGeometry(W*unitsPerPixel,H*unitsPerPixel),
      new THREE.MeshBasicMaterial({map:outsideTexture,alphaTest:.5,colorWrite:false,depthTest:true,depthWrite:true})
    );
    this.cardOutside.name='card-exterior-depth-only';
    this.cardOutside.renderOrder=-100;
    this.scene.add(this.cardOutside);
    this.cardTextures=[frameTexture,outsideTexture];
  }

  draw(){
    if(!this.frame?.complete||!this.fontReady)return;
    const ctx=this.ctx;
    ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#19151e';ctx.fillRect(FX+30,FY+30,FW-60,FH-60);
    // Frame and model share the same depth buffer. No fixed left or lower crop.
    this.renderer.render(this.scene,this.camera);
    ctx.drawImage(this.renderer.domElement,0,0);
    // The opaque footer/nameplate always wins, while its transparent notches
    // preserve the already rendered model underneath instead of exposing a cut line.
    ctx.drawImage(this.frame,0,960,800,240,FX,FY+960*FS,FW,240*FS);
    this.drawName();
  }

  getSettings(){return {...this.config,time:this.action?.time||0};}
  moveBy(dx,dy){this.config.x=THREE.MathUtils.clamp(this.config.x+dx*VIEW*W/H,-12,12);this.config.y=THREE.MathUtils.clamp(this.config.y-dy*VIEW,-12,12);this.applyTransform();this.draw();}
  destroy(){++this.generation;this.clear();for(const mesh of [this.cardFrame,this.cardOutside]){mesh?.geometry.dispose();mesh?.material.dispose();}this.cardTextures?.forEach(t=>t.dispose());this.renderer.dispose();this.draco.dispose();this.ktx.dispose();}
}
