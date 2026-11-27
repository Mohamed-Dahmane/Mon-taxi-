/* Mon Taxi Pro — Gmail test, isolated from receipt and payment flows. */
(()=>{"use strict";
const init=()=>{
 const b=document.createElement("button");b.type="button";b.id="taxiGmailTest";b.textContent="Tester Gmail";b.style.cssText="position:fixed;right:12px;bottom:82px;z-index:9998;padding:10px 14px;border-radius:12px;background:#153c6a;color:white;border:1px solid #78a8e2;font:600 14px sans-serif";
 b.onclick=async()=>{
  const email=prompt("Adresse de destination du message de test Gmail :","dbs.maral@gmail.com");
  if(email===null)return;
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)||email.length>254){alert("Adresse e-mail invalide.");return;}
  if(typeof privateSession==="undefined"||!privateSession?.access_token){alert("Connecte-toi à Mon Taxi Pro avant le test Gmail.");return;}
  b.disabled=true;b.textContent="Envoi en cours…";
  try{
   if(privateSession.expires_at&&privateSession.expires_at*1000<Date.now()+60000&&typeof renewPrivateSession==="function")await renewPrivateSession();
   const res=await fetch("https://uenyvsiturkihectolxp.supabase.co/functions/v1/taxi-gmail-send-v1",{method:"POST",headers:{"Content-Type":"application/json","apikey":privateKey,"Authorization":"Bearer "+privateSession.access_token},body:JSON.stringify({to:email,subject:"Mon Taxi Pro — test Gmail",text:"Ceci est un message de test du service Gmail de Mon Taxi Pro."})});
   const data=await res.json().catch(()=>({}));
   alert(res.ok&&data.code==="sent"?"E-mail de test envoyé. Vérifie la boîte de réception.":"Envoi impossible ("+(data.code||res.status)+").");
  }catch{alert("Connexion Gmail indisponible. Aucun reçu modifié.");}
  finally{b.disabled=false;b.textContent="Tester Gmail";}
 };
 document.body.appendChild(b);
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();