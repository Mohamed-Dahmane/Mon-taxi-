// Server-side primitives. No credentials or tokens may be returned to Android.
const encoder=new TextEncoder(),decoder=new TextDecoder("utf-8",{fatal:true});
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
const unhex=s=>{if(typeof s!=="string"||s.length%2||!/^[a-f0-9]+$/.test(s))throw Error("invalid_encoding");return Uint8Array.from(s.match(/../g),x=>parseInt(x,16));};
const idOk=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{16,128}$/.test(s);
const merchantOk=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(s);
const stateOk=s=>typeof s==="string"&&/^[a-f0-9]{64}$/.test(s);
const sha=async s=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(s))));
export function createOAuthProtection({keyHex,store,now=()=>Date.now()}){
 if(!stateOk(keyHex)||!store||typeof store.insertState!=="function"||typeof store.consumeState!=="function")throw Error("protection_config");
 const key=crypto.subtle.importKey("raw",unhex(keyHex),"AES-GCM",false,["encrypt","decrypt"]);
 const aad=(device,merchant)=>{if(!idOk(device)||!merchantOk(merchant))throw Error("binding_invalid");return encoder.encode("mon-taxi:oauth:v1:"+device+":"+merchant);};
 return Object.freeze({
  async start(device,merchant){
   if(!idOk(device)||!merchantOk(merchant))throw Error("binding_invalid");
   const state=hex(crypto.getRandomValues(new Uint8Array(32)));
   await store.insertState({digest:await sha(state),device,merchant,expiresAt:now()+300000});
   return state;
  },
  async consume(state){
   if(!stateOk(state))throw Error("state_invalid");
   // The durable store MUST atomically delete-and-return the matching unexpired record.
   // Do not implement as separate SELECT/DELETE or trust a device supplied by the callback.
   const at=now(),row=await store.consumeState(await sha(state),at);
   if(!row||!idOk(row.device)||!merchantOk(row.merchant)||!Number.isFinite(row.expiresAt)||row.expiresAt<=at)throw Error("state_invalid");
   return {device:row.device,merchant:row.merchant};
  },
  async seal(device,merchant,tokens){
   const binding=aad(device,merchant);
   if(!tokens||typeof tokens!=="object")throw Error("token_invalid");
   const raw=encoder.encode(JSON.stringify(tokens));if(raw.length>32768)throw Error("token_invalid");
   const nonce=crypto.getRandomValues(new Uint8Array(12));
   const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv:nonce,additionalData:binding,tagLength:128},await key,raw);
   return "v1."+hex(nonce)+"."+hex(new Uint8Array(encrypted));
  },
  async open(device,merchant,envelope){
   const binding=aad(device,merchant);
   if(typeof envelope!=="string"||envelope.length>66000||!/^v1\.[a-f0-9]{24}\.[a-f0-9]{34,65568}$/.test(envelope))throw Error("envelope_invalid");
   const [,iv,body]=envelope.split(".");
   try{return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:unhex(iv),additionalData:binding,tagLength:128},await key,unhex(body))));}catch{throw Error("envelope_invalid");}
  }
 });
}
