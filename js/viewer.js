/* =====================================================================
   viewer.js — 3D 模型預覽（Three.js，ES module）

   ・模型清單在 index.html 的 #modelGrid，每張 .model 卡片的 data-model 是 .glb 路徑
   ・點卡片 → 載入到預覽器；第一張卡片會自動載入
   ・把 .glb 檔直接拖進預覽器也能看（本機測試模型很方便，不會上傳到任何地方）

   Blockbench 匯出：File → Export → Export glTF/glb（勾 .glb）
   像素貼圖會自動用 Nearest 過濾，不會糊掉。
   ===================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const wrap   = document.getElementById('viewer');
const status = document.getElementById('viewerStatus');
const title  = document.getElementById('viewerTitle');
const grid   = document.getElementById('modelGrid');
if (!wrap) throw new Error('#viewer not found');

// ---------- 場景 ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
const HOME = new THREE.Vector3(4, 3, 6);
camera.position.copy(HOME);

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

// 地板陰影 + 格線
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.35 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid3d = new THREE.GridHelper(20, 40, 0x5ef2ff, 0x1c2238);
grid3d.material.transparent = true;
grid3d.material.opacity = 0.35;
scene.add(grid3d);

// ---------- 模型容器 ----------
const holder = new THREE.Group();
scene.add(holder);
let currentRoot = null;
let mixer = null;
let wire = false;
const clock = new THREE.Clock();
const loader = new GLTFLoader();

function clearModel() {
  if (currentRoot) {
    holder.remove(currentRoot);
    currentRoot.traverse((m) => { if (m.isMesh) { m.geometry?.dispose(); } });
  }
  currentRoot = null; mixer = null;
}

// 置中、縮到固定大小、底部貼地
function fitModel(obj, size = 2.4) {
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const scale = size / Math.max(dim.x, dim.y, dim.z, 1e-6);
  obj.scale.setScalar(scale);
  box.setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center);
  obj.position.y -= box.min.y;
  controls.target.set(0, (box.max.y - box.min.y) / 2, 0);
}

// 像素貼圖：關掉線性過濾，讓像素保持銳利
function pixelate(obj) {
  obj.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => {
      ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap'].forEach((k) => {
        const t = mat[k];
        if (t) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; }
      });
      mat.wireframe = wire;
    });
  });
}

function setStatus(text, hide = false) {
  if (!status) return;
  status.textContent = text;
  status.classList.toggle('is-hidden', hide);
}

function placeModel(gltf, name) {
  clearModel();
  currentRoot = gltf.scene;
  pixelate(currentRoot);
  fitModel(currentRoot);
  holder.add(currentRoot);
  if (gltf.animations?.length) {
    mixer = new THREE.AnimationMixer(currentRoot);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
  }
  if (title) title.textContent = name || '';
  setStatus('', true);
}

// 從網址載入
function loadModel(url, name) {
  setStatus('loading ' + (name || url) + '…');
  loader.load(
    url,
    (gltf) => placeModel(gltf, name),
    undefined,
    () => { clearModel(); if (title) title.textContent = ''; setStatus('no model yet — add a .glb to assets/models/ (or drop one here)'); }
  );
}

// 從拖進來的檔案載入（純本機預覽，不會上傳）
function loadFile(file) {
  setStatus('reading ' + file.name + '…');
  const reader = new FileReader();
  reader.onload = () => {
    loader.parse(reader.result, '', (gltf) => placeModel(gltf, file.name), () => setStatus('could not read ' + file.name));
  };
  reader.readAsArrayBuffer(file);
}

// ---------- 模型清單卡片 ----------
if (grid) {
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.model'); if (!card) return;
    grid.querySelectorAll('.model').forEach((c) => c.classList.toggle('is-active', c === card));
    loadModel(card.dataset.model, card.dataset.name || card.querySelector('h3')?.textContent);
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

// ---------- 拖放 ----------
['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); wrap.classList.add('is-drop'); }));
['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); wrap.classList.remove('is-drop'); }));
wrap.addEventListener('drop', (e) => {
  const file = [...e.dataTransfer.files].find((f) => /\.(glb|gltf)$/i.test(f.name));
  if (file) { grid?.querySelectorAll('.model').forEach((c) => c.classList.remove('is-active')); loadFile(file); }
  else setStatus('drop a .glb file');
});

// ---------- 工具列 ----------
wrap.querySelector('.viewer__toolbar')?.addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const act = btn.dataset.action;
  if (act === 'spin') { controls.autoRotate = !controls.autoRotate; btn.classList.toggle('is-on', controls.autoRotate); }
  if (act === 'wire') {
    wire = !wire; btn.classList.toggle('is-on', wire);
    currentRoot?.traverse((m) => { if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => (mat.wireframe = wire)); });
  }
  if (act === 'reset') { camera.position.copy(HOME); if (currentRoot) fitModel(currentRoot); controls.update(); }
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
  mixer?.update(clock.getDelta());
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------- 啟動：載入第一張卡片 ----------
const first = grid?.querySelector('.model');
if (first) { first.classList.add('is-active'); loadModel(first.dataset.model, first.dataset.name); }
else setStatus('no models listed');
loop();
