// Contrôleur indépendant de l'ancien planning et de l'ancien répertoire.
// Le stockage et le terminal seront injectés seulement après validation.
(function(root){
"use strict";
function create(core,sumupEvent,storage){
  let state=core.validateState(storage?.load()??core.empty());
  function commit(next){const validated=core.validateState(next);if(storage)storage.save(validated);state=validated;}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  const get=id=>{const c=state.courses.find(c=>c.id===id);if(!c)throw Error("Course inconnue");return c};
  function apply(id,event){commit(core.apply(state,id,event));return clone(get(id))}
  return {
    snapshot:()=>clone(state),
    setReceiptProfile(p){commit(core.setReceiptProfile(state,clone(p)));},
    saveDirectory(kind,item){commit(core.saveDirectory(state,kind,clone(item)));},
    removeDirectory(kind,id){commit(core.removeDirectory(state,kind,id));},
    moveDirectory(kind,id,delta){commit(core.moveDirectory(state,kind,id,delta));},
    setDay(day,entry){commit(core.setDay(state,day,entry));},
    setFixed(month,cents){commit(core.setFixed(state,month,cents));},
    daily:day=>core.dayTotals(state,day),
    monthly:month=>core.monthTotals(state,month),
    backup:()=>core.backup(state),
    restore(raw){
      if(state.courses.some(c=>c.status==="payment_pending"||c.refundPending))throw Error("Paiement en attente : restauration interdite.");
      const next=core.readBackup(raw);commit(clone(next));
    },
    plan(course){commit(core.addCourse(state,clone(course)));return clone(get(course.id))},
    startFree(course){
      const id=course?.id;
      const next=core.apply(core.apply(core.addCourse(state,{...clone(course),kind:"free",driverIsMe:true,commissionCents:0}),id,{type:"load"}),id,{type:"start"});
      commit(next);return clone(get(id));
    },
    editDetails(id,fields){
      const c=get(id);
      if(!["planned","loaded","in_progress","awaiting_payment"].includes(c.status))throw Error("Course déjà en paiement ou archivée.");
      const edited={...c};
      for(const key of ["to","from","room","client","phone"])edited[key]=String(fields[key]??c[key]??"").trim();
      commit({...state,courses:state.courses.map(item=>item.id===id?edited:item)});
    },
    removeCourse(id){
      const c=get(id);
      if(!["planned","loaded","in_progress","awaiting_payment"].includes(c.status)||c.payment?.reference)throw Error("Suppression indisponible après paiement.");
      commit({...state,courses:state.courses.filter(item=>item.id!==id)});
    },
    load:id=>apply(id,{type:"load"}),
    start:id=>apply(id,{type:"start"}),
    finish:id=>apply(id,{type:"finish"}),
    prepareRefund(id,amountCents){commit(core.prepareRefund(state,id,amountCents));return clone(get(id))},
    confirmRefund(id,result){commit(core.confirmRefund(state,id,result));return clone(get(id))},
    refund(id,day,amountCents){commit(core.recordRefund(state,id,day,amountCents));return clone(get(id))},
    cash(id,cents){commit(core.recordCash(state,id,cents));return clone(get(id))},
    savePaymentDraft(id,cents){commit(core.savePaymentDraft(state,id,cents));return clone(get(id));},
    beginSumUp(id,cents,attemptId){
      if(!Number.isSafeInteger(cents)||cents<=0)throw Error("Montant terminal invalide");
      return apply(id,{type:"beginPayment",method:"sumup",amountCents:cents,attemptId});
    },
    receiveSumUp(id,result){
      const event=sumupEvent(get(id),result);
      return event?apply(id,event):clone(get(id));
    }
  };
}
if(typeof module==="object"&&module.exports)module.exports=(storage)=>create(require("./clean-core"),require("./sumup-course-payment"),storage);
else root.createTaxiCourseController=(storage)=>create(root.TaxiCleanCore,root.TaxiSumUpEvent,storage);
})(typeof window==="undefined"?globalThis:window);
