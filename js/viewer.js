/* =====================================================================
   viewer.js — 3D 模型預覽（Three.js，ES module）

   用法：把 .glb 放進 assets/models/，然後在 index.html 的
   <div id="viewer" data-model="assets/models/你的檔案.glb">
   沒有檔案 / 載入失敗時，會顯示內建的「體素小鴨」佔位模型。

   Blockbench 匯出：File → Export → Export glTF/glb 就能直接用。
   ===================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const wrap = document.getElementById('viewer');
const status = document.getElementById('viewerStatus');
if (!wrap) throw new Error('#viewer not found');

// ---------- 場景 ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
camera.position.set(4, 3, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
wrap.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;
controls.target.set(0, 0.8, 0);

// 燈光
scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x1a1030, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const rim = new THREE.DirectionalLight(0x5ef2ff, 1.0);
rim.position.set(-5, 3, -4);
scene.add(rim);

// 地板：接陰影的透明面 + 格線
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.35 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(20, 40, 0x5ef2ff, 0x1c2238);
grid.material.transparent = true;
grid.material.opacity = 0.35;
scene.add(grid);

// ---------- 模型容器 ----------
const holder = new THREE.Group();
scene.add(holder);
let currentRoot = null;
let mixer = null;   // 動畫（glb 有 animation 才會用到）
const clock = new THREE.Clock();

function clearModel() {
  if (currentRoot) holder.remove(currentRoot);
  currentRoot = null; mixer = null;
}

// 把模型置中、縮到固定大小，這樣不管匯出的尺寸多少都看得到
function fitModel(obj, size = 2.2) {
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const scale = size / Math.max(dim.x, dim.y, dim.z);
  obj.scale.setScalar(scale);
  box.setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center);
  obj.position.y -= box.min.y;          // 底部貼地
  controls.target.set(0, (box.max.y - box.min.y) / 2, 0);
  obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
}

// ---------- 佔位模型：體素小鴨 ----------
function buildVoxelDuck() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.55 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8a2b, roughness: 0.5 });
  const black  = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.4 });
  const box = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); g.add(m); return m;
  };
  box(2.2, 1.2, 1.6, 0, 0.6, 0, yellow);          // 身體
  box(1.0, 0.5, 1.2, -1.2, 1.0, 0, yellow);       // 尾巴
  box(1.1, 1.1, 1.1, 0.9, 1.8, 0, yellow);        // 頭
  box(0.6, 0.3, 0.6, 1.7, 1.65, 0, orange);       // 嘴
  box(0.15, 0.15, 0.15, 1.35, 2.05,  0.35, black);// 眼
  box(0.15, 0.15, 0.15, 1.35, 2.05, -0.35, black);
  box(0.9, 0.4, 0.3, -0.1, 0.75,  0.9, yellow);   // 翅膀
  box(0.9, 0.4, 0.3, -0.1, 0.75, -0.9, yellow);
  return g;
}

function showPlaceholder(msg) {
  clearModel();
  currentRoot = buildVoxelDuck();
  fitModel(currentRoot);
  holder.add(currentRoot);
  setStatus(msg || '', true);
}

// ---------- 載入 glb ----------
function loadModel(url) {
  setStatus('loading model…');
  new GLTFLoader().load(
    url,
    (gltf) => {
      clearModel();
      currentRoot = gltf.scene;
      fitModel(currentRoot);
      holder.add(currentRoot);
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(currentRoot);
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      }
      setStatus('', true);
    },
    undefined,
    () => showPlaceholder()   // 找不到檔案 → 顯示小鴨
  );
}

function setStatus(text, hide = false) {
  if (!status) return;
  status.textContent = text;
  status.classList.toggle('is-hidden', hide);
}

// ---------- 工具列 ----------
let wire = false;
wrap.querySelector('.viewer__toolbar')?.addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const act = btn.dataset.action;
  if (act === 'spin') { controls.autoRotate = !controls.autoRotate; btn.classList.toggle('is-on', controls.autoRotate); }
  if (act === 'wire') {
    wire = !wire; btn.classList.toggle('is-on', wire);
    currentRoot?.traverse((m) => { if (m.isMesh) m.material.wireframe = wire; });
  }
  if (act === 'reset') { camera.position.set(4, 3, 6); controls.target.set(0, 0.8, 0); controls.update(); }
});

// ---------- 尺寸 / 迴圈 ----------
function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(wrap);
resize();

let visible = false;
new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) loop(); }, { threshold: 0.05 }).observe(wrap);
function loop() {
  if (!visible) return;
  const dt = clock.getDelta();
  mixer?.update(dt);
  if (currentRoot && !mixer) currentRoot.position.y = Math.sin(performance.now() / 700) * 0.05; // 輕微浮動
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------- 啟動 ----------
const url = wrap.dataset.model;
if (url) loadModel(url); else showPlaceholder();
loop();
