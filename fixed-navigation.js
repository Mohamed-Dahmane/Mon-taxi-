(function(root){
'use strict';
const doc=root.document;
const nav=doc.createElement('nav');nav.id='taxiQuickNavigation';nav.setAttribute('aria-label','Navigation rapide');
const back=doc.createElement('button');back.type='button';back.textContent='←';back.title='Page précédente';back.setAttribute('aria-label','Page précédente');
const home=doc.createElement('button');home.type='button';home.textContent='Accueil';home.setAttribute('aria-label','Retour à l’accueil');nav.append(back,home);
const style=doc.createElement('style');style.textContent=`
#taxiQuickNavigation{position:fixed!important;inset:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) auto auto!important;z-index:100;display:flex!important;gap:0!important;width:auto!important;height:42px!important;padding:0!important;margin:0!important;border:1px solid #7196c4;border-radius:13px;background:#14283f;box-shadow:0 4px 18px #0008;overflow:hidden;flex:none}
#taxiQuickNavigation[data-placement="dialog"]{position:relative!important;inset:auto!important;width:max-content!important;max-width:100%!important;margin:0 0 12px auto!important;z-index:1!important;flex-wrap:nowrap!important}
/* Pick-up is an absolute overlay inside the hotel dialog. Keep its entire
   hit area below the reserved navigation row, not just its visible title.
   Otherwise it intercepts clicks even when the navigation looks visible. */
#hotelCommissionsDialog:has(> #taxiQuickNavigation) #hotelPickup:not([hidden]){
 top:66px!important;
 bottom:0!important;
 height:auto!important;
}
/* Reserve an independent row for navigation, never over actionable controls. */
dialog:has(> #taxiQuickNavigation){padding-top:max(12px,env(safe-area-inset-top))!important}
#taxiQuickNavigation[data-placement="toolbar"]{max-width:calc(100vw - 24px)!important}
#taxiQuickNavigation button{white-space:nowrap!important}
#taxiQuickNavigation[hidden]{display:none!important}
#taxiQuickNavigation button{position:static!important;flex:none!important;box-sizing:border-box;min-height:40px!important;height:40px!important;min-width:46px!important;width:auto!important;margin:0!important;padding:8px 12px!important;border:0!important;border-radius:0!important;background:#14283f!important;color:#fff!important;font:700 14px system-ui!important;cursor:pointer;touch-action:manipulation}
#taxiQuickNavigation button:first-child{font-size:23px!important;border-right:1px solid #7196c4!important}
#taxiQuickNavigation button:disabled{opacity:.4;cursor:default}
#taxiQuickNavigation button:focus-visible{outline:3px solid #fbbf24;outline-offset:-3px}
body{padding-bottom:max(80px,env(safe-area-inset-bottom))}
#taxiDrivers,#taxiDirectoryEditor{padding-bottom:80px!important}
/* Shared responsive policy: never compress the driver directory or dialog actions
   beneath fixed navigation; allow scrolling instead of overlaying controls. */
#taxiDrivers[open],#taxiDirectoryEditor[open],#hotelCommissionsDialog[open]{
 max-height:calc(100dvh - 24px)!important;
 max-width:calc(100vw - 24px)!important;
 overflow-y:auto!important;
 overscroll-behavior:contain;
 box-sizing:border-box!important;
}
#taxiDrivers button,#taxiDirectoryEditor button,#hotelCommissionsDialog button{
 touch-action:manipulation;
}
@media(max-width:540px){
 #taxiQuickNavigation[data-placement="toolbar"]{
  position:fixed!important;top:auto!important;right:12px!important;
  bottom:max(12px,env(safe-area-inset-bottom))!important;
  left:auto!important;max-width:calc(100vw - 24px)!important;
 }
 #taxiQuickNavigation[data-placement="dialog"]{
  position:relative!important;max-width:100%!important;
 }
 #taxiDrivers[open],#taxiDirectoryEditor[open],#hotelCommissionsDialog[open]{
  width:calc(100vw - 16px)!important;
  max-width:calc(100vw - 16px)!important;
 }
 #taxiDrivers button,#taxiDirectoryEditor button{
  min-height:40px;
 }
}
`;
doc.head.append(style);doc.body.append(nav);
const readPage=()=>({page:doc.querySelector('.page.active')?.id||'home',tab:doc.querySelector('.panel.active')?.id||''});
const key=state=>state.page==='home'?'home':state.page+':'+state.tab;
let current=readPage(),history=[],dialogs=[];
function refresh(){
 const opened=[...doc.querySelectorAll('dialog[open]')];
 dialogs=dialogs.filter(d=>opened.includes(d));for(const d of opened)if(!dialogs.includes(d))dialogs.push(d);
 const top=dialogs.at(-1),host=top||doc.body;
 // Placer la navigation dans le dialogue actif, y compris le Planning.
 nav.dataset.placement=top?'dialog':'toolbar';
 // In dialogs, navigation stays in document flow instead of covering action buttons.
 if(nav.parentElement!==host)host.prepend(nav);
 // Keep navigation out of the click path of controls in other open dialogs.
 // The topmost dialog always owns the navigation, never an underlying dialog.
 const page=readPage();if(key(page)!==key(current)){history.push(current);current=page;}
 const hidden=(!top&&current.page==='home')||!!doc.querySelector('main[hidden]')||doc.body.classList.contains('taxi-intro-pending');if(nav.hidden!==hidden)nav.hidden=hidden;
 const disabled=!top&&current.page==='home'&&!history.length;if(back.disabled!==disabled)back.disabled=disabled;
}
function menus(){for(const id of ['quickMenu','hotelQuickMenu']){const menu=doc.getElementById(id);if(menu&&!menu.hidden){menu.hidden=true;return true;}}return false;}
function goHome(){
 for(const frame of doc.querySelectorAll('iframe')){try{frame.contentDocument?.querySelectorAll('dialog[open]').forEach(d=>d.close());}catch{}}
 for(const dialog of doc.querySelectorAll('dialog[open]'))dialog.close();
 for(const id of ['quickMenu','hotelQuickMenu','calendarDialog']){const element=doc.getElementById(id);if(element)element.hidden=true;}
 doc.querySelector('.pageBtn[data-page="home"]')?.click();
 history=[];current=readPage();root.scrollTo(0,0);refresh();
}
function goBack(){
 if(menus()){refresh();return;}
 const top=dialogs.at(-1);
 if(top){
  if(top.id==='taxiDrivers'&&root.taxiDriverNavigateBack?.())return;
  if(top.id==='hotelCommissionsDialog'){
   const pickup=doc.getElementById('hotelPickup');
   if(pickup&&!pickup.hidden){doc.getElementById('closeHotelPickup')?.click();return;}
   const frame=doc.getElementById('hotelCommissionsFrame');
   if(frame?.contentWindow?.taxiNavigateBack?.())return;
  }
  top.close();refresh();return;
 }
 const calendar=doc.getElementById('calendarDialog');if(calendar&&!calendar.hidden){calendar.hidden=true;return;}
 const previous=history.pop();
 if(previous){current=previous;doc.querySelector('.pageBtn[data-page="'+previous.page+'"]')?.click();if(previous.page!=='home')doc.querySelector('.tab[data-tab="'+previous.tab+'"]')?.click();root.scrollTo(0,0);refresh();}
 else goHome();
}
back.onclick=goBack;home.onclick=goHome;
const buttonControls='button, input:is([type=button], [type=submit], [type=reset], [type=image]), summary, [role=button]';
function buttonFeedback(event){
 if(!event.isTrusted)return;
 const button=event.target.closest?.(buttonControls);
 if(!button||button.matches(':disabled')||button.closest('[aria-disabled="true"], [inert]'))return;
 if(!root.matchMedia('(prefers-reduced-motion: reduce)').matches){
  button.animate?.([{filter:'brightness(1.4)'},{filter:'brightness(1)'}],{duration:160,easing:'ease-out'});
 }
 try{
  if(root.TaxiHaptics?.tap)root.TaxiHaptics.tap();
  else root.navigator.vibrate?.(12);
 }catch{}
}
doc.addEventListener('click',buttonFeedback,true);
// Reserve room under scrolling forms so the last field remains reachable.
function prepareFrame(frame){
 const page=frame.contentDocument;if(!page?.head||page.getElementById('taxiNavigationSpacing'))return;
 const padding=page.createElement('style');padding.id='taxiNavigationSpacing';padding.textContent='body{padding-bottom:80px!important}#reservationsOverlay,#manageOverlay,#commissionOverlay{padding-bottom:80px!important}';page.head.append(padding);
 page.addEventListener('click',buttonFeedback,true);
}
for(const frame of doc.querySelectorAll('iframe')){frame.addEventListener('load',()=>prepareFrame(frame));prepareFrame(frame);}
new MutationObserver(refresh).observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden','class']});
refresh();
})(window);
