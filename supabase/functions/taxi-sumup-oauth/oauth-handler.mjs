import {buildAuthorize,validateScopes} from "./receipt-contract.mjs";
import {createOAuthProtection} from "./oauth-protection.mjs";
const redirect="https://uenyvsiturkihectolxp.supabase.co/functions/v1/taxi-sumup-oauth";
const device="mon-taxi-owner-android-v1";
const encoder=new TextEncoder();
const secureHeaders={"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...secureHeaders,"Content-Type":"application/json; charset=utf-8"}});
const page=(body,status=200)=>new Response(body,{status,headers:{...secureHeaders,"Content-Type":"text/plain; charset=utf-8","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'"}});
async function equal(a,b){
 if(typeof a!=="string"||a.length>180)return false;
 const [x,y]=await Promise.all([a,b].map(s=>crypto.subtle.digest("SHA-256",encoder.encode(s))));
 const u=new Uint8Array(x),v=new Uint8Array(y);let d=0;for(let i=0;i<u.length;i++)d|=u[i]^v[i];return d===0;
}
async function readBody(req){
 if(!req.body||!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))throw Error("request_invalid");
 const reader=req.body.getReader();let length=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>4096){await reader.cancel();throw Error("request_invalid");}chunks.push(value);}}finally{reader.releaseLock();}
 const raw=new Uint8Array(length);let at=0;for(const c of chunks){raw.set(c,at);at+=c.length;}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw));}catch{throw Error("request_invalid");}
}
const errors={request_invalid:400,state_invalid:400,receipt_mismatch:409,amount_invalid:409,merchant_mismatch:403,receipt_not_found:404,busy:429,sumup_rate_limit:429,sumup_forbidden:403,reauthorize:409,storage_unavailable:503,storage_conflict:503};
const known=e=>Object.hasOwn(errors,e?.message)?e.message:"unavailable";
export function createHandler({clientId,merchant,deviceToken,keyHex,transport,storeFactory,now=()=>Date.now()}){
 if(!/^[A-Za-z0-9_-]{43,128}$/.test(deviceToken)||!/^[a-f0-9]{64}$/.test(keyHex)||!/^[A-Za-z0-9_-]{1,80}$/.test(merchant)||!/^[A-Za-z0-9_-]{8,200}$/.test(clientId))throw Error("oauth_config");
 return async req=>{
  const url=new URL(req.url);
  if(!["/taxi-sumup-oauth","/functions/v1/taxi-sumup-oauth"].includes(url.pathname))return json({error:"not_found"},404);
  if(req.method!=="GET"&&req.method!=="POST")return json({error:"method"},405);
  if(req.method==="POST"&&!await equal(req.headers.get("authorization"),"Bearer "+deviceToken))return json({error:"unauthorized"},401);
  let store,protection;
  try{
   store=storeFactory({device,merchant});
   protection=createOAuthProtection({keyHex,store,now});
  }catch{
   return req.method==="GET"?page("Connexion non confirmée. Retournez dans Mon Taxi Pro.",503):json({error:"storage_unavailable"},503);
  }
  let response;
  try{
   if(req.method==="GET"){
    // Public browser callback only. No device credential or token in the URL.
    if(url.searchParams.getAll("state").length!==1)throw Error("state_invalid");
    const b=await protection.consume(url.searchParams.get("state"));
    if(b.device!==device||b.merchant!==merchant)throw Error("state_invalid");
    if(url.searchParams.has("error"))response=page("Autorisation SumUp refusée. Retournez dans Mon Taxi Pro.",400);
    else{
     if(url.searchParams.getAll("code").length!==1)throw Error("state_invalid");
     const t=await transport.exchangeCode(url.searchParams.get("code"));
     await transport.verifyMerchant(t.accessToken,merchant);
     await store.save(await protection.seal(device,merchant,{...t,expiresAt:now()+t.expiresIn*1000}));
     response=page("Connexion SumUp réussie. Vous pouvez fermer cette page et retourner dans Mon Taxi Pro.");
    }
   }else{
    const x=await readBody(req);
    if(x?.action==="start")response=json({authorizeUrl:buildAuthorize(clientId,redirect,await protection.start(device,merchant))});
    else if(x?.action==="status")response=json(await store.status());
    else if(x?.action==="receipt"){
     if(typeof x.reference!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(x.reference)||!Number.isSafeInteger(x.cents)||x.cents<1||x.cents>9999900)throw Error("request_invalid");
     const envelope=await store.claim(now());if(!envelope)throw Error("reauthorize");
     let tokens=await protection.open(device,merchant,envelope);
     validateScopes(tokens.scope);
     if(!Number.isFinite(tokens.expiresAt))throw Error("reauthorize");
     const renew=async()=>{
      // Never automatically retry an uncertain refresh. A timeout could have
      // rotated the old credential at SumUp. Persist first, then read the receipt.
      let next;try{next=await transport.refresh(tokens);}catch(e){await store.save(null);throw e?.message==="reauthorize"?e:Error("reauthorize");}
      tokens={...next,expiresAt:now()+next.expiresIn*1000};
      await store.save(await protection.seal(device,merchant,tokens));
     };
     let refreshed=false;if(tokens.expiresAt<=now()+60000){await renew();refreshed=true;}
     const read=()=>transport.getReceipt({accessToken:tokens.accessToken,merchant,reference:x.reference,cents:x.cents});
     let receipt;try{receipt=await read();}catch(e){if(e?.message!=="sumup_unauthorized")throw e;if(refreshed){await store.save(null);throw Error("reauthorize");}await renew();try{receipt=await read();}catch(e2){if(e2?.message==="sumup_unauthorized"){await store.save(null);throw Error("reauthorize");}throw e2;}}
     response=json({receipt});
    }else throw Error("request_invalid");
   }
  }catch(e){
   const code=known(e);response=req.method==="GET"?page("Connexion SumUp non confirmée. Retournez dans Mon Taxi Pro.",errors[code]??502):json({error:code},errors[code]??502);
  }
  try{await store.finish();}catch{return req.method==="GET"?page("Connexion non confirmée. Retournez dans Mon Taxi Pro.",503):json({error:"storage_unavailable"},503);}
  return response;
 };
}
