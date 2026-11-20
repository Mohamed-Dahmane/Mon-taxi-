(function(root){
'use strict';
const doc=root.document;
const style=doc.createElement('style');style.textContent='.taxi-hold-handle{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:pan-y;cursor:grab}.taxi-hold-moving{opacity:.35;outline:2px solid #78baff}.taxi-hold-preview{position:fixed!important;z-index:2147483001!important;pointer-events:none!important;margin:0!important;box-sizing:border-box;background:#234a76!important;color:#fff!important;border:2px solid #78baff!important;border-radius:10px;padding:10px;box-shadow:0 8px 25px #0007;overflow:hidden}';doc.head.append(style);
function bind(container,options){
 let state=null,blockedUntil=0;
 const groups=options.groups||[container];
 const items=(group=container)=>[...group.children].filter(row=>row.matches(options.item));
 const key=row=>row.dataset.reorderKey;
 const keys=()=>groups.map(group=>items(group).map(key));
 const drop=order=>options.onDrop(options.groups?order:order[0]);
 const enabled=()=>!options.enabled||options.enabled();
 let heldHandle=null;
 function scroller(row){for(let el=row.parentElement;el&&el!==doc.body;el=el.parentElement)if(/auto|scroll/.test(root.getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight)return el;return root;}
 function restore(order){
  const map=new Map(groups.flatMap(group=>items(group)).map(row=>[key(row),row]));
  order.forEach((list,index)=>{for(const name of list)if(map.has(name))groups[index].append(map.get(name));});
 }
 function position(){
  const s=state;if(!s?.dragging)return;
  s.ghost.style.left=(s.x-s.offsetX)+'px';s.ghost.style.top=(s.y-s.offsetY)+'px';
  if(options.groups&&!s.moved)return;
  const group=groups.find(group=>{
   const rect=group.getBoundingClientRect();
   return rect.height>0&&s.x>=rect.left&&s.x<=rect.right&&(!options.groups||s.y>=rect.top&&s.y<=rect.bottom);
  });
  s.overGroup=group;
  if(!group)return;
  const rows=items(group);
  let nearest=null,distance=Infinity;
  for(const row of rows){const r=row.getBoundingClientRect(),d=Math.hypot(s.x-r.left-r.width/2,s.y-r.top-r.height/2);if(d<distance){nearest=row;distance=d;}}
  if(s.row.parentElement!==group){group.insertBefore(s.row,nearest);return;}
  if(nearest&&nearest!==s.row){const from=rows.indexOf(s.row),to=rows.indexOf(nearest);group.insertBefore(s.row,from<to?nearest.nextSibling:nearest);}
 }
 function autoScroll(){
  const s=state;if(!s?.dragging)return;
  const rect=s.scroll===root?{top:0,bottom:root.innerHeight}:s.scroll.getBoundingClientRect();const top=Math.max(0,rect.top),bottom=Math.min(root.innerHeight,rect.bottom),edge=Math.min(60,(bottom-top)/4);
  const delta=s.y<top+edge?-Math.min(18,Math.ceil((top+edge-s.y)/4)):s.y>bottom-edge?Math.min(18,Math.ceil((s.y-bottom+edge)/4)):0;
  if(delta){s.scroll.scrollBy(0,delta);position();}s.frame=root.requestAnimationFrame(autoScroll);
 }
 function finish(commit){
  const s=state;if(!s)return;state=null;root.clearTimeout(s.timer);if(s.frame)root.cancelAnimationFrame(s.frame);s.ghost?.remove();s.row.classList.remove('taxi-hold-moving');
  if(s.kind==='mouse'&&container.hasPointerCapture(s.id))container.releasePointerCapture(s.id);
  if(!s.held)return;
  blockedUntil=Date.now()+600;heldHandle=s.handle;
  if(s.dragging){
   const order=keys();
   const changed=order.some((list,index)=>list.length!==s.order[index].length||list.some((name,position)=>name!==s.order[index][position]));
   const saved=commit&&enabled()&&changed&&(!options.groups||Boolean(s.overGroup))&&drop(order)!==false;
   if(changed&&!saved)restore(s.order);
   options.onDragEnd?.(saved);
   if(saved)return;
  }
  if(commit&&!s.moved)options.onHold?.(s.row);
 }
 function press(event,point,kind){
  if(state||(!enabled()&&!options.onHold))return;
  const handle=event.target.closest(options.handle);if(!handle||!container.contains(handle))return;
  const row=handle.closest(options.item);if(!row||!groups.includes(row.parentElement))return;
  const s=state={row,handle,id:point.id,kind,x:point.x,y:point.y,startX:point.x,startY:point.y,held:false,dragging:false,moved:false,scroll:scroller(row)};
  s.timer=root.setTimeout(()=>{
   if(state!==s||(!enabled()&&!options.onHold))return;
   s.held=true;
   if(s.kind==='mouse')container.setPointerCapture(s.id);
   if(enabled()){
    const rect=row.getBoundingClientRect();s.dragging=true;s.order=keys();
    options.onDragStart?.();
    s.scroll=scroller(row);
    s.offsetX=s.startX-rect.left;s.offsetY=s.startY-rect.top;
    s.ghost=row.cloneNode(true);s.ghost.removeAttribute('id');s.ghost.removeAttribute('data-reorder-key');
    s.ghost.className='taxi-hold-preview';s.ghost.style.width=rect.width+'px';s.ghost.style.height=rect.height+'px';
    s.ghost.setAttribute('aria-hidden','true');(row.closest('dialog')||doc.body).append(s.ghost);
    row.classList.add('taxi-hold-moving');position();autoScroll();
   }
   try{if(root.TaxiHaptics?.tap)root.TaxiHaptics.tap();else root.navigator.vibrate?.(30);}catch{}
  },450);
 }
 function move(event,point){
  const s=state;if(!s||s.id!==point.id)return;s.x=point.x;s.y=point.y;
  if(Math.hypot(s.x-s.startX,s.y-s.startY)>12)s.moved=true;
  if(s.dragging){if(event.cancelable)event.preventDefault();position();}
  else if(!s.held&&s.moved)finish(false);
 }
 container.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'&&e.button===0&&e.isPrimary)press(e,{id:e.pointerId,x:e.clientX,y:e.clientY},'mouse');});
 container.addEventListener('pointermove',e=>{if(state?.kind==='mouse')move(e,{id:e.pointerId,x:e.clientX,y:e.clientY});});
 container.addEventListener('pointerleave',()=>{if(state?.kind==='mouse'&&!state.held)finish(false);});
 container.addEventListener('pointerup',e=>{if(state?.kind==='mouse'&&e.pointerId===state.id)finish(true);});
 container.addEventListener('pointercancel',e=>{if(state?.kind==='mouse'&&e.pointerId===state.id)finish(false);});
 container.addEventListener('lostpointercapture',e=>{if(state?.kind==='mouse'&&e.pointerId===state.id)finish(false);});
 container.addEventListener('touchstart',e=>{if(e.touches.length!==1){finish(false);return;}const t=e.changedTouches[0];press(e,{id:t.identifier,x:t.clientX,y:t.clientY},'touch');},{passive:true});
 container.addEventListener('touchmove',e=>{if(state?.kind!=='touch')return;const t=[...e.changedTouches].find(t=>t.identifier===state.id);if(t)move(e,{id:t.identifier,x:t.clientX,y:t.clientY});},{passive:false});
 container.addEventListener('touchend',e=>{if(state?.kind==='touch'&&[...e.changedTouches].some(t=>t.identifier===state.id)){if(state.held&&e.cancelable)e.preventDefault();finish(true);}},{passive:false});
 container.addEventListener('touchcancel',()=>finish(false));
 container.addEventListener('click',e=>{if(Date.now()<blockedUntil&&e.target.closest(options.handle)===heldHandle){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 container.addEventListener('contextmenu',e=>{if(e.target.closest(options.handle))e.preventDefault();});
 root.addEventListener('blur',()=>finish(false));container.closest('dialog')?.addEventListener('close',()=>finish(false));
 container.addEventListener('keydown',e=>{
  const directions=options.groups?['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']:['ArrowUp','ArrowDown'];
  if(!enabled()||!e.altKey||!directions.includes(e.key))return;
  const row=e.target.closest(options.handle)?.closest(options.item);
  const group=row?.parentElement;
  if(!groups.includes(group))return;
  const rows=items(group),index=rows.indexOf(row);
  const previous=['ArrowLeft','ArrowUp'].includes(e.key);
  const target=rows[index+(previous?-1:1)];
  const nextGroup=groups[groups.indexOf(group)+(previous?-1:1)];
  if(!target&&!nextGroup)return;
  e.preventDefault();
  const before=keys();
  if(target)group.insertBefore(row,previous?target:target.nextSibling);
  else nextGroup.insertBefore(row,previous?null:nextGroup.firstChild);
  if(drop(keys())===false)restore(before);
  row.closest('details')?.setAttribute('open','');
  row.focus();
 });
}
root.TaxiHoldReorder={bind};
})(window);
