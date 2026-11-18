(function(root){
'use strict';
const doc=root.document;
const style=doc.createElement('style');style.textContent='.taxi-hold-handle{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:pan-y;cursor:grab}.taxi-hold-moving{opacity:.35;outline:2px solid #78baff}.taxi-hold-preview{position:fixed!important;z-index:2147483001!important;pointer-events:none!important;margin:0!important;box-sizing:border-box;background:#234a76!important;color:#fff!important;border:2px solid #78baff!important;border-radius:10px;padding:10px;box-shadow:0 8px 25px #0007;overflow:hidden}';doc.head.append(style);
function bind(container,options){
 let state=null,blockedUntil=0;
 const items=()=>[...container.querySelectorAll(options.item)];
 const keys=()=>items().map(row=>row.getAttribute('data-reorder-key'));
 const enabled=()=>!options.enabled||options.enabled();
 function scroller(row){for(let el=row.parentElement;el&&el!==doc.body;el=el.parentElement)if(/auto|scroll/.test(root.getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight)return el;return root;}
 function restore(order){const map=new Map(items().map(row=>[row.getAttribute('data-reorder-key'),row]));for(const key of order)if(map.has(key))container.append(map.get(key));}
 function position(){
  const s=state;if(!s?.dragging)return;
  s.ghost.style.left=(s.x-s.offsetX)+'px';s.ghost.style.top=(s.y-s.offsetY)+'px';
  const bounds=container.getBoundingClientRect();if(s.x<bounds.left||s.x>bounds.right)return;
  const rows=items();let nearest=null,distance=Infinity;
  for(const row of rows){const r=row.getBoundingClientRect(),d=Math.hypot(s.x-r.left-r.width/2,s.y-r.top-r.height/2);if(d<distance){nearest=row;distance=d;}}
  if(nearest&&nearest!==s.row){const from=rows.indexOf(s.row),to=rows.indexOf(nearest);container.insertBefore(s.row,from<to?nearest.nextSibling:nearest);}
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
  blockedUntil=Date.now()+600;
  if(s.dragging){
   const order=keys(),changed=order.some((key,index)=>key!==s.order[index]);
   if(!commit||!enabled())restore(s.order);
   else if(changed){if(options.onDrop(order)===false)restore(s.order);return;}
  }
  if(commit&&!s.moved)options.onHold?.(s.row);
 }
 function press(event,point,kind){
  if(state||(!enabled()&&!options.onHold))return;
  const handle=event.target.closest(options.handle);if(!handle||!container.contains(handle))return;
  const row=handle.closest(options.item);if(!row||row.parentElement!==container)return;
  const s=state={row,id:point.id,kind,x:point.x,y:point.y,startX:point.x,startY:point.y,held:false,dragging:false,moved:false,scroll:scroller(row)};
  s.timer=root.setTimeout(()=>{
   if(state!==s||(!enabled()&&!options.onHold))return;
   s.held=true;
   if(s.kind==='mouse')container.setPointerCapture(s.id);
   if(enabled()){
    const rect=row.getBoundingClientRect();s.dragging=true;s.order=keys();
    s.offsetX=s.startX-rect.left;s.offsetY=s.startY-rect.top;
    s.ghost=row.cloneNode(true);s.ghost.removeAttribute('id');s.ghost.removeAttribute('data-reorder-key');
    s.ghost.className='taxi-hold-preview';s.ghost.style.width=rect.width+'px';s.ghost.style.height=rect.height+'px';
    s.ghost.setAttribute('aria-hidden','true');(row.closest('dialog')||doc.body).append(s.ghost);
    row.classList.add('taxi-hold-moving');position();autoScroll();
   }
   try{root.navigator.vibrate?.(30);}catch{}
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
 container.addEventListener('click',e=>{if(Date.now()<blockedUntil){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 container.addEventListener('contextmenu',e=>{if(e.target.closest(options.handle))e.preventDefault();});
 root.addEventListener('blur',()=>finish(false));container.closest('dialog')?.addEventListener('close',()=>finish(false));
 container.addEventListener('keydown',e=>{if(!enabled()||!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;const handle=e.target.closest(options.handle),row=handle?.closest(options.item),rows=items(),index=rows.indexOf(row),target=index+(e.key==='ArrowUp'?-1:1);if(index<0||target<0||target>=rows.length)return;e.preventDefault();const before=keys();container.insertBefore(row,e.key==='ArrowUp'?rows[target]:rows[target].nextSibling);if(options.onDrop(keys())===false)restore(before);});
}
root.TaxiHoldReorder={bind};
})(window);
