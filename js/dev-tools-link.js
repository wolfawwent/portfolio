(async()=>{
  if(!['127.0.0.1','localhost'].includes(location.hostname))return;
  try{const r=await fetch('/__editor/api/session',{cache:'no-store'});if(!r.ok)return;const session=await r.json();if(session.owner){const link=document.createElement('a');link.href='/__editor/';link.textContent='開發者工具';document.querySelector('.nav__links')?.append(link);}}catch{}
})();
