export async function mountSavedCards(grid){
  if(!grid)return [];
  try{
    const response=await fetch('assets/cards/manifest.json',{cache:'no-cache'});
    if(!response.ok)return [];
    const cards=await response.json();
    const safe=Array.isArray(cards)?cards.filter(c=>typeof c.name==='string'&&/^assets\/models\/[a-z0-9-]+\.glb$/.test(c.model)&&/^assets\/cards\/[a-z0-9-]+\.png$/.test(c.image)):[];
    if(!safe.length)return [];
    const nodes=safe.map(card=>{
      const article=document.createElement('article');article.className='card model card--artwork';article.tabIndex=0;article.setAttribute('role','button');article.setAttribute('aria-label','View '+card.name);
      article.dataset.model=card.model;article.dataset.name=card.name;article.dataset.animationIndex=card.config?.animationIndex??0;article.dataset.animationTime=card.config?.time??0;article.dataset.animationPlaying=String(card.config?.playing??true);
      const image=document.createElement('img');image.src=card.image;image.alt=card.name;image.loading='lazy';image.width=1000;image.height=1400;article.append(image);
      article.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();article.click();}});return article;
    });grid.replaceChildren(...nodes);return safe;
  }catch{return [];}
}
