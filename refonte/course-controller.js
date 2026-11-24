// Contrôleur indépendant de l'ancien planning et de l'ancien répertoire.
// Le stockage et le terminal seront injectés seulement après validation.
(function(root){
"use strict";
function create(core,sumupEvent){
  let state=core.empty();
  const get=id=>{const c=state.courses.find(c=>c.id===id);if(!c)throw Error("Course inconnue");return c};
  function apply(id,event){state=core.apply(state,id,event);return get(id)}
  return {
    snapshot:()=>JSON.parse(JSON.stringify(state)),
    plan(course){state=core.addCourse(state,course);return get(course.id)},
    load:id=>apply(id,{type:"load"}),
    start:id=>apply(id,{type:"start"}),
    finish:id=>apply(id,{type:"finish"}),
    cash(id,cents){state=core.recordCash(state,id,cents);return get(id)},
    beginSumUp(id,cents,attemptId){
      if(!Number.isSafeInteger(cents)||cents<=0)throw Error("Montant terminal invalide");
      return apply(id,{type:"beginPayment",method:"sumup",amountCents:cents,attemptId});
    },
    receiveSumUp(id,result){
      const event=sumupEvent(get(id),result);
      return event?apply(id,event):get(id);
    }
  };
}
if(typeof module==="object"&&module.exports)module.exports=()=>create(require("./clean-core"),require("./sumup-course-payment"));
else root.createTaxiCourseController=()=>create(root.TaxiCleanCore,root.TaxiSumUpEvent);
})(typeof window==="undefined"?globalThis:window);
