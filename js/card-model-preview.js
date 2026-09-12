/* Fixed-camera model preview using independently saved settings. */
(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'model-dialog';
  dialog.setAttribute('aria-labelledby', 'modelDialogTitle');
  dialog.innerHTML = '<header class="model-dialog__header"><h2 id="modelDialogTitle"></h2><button type="button" class="model-dialog__close" aria-label="Close model preview">×</button></header><div class="model-dialog__stage"></div><p class="model-dialog__status" role="status" aria-live="polite"></p>';
  document.body.append(dialog);
  const title = dialog.querySelector('h2');
  const stage = dialog.querySelector('.model-dialog__stage');
  const status = dialog.querySelector('[role="status"]');
  let runtime, manifest, active, generation = 0, opener;
  const safeName = name => name.trim().replace(/[<>:"/\\|?*]/g, '_').replace(/[ .]+$/g, '');
  async function records() {
    if (!manifest) manifest = fetch('assets/cards/manifest.json', {cache:'no-cache'}).then(r => {
      if (!r.ok) throw Error('Model catalogue unavailable.');
      return r.json();
    }).catch(e => { manifest = null; throw e; });
    return manifest;
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
    title.textContent = card.dataset.name;status.textContent = 'Loading model…';
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
      if (matches.length !== 1) { status.textContent = 'Model preview is not available for this card yet.';return; }
      const record = matches[0];
      const {applyPreviewCamera,previewOrbit,setPreviewPlayback} = await import('./model-preview-settings.js');
      if (!runtime) runtime = import('../assets/vendor/model-viewer-4.3.1.min.js').catch(e => { runtime = null;throw e; });
      await runtime;await customElements.whenDefined('model-viewer');
      if (token !== generation || !dialog.open) return;
      const viewer = document.createElement('model-viewer');active = viewer;
      viewer.setAttribute('alt', `${record.name} — fixed-angle model preview`);
      // No camera-controls, auto-rotate, AR, or autoplay: never start a default clip.
      applyPreviewCamera(viewer,record.config || {});
      if(localPreview)window.updateEditorCardPreview=config=>{record.config=config;title.textContent=config.name||'模型預覽';applyPreviewCamera(viewer,config);if(viewer.loaded&&viewer.dataset.previewIndex!==String(config.previewAnimationIndex)){setPreviewPlayback(viewer,config);viewer.dataset.previewIndex=String(config.previewAnimationIndex);}};
      viewer.setAttribute('field-of-view', '30deg');
      viewer.setAttribute('interaction-prompt', 'none');
      viewer.setAttribute('disable-zoom', '');viewer.setAttribute('disable-pan', '');viewer.setAttribute('disable-tap', '');
      viewer.setAttribute('shadow-intensity', '0.5');viewer.setAttribute('exposure', '1');
      viewer.setAttribute('animation-crossfade-duration', '0');
      viewer.addEventListener('load', () => {
        if (token !== generation || viewer !== active || !dialog.open) return;
        const animation = setPreviewPlayback(viewer, record.config || {});
        status.textContent = animation ? `${animation} · Fixed camera` : 'Static preview · Fixed camera';
        applyPreviewCamera(viewer,record.config || {});
      });
      viewer.addEventListener('error', () => { if (token === generation) status.textContent = 'Unable to load this model. Please close and try again.'; });
      stage.replaceChildren(viewer);viewer.src = record.model;
    } catch (e) {
      if (token === generation && dialog.open) status.textContent = 'Unable to load the preview. Please close and try again.';
      console.warn('[model preview]', e);
    }
  };
})();
