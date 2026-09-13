/* Fixed-camera model preview using independently saved settings. */
(() => {
  const t = window.PortfolioI18n?.t || (text => text);
  const dialog = document.createElement('dialog');
  dialog.className = 'model-dialog';
  dialog.setAttribute('aria-labelledby', 'modelDialogTitle');
  dialog.innerHTML = '<header class="model-dialog__header"><h2 id="modelDialogTitle"></h2><button type="button" class="model-dialog__close" aria-label="Close model preview">×</button></header><div class="model-dialog__stage"></div><p class="model-dialog__status" role="status" aria-live="polite"></p>';
  dialog.querySelector('button').setAttribute('aria-label', t('Close model preview'));
  document.body.append(dialog);
  const title = dialog.querySelector('h2');
  const stage = dialog.querySelector('.model-dialog__stage');
  const status = dialog.querySelector('[role="status"]');
  let runtime, active, generation = 0, opener;
  const safeName = name => name.trim().replace(/[<>:"/\\|?*]/g, '_').replace(/[ .]+$/g, '');
  // 卡片工具偵測到半透明貼圖時會把 config.blend 設成 true → 這裡把所有材質切成 BLEND
  function applyBlendMode(viewer,config){
      if(!config||!config.blend||!viewer.model)return;
      try{
        const list=Array.isArray(config.blendMaterials)&&config.blendMaterials.length?config.blendMaterials:null;
        viewer.model.materials.forEach((m,i)=>{
          if(list&&!list.includes(i))return;
          if(m.getAlphaMode?.()!=='BLEND')m.setAlphaMode('BLEND');
          // model-viewer 的 BLEND 會把 depthWrite 關掉，整個模型會前後互穿；這裡把它打開（透明像素靠 alpha 混合，實心部分照常遮擋）
          const sym=Object.getOwnPropertySymbols(m).find(s=>String(s).includes('correlatedObjects'));
          const set=sym?m[sym]:null;if(set)for(const three of set){three.depthWrite=true;three.alphaTest=Math.max(three.alphaTest||0,.02);three.needsUpdate=true;}
        });
      }catch(e){console.warn('[preview] blend',e);}
  }
  async function records() {
    return fetch('/assets/cards/manifest.json', {cache:'no-store'}).then(r => {
      if (!r.ok) throw Error('Model catalogue unavailable.');
      return r.json();
    });
  }
  function stop() { if (active) { active.pause(); active.removeAttribute('src'); active.remove(); active = null; } }
  function closePreview() {
    ++generation;stop();document.documentElement.classList.remove('model-dialog-open');
    dialog.close();opener?.focus({preventScroll:true});
  }
  dialog.querySelector('button').addEventListener('click', closePreview);
  dialog.addEventListener('cancel', event => { event.preventDefault();closePreview(); });
  dialog.addEventListener('click', event => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) closePreview();
  });
  dialog.addEventListener('close', () => { if (!dialog.open) { stop();document.documentElement.classList.remove('model-dialog-open'); } });
  document.addEventListener('visibilitychange', () => {
    if (!active) return;
    if (document.hidden) active.pause();
    else if (dialog.open && active.dataset.playingAnimation) active.play();
  });
  window.openCardPreview = async (card, editorRecord=null) => {
    const token = ++generation;stop();opener = card;
    title.textContent = card.dataset.name;status.textContent = t('Loading model…');
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('model-dialog-open');
    try {
      const localPreview=location.pathname==='/__editor/preview.html'&&['127.0.0.1','localhost'].includes(location.hostname);
      const items = localPreview&&editorRecord ? [editorRecord] : await records();
      if (token !== generation || !dialog.open) return;
      const matches = Array.isArray(items) ? items.filter(item => {
        if (localPreview&&item===editorRecord) return true;
        if (typeof item?.name !== 'string' || !/^assets\/models\/[a-z0-9-]+\.glb$/i.test(item.model || '')) return false;
        const category = item.config?.category || 'entity';
        const file = `card_${category}_${safeName(item.name)}.png`;
        return file === card.dataset.file || (category === card.dataset.category && item.name.trim() === card.dataset.name);
      }) : [];
      if (matches.length !== 1) { status.textContent = t('Model preview is not available for this card yet.');return; }
      const record = matches[0];
      const {applyPreviewCamera,setPreviewPlayback,previewStatusText} = await import('./model-preview-settings.js?v=pose-2');
      if (!runtime) runtime = import('../assets/vendor/model-viewer-4.3.1.min.js').catch(e => { runtime = null;throw e; });
      await runtime;await customElements.whenDefined('model-viewer');
      if (token !== generation || !dialog.open) return;
      const viewer = document.createElement('model-viewer');active = viewer;
      viewer.setAttribute('alt', `${record.name} — ${t('fixed-angle model preview')}`);
      // No camera-controls, auto-rotate, AR, or autoplay: never start a default clip.
      applyPreviewCamera(viewer,record.config || {});
      if(localPreview)window.updateEditorCardPreview=config=>{record.config=config;title.textContent=config.name||'模型預覽';applyPreviewCamera(viewer,config);if(viewer.loaded&&viewer.dataset.previewIndex!==String(config.previewAnimationIndex)){setPreviewPlayback(viewer,config);viewer.dataset.previewIndex=String(config.previewAnimationIndex);}if(viewer.loaded)status.textContent=previewStatusText(viewer.dataset.playingAnimation,config);};
      viewer.setAttribute('field-of-view', '30deg');
      viewer.setAttribute('interaction-prompt', 'none');
      viewer.setAttribute('disable-zoom', '');viewer.setAttribute('disable-pan', '');viewer.setAttribute('disable-tap', '');
      viewer.setAttribute('shadow-intensity', '0.5');viewer.setAttribute('exposure', '1');
      viewer.setAttribute('animation-crossfade-duration', '0');
      viewer.addEventListener('load', () => {
        if (token !== generation || viewer !== active || !dialog.open) return;
        applyBlendMode(viewer, record.config || {});
        const animation = setPreviewPlayback(viewer, record.config || {});
        status.textContent = previewStatusText(animation,record.config || {});
        applyPreviewCamera(viewer,record.config || {});
      });
      viewer.addEventListener('error', () => { if (token === generation) status.textContent = t('Unable to load this model. Please close and try again.'); });
      stage.replaceChildren(viewer);viewer.src = record.model;
    } catch (e) {
      if (token === generation && dialog.open) {stop();status.textContent = t('Unable to load the preview. Please close and try again.');}
      console.warn('[model preview]', e);
    }
  };
})();
