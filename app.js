import {bio,skills,achievements,publications,gallery,engagementStats} from './content.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
$('#bio').innerHTML=bio.map(t=>`<p>${esc(t)}</p>`).join('');
$('#speaker-count').textContent=engagementStats.speaker;
$('#judge-count').textContent=engagementStats.judge;
function selectSkill(id,focus=false){
  const skill=skills.find(s=>s.id===id);if(!skill)return;
  const number=skills.indexOf(skill)+1;
  $$('[data-skill]').forEach(button=>{const active=button.dataset.skill===id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus();});
  $('#skill-cube').dataset.active=id;
  $('#skill-panel').setAttribute('aria-labelledby',`skill-${id}`);
  $('#skill-panel').innerHTML=`<p class="skill-panel-index">0${number} / ${esc(skill.label)}</p><h3>${esc(skill.subtitle)}</h3><p class="skill-description">${esc(skill.description)}</p><div class="skill-terms">${skill.terms.map(term=>`<span>${esc(term)}</span>`).join('')}</div><div class="skill-evidence"><p>${id==='investment'?'FOCUS & APPROACH':'TRACK RECORD'}</p><ul>${skill.evidence.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>`;
}
selectSkill('ai');
$$('[data-skill]').forEach((button,index)=>{button.addEventListener('click',()=>selectSkill(button.dataset.skill));button.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%skills.length;else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index-1+skills.length)%skills.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=skills.length-1;if(next!==undefined){event.preventDefault();selectSkill(skills[next].id,true);}});});

let achievementFilter='semua',achievementsExpanded=false;
function renderAchievements(){
  const query=$('#achievement-search').value.trim().toLocaleLowerCase('id');
  const filtered=achievements.filter(x=>(achievementFilter==='semua'||x.category===achievementFilter)&&(!query||`${x.title} ${x.detail} ${x.year}`.toLocaleLowerCase('id').includes(query)));
  const showEverything=achievementsExpanded||query.length>0;
  const shown=showEverything?filtered:filtered.slice(0,6);
  $('#achievements').innerHTML=shown.length?shown.map(x=>`<article class="achievement-row"><span>${esc(x.year)}</span><div><h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p></div></article>`).join(''):'<p class="empty-state">Nothing matched. Try another name or year.</p>';
  $$('.filter-tabs [data-filter]').forEach(b=>{const yes=b.dataset.filter===achievementFilter;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',String(yes));});
  $('#achievement-status').textContent=`${shown.length} of ${filtered.length} entries${query?' matching':''}`;
  const button=$('#show-achievements');button.hidden=filtered.length<=6||!!query;button.setAttribute('aria-expanded',String(achievementsExpanded));button.innerHTML=achievementsExpanded?'Show less <span>↑</span>':`Show all ${filtered.length} <span>↓</span>`;
  $('#recognition').classList.toggle('expanded',achievementsExpanded);
}
renderAchievements();
$$('[data-filter]').forEach(b=>b.addEventListener('click',()=>{achievementFilter=b.dataset.filter;renderAchievements();}));
$('#achievement-search').addEventListener('input',renderAchievements);
$('#show-achievements').addEventListener('click',()=>{achievementsExpanded=!achievementsExpanded;renderAchievements();if(!achievementsExpanded)$('#achievement-search').focus({preventScroll:false});});

let publicationFilter='semua',publicationsExpanded=false;
function isBook(p){return p.type==='Book'||p.type==='Book chapter';}
function renderPublications(){
  const filtered=publications.map((p,index)=>({...p,index})).filter(p=>publicationFilter==='semua'||(publicationFilter==='buku'?isBook(p):!isBook(p)));
  const shown=publicationsExpanded?filtered:filtered.slice(0,4);
  $('#publications').innerHTML=shown.map(p=>{
    const text=`<div><h3>${esc(p.title)}</h3><p>${esc(p.venue)}</p></div><span class="publication-arrow" aria-hidden="true">↗</span>`;
    return `<article class="publication-row"><span>${esc(p.type)}<br>${esc(p.year)}</span>${p.link?`<a class="publication-inner" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer" aria-label="Telusuri publikasi di profil Google Scholar: ${esc(p.title)}">${text}</a>`:`<button class="publication-inner" data-publication="${p.index}" aria-label="Detail buku ${esc(p.title)}">${text}</button>`}</article>`;
  }).join('');
  $$('[data-publication-filter]').forEach(b=>{const yes=b.dataset.publicationFilter===publicationFilter;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',String(yes));});
  const button=$('#show-publications');button.hidden=filtered.length<=4;button.setAttribute('aria-expanded',String(publicationsExpanded));button.innerHTML=publicationsExpanded?'Show less <span>↑</span>':`Show all ${filtered.length} <span>↓</span>`;
}
renderPublications();
$$('[data-publication-filter]').forEach(b=>b.addEventListener('click',()=>{publicationFilter=b.dataset.publicationFilter;renderPublications();}));
$('#show-publications').addEventListener('click',()=>{publicationsExpanded=!publicationsExpanded;renderPublications();if(!publicationsExpanded)$('[data-publication-filter].active').focus({preventScroll:false});});

let momentIndex=0;
function renderExhibit(index,focusKey){
  momentIndex=(index+gallery.length)%gallery.length;const p=gallery[momentIndex];
  $('#gallery').innerHTML=`<div class="moment-exhibit"><button class="moment-photo" data-gallery="${momentIndex}" aria-label="Open full photo: ${esc(p.title)}"><img src="${esc(p.src)}" alt="${esc(p.caption)}" loading="lazy"><span>OPEN PHOTO <i>↗</i></span></button><div class="moment-story"><p class="moment-number"><span>0${momentIndex+1}</span> / 0${gallery.length}</p><p class="moment-category">${esc(p.category)}</p><h3>${esc(p.title)}</h3><p class="moment-caption">${esc(p.caption)}</p><div class="moment-nav"><button data-moment-step="-1" aria-label="Previous moment">←</button><span>ONE MOMENT, ONE STORY.</span><button data-moment-step="1" aria-label="Next moment">→</button></div><div class="moment-thumbnails" role="group" aria-label="Pick a moment">${gallery.map((item,i)=>`<button data-moment="${i}" aria-label="Pick photo: ${esc(item.title)}" aria-pressed="${i===momentIndex}"><img src="${esc(item.src)}" alt="" loading="lazy"><span>0${i+1}</span></button>`).join('')}</div></div></div>`;
  if(focusKey)$(focusKey)?.focus({preventScroll:true});
}
renderExhibit(0);
const detail=$('#detail-dialog'),media=$('#media-dialog');let opener,galleryIndex=null;
function openDialog(dialog,button){if(detail.open)detail.close();if(media.open)media.close();opener=button;document.body.classList.add('body-locked');dialog.showModal();dialog.scrollTop=0;}
$('#publications').addEventListener('click',e=>{
  const b=e.target.closest('[data-publication]');if(!b)return;const p=publications[Number(b.dataset.publication)];
  const text=p.title.startsWith('STOP')?'A book on students and entrepreneurship, part of Alex\'s journey of sharing what he knows about building a business.':'A digital literacy book for high school and vocational graduates, with tech and AI as the backdrop.';
  $('#dialog-content').innerHTML=`<div class="dialog-body"><p class="eyebrow">THE WRITTEN WORK / ${esc(p.year)}</p><h2 id="dialog-title">${esc(p.title)}</h2><p>${esc(text)}</p><div class="dialog-tags"><span>${esc(p.type)}</span><span>${esc(p.venue)}</span></div></div>`;openDialog(detail,b);
});
function renderGallery(index){
  const focused=document.activeElement?.hasAttribute('data-gallery-prev')?'prev':document.activeElement?.hasAttribute('data-gallery-next')?'next':null;
  galleryIndex=(index+gallery.length)%gallery.length;const p=gallery[galleryIndex];
  $('#media-content').innerHTML=`<img src="${esc(p.src)}" alt="${esc(p.caption)}"><div class="media-caption">${esc(p.title)}<span>${esc(p.caption)}</span><div class="gallery-dialog-nav"><button data-gallery-prev aria-label="Previous photo">←</button><span>${galleryIndex+1} / ${gallery.length}</span><button data-gallery-next aria-label="Next photo">→</button></div></div>`;
  $('[data-gallery-prev]').addEventListener('click',()=>renderGallery(galleryIndex-1));$('[data-gallery-next]').addEventListener('click',()=>renderGallery(galleryIndex+1));if(focused)$(`[data-gallery-${focused}]`).focus({preventScroll:true});
}
$('#gallery').addEventListener('click',event=>{
  const selected=event.target.closest('[data-moment]');if(selected){renderExhibit(Number(selected.dataset.moment),`[data-moment="${selected.dataset.moment}"]`);return;}
  const step=event.target.closest('[data-moment-step]');if(step){renderExhibit(momentIndex+Number(step.dataset.momentStep),`[data-moment-step="${step.dataset.momentStep}"]`);return;}
  const photo=event.target.closest('[data-gallery]');if(photo){renderGallery(Number(photo.dataset.gallery));openDialog(media,photo);}
});
media.addEventListener('keydown',e=>{if(galleryIndex===null)return;if(e.key==='ArrowLeft'){e.preventDefault();renderGallery(galleryIndex-1);}if(e.key==='ArrowRight'){e.preventDefault();renderGallery(galleryIndex+1);}});
[detail,media].forEach(d=>{
  d.querySelector('.dialog-close').addEventListener('click',()=>d.close());
  d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
  d.addEventListener('close',()=>{if(d===media){$('#media-content').innerHTML='';galleryIndex=null;}if(!detail.open&&!media.open){document.body.classList.remove('body-locked');opener?.focus({preventScroll:true});}});
});
const menu=$('#mobile-menu'),toggle=$('#menu-toggle');
function closeMenu(){menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open menu');}
toggle.addEventListener('click',()=>{const open=menu.hidden;menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close menu':'Open menu');});
$$('.mobile-menu a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const returnFocus=!menu.hidden&&menu.contains(document.activeElement);closeMenu();if(returnFocus)toggle.focus();}});
matchMedia('(min-width:761px)').addEventListener('change',e=>{if(e.matches)closeMenu();});
let scrollQueued=false;
function updateScroll(){
  $('#header').classList.toggle('scrolled',scrollY>35);let active='';
  for(const id of ['story','skills','recognition','writing'])if(document.getElementById(id).getBoundingClientRect().top<innerHeight*.4)active=id;
  $$('.desktop-nav a').forEach(a=>{const yes=a.hash===`#${active}`;a.classList.toggle('active',yes);if(yes)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});scrollQueued=false;
}
addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateScroll);}},{passive:true});updateScroll();
function updateTime(){try{$('#local-time').textContent=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date())+' WIB';}catch{$('#local-time').textContent='WIB';}}
updateTime();setInterval(updateTime,60000);
if('IntersectionObserver' in window&&!reduced.matches){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target);}}),{threshold:.06});document.body.classList.add('motion-ready');$$('.reveal').forEach(e=>observer.observe(e));}
let scene,paused=reduced.matches,portraitAngle=0;
const wrap=$('#scene-wrap'),motion=$('#motion-toggle'),canvas=$('#hero-canvas'),angleInput=$('#portrait-angle');
function updateAngle(value){
  portraitAngle=((Number(value)||0)%360+360)%360;const rounded=Math.round(portraitAngle);
  angleInput.value=String(rounded);$('#portrait-angle-value').value=`${rounded}°`;
  const view=rounded<45||rounded>=315?'front view':rounded<135?'right side':rounded<225?'back view':'left side';
  angleInput.setAttribute('aria-valuetext',`${rounded} degrees, ${view}`);
  $$('[data-portrait-angle]').forEach(button=>{const difference=Math.abs(portraitAngle-Number(button.dataset.portraitAngle));const active=Math.min(difference,360-difference)<.5;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
}
function setPortraitAngle(value){updateAngle(value);scene?.setAngle(portraitAngle);}
angleInput.addEventListener('input',()=>setPortraitAngle(angleInput.value));
$$('[data-portrait-angle]').forEach(button=>button.addEventListener('click',()=>setPortraitAngle(button.dataset.portraitAngle)));
updateAngle(0);
function updateMotion(){motion.setAttribute('aria-pressed',String(paused));motion.setAttribute('aria-label',paused?'Resume the portrait':'Pause the portrait');motion.textContent=paused?'▷':'Ⅱ';}
updateMotion();motion.addEventListener('click',()=>{paused=!paused;scene?.setPaused(paused);updateMotion();});
canvas.addEventListener('scene-unavailable',()=>{wrap.classList.remove('ready');wrap.classList.add('failed');});canvas.addEventListener('scene-restored',()=>{wrap.classList.remove('failed');wrap.classList.add('ready');});
async function startScene(){try{const{initScene}=await import('./scene.js');scene=await initScene({canvas,onReady:()=>wrap.classList.add('ready'),onAngleChange:value=>{if(scene)updateAngle(value);}});if(scene){scene.setPaused(paused);scene.setAngle(portraitAngle);}else throw new Error('WebGL unavailable');}catch{wrap.classList.remove('ready');wrap.classList.add('failed');$('#scene-hint').textContent='ALEX / PERSONAL PORTRAIT';motion.hidden=true;$('.portrait-controls').hidden=true;}}
startScene();
let disposeMotion;
import('./motion.js').then(({initMotion})=>{disposeMotion=initMotion();}).catch(()=>{});
addEventListener('pagehide',event=>{if(!event.persisted){scene?.dispose();disposeMotion?.();}});

