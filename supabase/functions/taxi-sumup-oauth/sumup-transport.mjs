import {validateTokens,validateReceipt,validateScopes} from "./receipt-contract.mjs";
const origin="https://api.sumup.com";
const redirect="https://uenyvsiturkihectolxp.supabase.co/functions/v1/taxi-sumup-oauth";
const valid=(v,max=8192)=>typeof v==="string"&&v.length>0&&v.length<=max&&!/[\s\x00-\x1f\x7f]/.test(v);
const segment=(v,max)=>typeof v==="string"&&v.length<=max&&/^[A-Za-z0-9_-]+$/.test(v);
export function createSumUpTransport({clientId,clientSecret,fetchImpl=globalThis.fetch}){
 if(!segment(clientId,200)||!valid(clientSecret)||typeof fetchImpl!=="function")throw Error("oauth_config");
 async function request(path,options,tokenEndpoint=false){
  let res;
  try{res=await fetchImpl(origin+path,{...options,redirect:"error",signal:AbortSignal.timeout(12000)});}catch{throw Error("sumup_network");}
  if(!res.ok){
   if(tokenEndpoint&&res.status===400){let body;try{body=await res.json();}catch{}if(body?.error==="invalid_grant")throw Error("reauthorize");}
   if(res.status===401)throw Error("sumup_unauthorized");
   if(res.status===403)throw Error("sumup_forbidden");
   if(res.status===404)throw Error("receipt_not_found");
   if(res.status===429)throw Error("sumup_rate_limit");
   throw Error("sumup_http");
  }
  try{return await res.json();}catch{throw Error("sumup_invalid_json");}
 }
 const token=async fields=>request("/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},body:new URLSearchParams({...fields,client_id:clientId,client_secret:clientSecret}).toString()},true);
 return Object.freeze({
  async exchangeCode(code){
   if(!valid(code))throw Error("code_invalid");
   return validateTokens(await token({grant_type:"authorization_code",code,redirect_uri:redirect}));
  },
  async refresh(previous){
   if(!valid(previous?.refreshToken))throw Error("reauthorize");
   const scope=validateScopes(previous.scope);
   return validateTokens(await token({grant_type:"refresh_token",refresh_token:previous.refreshToken}),scope,previous.refreshToken);
  },
  async verifyMerchant(accessToken,merchant){
   if(!valid(accessToken)||!segment(merchant,80))throw Error("request_invalid");
   const result=await request("/v1/merchants/"+encodeURIComponent(merchant),{method:"GET",headers:{Authorization:"Bearer "+accessToken,Accept:"application/json"}});
   if(!result||result.merchant_code!==merchant)throw Error("merchant_mismatch");
   return true;
  },
  async recent({accessToken,merchant}){
   if(!valid(accessToken)||!segment(merchant,80))throw Error("request_invalid");
   const page=await request("/v2.1/merchants/"+encodeURIComponent(merchant)+"/transactions/history?limit=50&order=descending",{method:"GET",headers:{Authorization:"Bearer "+accessToken,Accept:"application/json"}});
   if(!Array.isArray(page.items))throw Error("sumup_invalid_json");
   return page.items.filter(t=>t.merchant_code===merchant&&t.type==="PAYMENT"&&t.status==="SUCCESSFUL"&&t.currency==="EUR"&&t.refunded_amount===0&&segment(t.transaction_code,128)&&Number.isFinite(Date.parse(t.timestamp))&&typeof t.amount==="number"&&t.amount>0&&t.amount<=99999).map(t=>({reference:t.transaction_code,amountCents:Math.round(t.amount*100),timestamp:t.timestamp}));
  },
  async getReceipt({accessToken,merchant,reference,cents}){
   if(!valid(accessToken)||!segment(merchant,80)||!segment(reference,128)||!Number.isSafeInteger(cents)||cents<1||cents>9999900)throw Error("request_invalid");
   // Single transaction route explicitly supports transactions.history; use it first.
   const tx=await request("/v2.1/merchants/"+encodeURIComponent(merchant)+"/transactions?transaction_code="+encodeURIComponent(reference),{method:"GET",headers:{Authorization:"Bearer "+accessToken,Accept:"application/json"}});
   if(!tx||typeof tx.amount!=="number"||!Number.isFinite(tx.amount))throw Error("amount_invalid");
   // Preserve strict cent and merchant checks; do not round a mismatched amount.
   return validateReceipt({transaction_data:{transaction_code:tx.transaction_code,merchant_code:tx.merchant_code,amount:String(tx.amount),currency:tx.currency,status:tx.status,timestamp:tx.timestamp}},reference,cents,merchant);
  }
 });
}
// Internal server transport only: caller MUST authenticate the device, consume one-time OAuth state,
// select and bind an authorized merchant, and persist refreshed credentials atomically before use.
// Never call this module from the APK or expose returned tokens to clients.
