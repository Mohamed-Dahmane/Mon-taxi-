import assert from "node:assert/strict";
import {createHandler} from "../supabase/functions/taxi-sumup-oauth/oauth-handler.mjs";
import {createStore} from "../supabase/functions/taxi-sumup-oauth/oauth-store.mjs";
import {createSumUpTransport} from "../supabase/functions/taxi-sumup-oauth/sumup-transport.mjs";
const start=Date.now();let clock=start;Date.now=()=>clock;
const iso=t=>new Date(t).toISOString();
const row={id:1,state_hash:null,state_expires_at:null,token_envelope:null,op_id:null,op_started_at:null,start_after:iso(0),read_after:iso(0)};
const url="https://uenyvsiturkihectolxp.supabase.co",endpoint=url+"/functions/v1/taxi-sumup-oauth",merchant="M1",deviceToken="D".repeat(64),keyHex="ab".repeat(32),scope="transactions.history user.profile_readonly";
let calls=[],failSave=false,failRefresh=false,wrongMerchant=false;
const fetchImpl=async (u,o={})=>{
 const U=new URL(u);calls.push({url:u,method:o.method});
 if(U.origin===url){
  assert.equal(o.headers.Authorization,"Bearer mock-service-only");
  for(const [k,filter] of U.searchParams){
   const i=filter.indexOf("."),op=filter.slice(0,i),v=filter.slice(i+1),actual=row[k];
   if(op==="is"&&!(v==="null"&&actual===null))return Response.json([]);
   if(op==="eq"&&String(actual)!==v)return Response.json([]);
   if(op==="gt"&&!(actual!==null&&actual>v))return Response.json([]);
   if(op==="lt"&&!(actual!==null&&actual<v))return Response.json([]);
   if(op==="lte"&&!(actual!==null&&actual<=v))return Response.json([]);
  }
  if(o.method==="PATCH"){
   const data=JSON.parse(o.body);
   if(failSave&&Object.hasOwn(data,"token_envelope"))return new Response("",{status:503});
   Object.assign(row,data);
  }
  return Response.json([{...row}]);
 }
 assert.equal(U.origin,"https://api.sumup.com");
 if(U.pathname==="/token"){
  const grant=new URLSearchParams(o.body).get("grant_type");
  if(grant==="refresh_token"&&failRefresh)return Response.json({error:"invalid_grant"},{status:400});
  return Response.json({access_token:grant==="refresh_token"?"fresh-access":"initial-access",refresh_token:grant==="refresh_token"?"fresh-refresh":"initial-refresh",token_type:"Bearer",expires_in:3600,scope});
 }
 if(U.pathname==="/v1/merchants/M1")return Response.json({merchant_code:wrongMerchant?"OTHER":merchant});
 assert.equal(U.pathname,"/v2.1/merchants/M1/transactions");
 assert.equal(o.method,"GET");
 return Response.json({transaction_code:U.searchParams.get("transaction_code"),merchant_code:merchant,amount:65,currency:"EUR",status:"SUCCESSFUL",timestamp:iso(start),auth_code:"never-return"});
};
const transport=createSumUpTransport({clientId:"test-client",clientSecret:"test-secret",fetchImpl});
const handler=createHandler({clientId:"test-client",merchant,deviceToken,keyHex,transport,storeFactory:({device,merchant})=>createStore({url,serviceKey:"mock-service-only",device,merchant,fetchImpl}),now:()=>clock});
const post=(body,token=deviceToken)=>handler(new Request(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(body)}));
const cb=(state,code="valid-code")=>handler(new Request(endpoint+"?state="+state+"&code="+code));
const stateFrom=async()=>{const r=await post({action:"start"});assert.equal(r.status,200);return new URL((await r.json()).authorizeUrl).searchParams.get("state");};
assert.equal((await post({action:"status"},"wrong")).status,401);assert.equal(calls.length,0);
assert.equal((await cb("a".repeat(64))).status,400);assert.ok(!calls.some(x=>x.url==="https://api.sumup.com/token"));
const state=await stateFrom();assert.notEqual(row.state_hash,state);
assert.equal((await cb(state)).status,200);
assert.ok(row.token_envelope.startsWith("v1."));assert.ok(!row.token_envelope.includes("initial-access"));assert.equal(row.op_id,null);
assert.equal((await cb(state)).status,400);
assert.deepEqual(await (await post({action:"status"})).json(),{connected:true,busy:false});
const query={action:"receipt",reference:"T1",cents:6500};
const result=await post(query);assert.equal(result.status,200);const body=await result.json();assert.equal(body.receipt.amountCents,6500);assert.equal(body.receipt.auth_code,undefined);assert.ok(!JSON.stringify(body).includes("initial-access"));
assert.equal((await post(query)).status,429);clock+=1100;
assert.equal((await post({...query,cents:6499})).status,409);clock+=3600000;
assert.equal((await post(query)).status,200);assert.ok(calls.some(x=>x.url==="https://api.sumup.com/token"));
clock+=3600000;failSave=true;assert.equal((await post(query)).status,503);assert.ok(row.op_id);
failSave=false;assert.equal((await post(query)).status,429);clock+=181000;
const recover=await stateFrom();assert.equal(row.token_envelope,null);assert.equal((await cb(recover)).status,200);
clock+=3600000;failRefresh=true;assert.equal((await post(query)).status,409);assert.equal(row.token_envelope,null);assert.equal(row.op_id,null);
clock+=6000;wrongMerchant=true;const invalid=await stateFrom();assert.equal((await cb(invalid)).status,403);assert.equal(row.token_envelope,null);
const unavailableHandler=createHandler({clientId:"test-client",merchant,deviceToken,keyHex,transport,storeFactory:()=>{throw Error("storage_config");},now:()=>clock});
const unavailablePost=await unavailableHandler(new Request(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+deviceToken},body:JSON.stringify({action:"status"})}));
assert.equal(unavailablePost.status,503);
assert.deepEqual(await unavailablePost.json(),{error:"storage_unavailable"});
const unavailableCallback=await unavailableHandler(new Request(endpoint+"?state="+("a".repeat(64))));
assert.equal(unavailableCallback.status,503);
assert.ok((await unavailableCallback.text()).includes("Connexion non confirmée"));
console.log("Integrated simulated OAuth callback, replay rejection, merchant binding, encrypted storage, receipt, refresh and fenced crash recovery passed.");
