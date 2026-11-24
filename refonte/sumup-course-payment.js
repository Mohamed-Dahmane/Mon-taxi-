// Adaptateur de refonte : uniquement les paiements déclenchés par Mon Taxi.
// Ne lit jamais l'historique SumUp. Le pont natif doit fournir attemptId, le code de transaction
// et le montant/devise associés au retour SDK de confiance. Aucun événement global non corrélé.
function sumupEvent(course, result) {
 if (!course || course.status !== "payment_pending" || course.payment?.method !== "sumup") throw Error("Aucun paiement SumUp attendu pour cette course");
 const p=course.payment;
 if (!result || result.attemptId !== p.attemptId) throw Error("Retour SumUp non associé à la tentative");
 if(result.status==="success"){
  if(typeof result.transactionCode!=="string" || !result.transactionCode.trim()) throw Error("Code de transaction absent : statut incertain");
  if(result.amountCents!==p.amountCents || result.currency!=="EUR") throw Error("Montant ou devise non concordants : vérifier avant de clôturer");
  const event={type:"paymentConfirmed",attemptId:p.attemptId,result:"confirmed",reference:result.transactionCode.trim()};
  if(result.verifiedBy==="sumup_transactions_api"){if(typeof result.paidAt!=="string"||!Number.isFinite(Date.parse(result.paidAt)))throw Error("Date officielle absente");event.paidAt=new Date(result.paidAt).toISOString();}return event;
 }
 if(result.status==="cancelled"||result.status==="declined"){
  const event={type:"paymentFailed",attemptId:p.attemptId,result:result.status};
  if(result.verifiedBy==="sumup_transactions_api"){
   if(result.amountCents!==p.amountCents||result.currency!=="EUR"||typeof result.transactionCode!=="string"||!result.transactionCode.trim())throw Error("Échec non concordant : protection maintenue");
   event.reference=result.transactionCode.trim();event.verifiedBy=result.verifiedBy;
  }
  return event;
 }
 return null; // Incertain : maintenir la course et ne pas relancer automatiquement.
}
if(typeof module==='object'&&module.exports)module.exports=sumupEvent;
else if(typeof window!=='undefined')window.TaxiSumUpEvent=sumupEvent;
