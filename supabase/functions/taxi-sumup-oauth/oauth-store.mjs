// Dedicated singleton for a private, one-owner Android installation.
// All writes use conditional PostgREST PATCH with representation. An operation
// ID fences stale workers; no in-memory mutex or lock across HTTP calls.
const iso=ms=>new Date(ms).toISOString();
export function createStore({url,serviceKey,device,merchant,fetchImpl=globalThis.fetch}){
 if(url!=="https://uenyvsiturkihectolxp.supabase.co"||!serviceKey)throw Error("storage_config");
 const endpoint=url+"/rest/v1/taxi_receipt_oauth_v1";
 const op=crypto.randomUUID();
 async function request(method,filters={},data){
  const q=new URLSearchParams({id:"eq.1",...filters});
  let res;try{res=await fetchImpl(endpoint+"?"+q,{method,headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,Accept:"application/json","Content-Type":"application/json",Prefer:"return=representation"},body:data===undefined?undefined:JSON.stringify(data),redirect:"error",signal:AbortSignal.timeout(8000)});}catch{throw Error("storage_unavailable");}
  if(!res.ok)throw Error("storage_unavailable");
  const rows=await res.json();if(!Array.isArray(rows)||rows.length>1)throw Error("storage_invalid");
  return rows[0]??null;
 }
 const read=()=>request("GET");
 const patch=(filters,data)=>request("PATCH",filters,data);
 let claimed=false;
 return Object.freeze({
  async insertState(row){
   if(row.device!==device||row.merchant!==merchant)throw Error("binding_invalid");
   const at=Date.now(),data={state_hash:row.digest,state_expires_at:iso(row.expiresAt),start_after:iso(at+5000)};
   let result=await patch({op_id:"is.null",start_after:"lte."+iso(at)},data);
   if(!result){
    // Only an authenticated new authorization may recover a crashed worker.
    // Discard the old token, never retry an uncertain rotated refresh token.
    result=await patch({op_started_at:"lt."+iso(at-180000),start_after:"lte."+iso(at)},{...data,op_id:null,op_started_at:null,token_envelope:null});
   }
   if(!result)throw Error("busy");
  },
  async consumeState(digest,at){
   const r=await patch({op_id:"is.null",state_hash:"eq."+digest,state_expires_at:"gt."+iso(at)},{state_hash:null,op_id:op,op_started_at:iso(at)});
   if(!r)return null;claimed=true;
   return {device,merchant,expiresAt:Date.parse(r.state_expires_at)};
  },
  async claim(at){
   const r=await patch({op_id:"is.null",read_after:"lte."+iso(at)},{op_id:op,op_started_at:iso(at),read_after:iso(at+1000)});
   if(!r)throw Error("busy");claimed=true;return r.token_envelope;
  },
  async save(envelope){
   if(!claimed||!await patch({op_id:"eq."+op},{token_envelope:envelope}))throw Error("storage_conflict");
  },
  async finish(){
   if(claimed){if(!await patch({op_id:"eq."+op},{op_id:null,op_started_at:null}))throw Error("storage_conflict");claimed=false;}
  },
  async status(){
   const r=await read();if(!r)throw Error("storage_unavailable");
   return {connected:!!r.token_envelope,busy:!!r.op_id};
  }
 });
}
