import {createHandler} from "./oauth-handler.mjs";
import {createStore} from "./oauth-store.mjs";
import {createSumUpTransport} from "./sumup-transport.mjs";
const env=(k:string)=>Deno.env.get(k)??"";
Deno.serve(async (req:Request)=>{
 let phase="activation";
 try{
  // Explicit rollout gate; keep closed until dedicated secrets and checks are ready.
  if(env("TAXI_RECEIPT_OAUTH_ENABLED")!=="true")throw Error("not enabled");
  const clientId=env("SUMUP_OAUTH_CLIENT_ID"),clientSecret=env("TAXI_RECEIPT_OAUTH_CLIENT_SECRET");
  const merchant=env("TAXI_RECEIPT_MERCHANT")||env("TAXI_REFUND_MERCHANT");
  const deviceToken=env("TAXI_RECEIPT_DEVICE_TOKEN"),keyHex=env("TAXI_RECEIPT_ENCRYPTION_KEY");
  const url=env("SUPABASE_URL"),serviceKey=env("SUPABASE_SERVICE_ROLE_KEY");
  phase="oauth_client_secret_missing"; if(!clientSecret)throw Error("not configured");
  phase="oauth_client_secret_length"; if(clientSecret.length>8192)throw Error("not configured");
  phase="oauth_client_secret_whitespace"; if(/[\s\x00-\x1f\x7f]/.test(clientSecret))throw Error("not configured");
  phase="oauth_client_id"; if(!/^[A-Za-z0-9_-]{8,200}$/.test(clientId))throw Error("not configured");
  phase="merchant"; if(!/^[A-Za-z0-9_-]{1,80}$/.test(merchant))throw Error("not configured");
  phase="device_token"; if(!/^[A-Za-z0-9_-]{43,128}$/.test(deviceToken)||deviceToken===env("TAXI_REFUND_DEVICE_TOKEN"))throw Error("not configured");
  phase="encryption_key"; if(!/^[a-f0-9]{64}$/.test(keyHex))throw Error("not configured");
  phase="supabase_environment"; if(!url||!serviceKey)throw Error("not configured");
  phase="transport_init";
  const transport=createSumUpTransport({clientId,clientSecret});
  phase="handler_init";
  const handler=createHandler({clientId,merchant,deviceToken,keyHex,transport,storeFactory:({device,merchant}:{device:string,merchant:string})=>createStore({url,serviceKey,device,merchant})});
  phase="handler_runtime";
  return await handler(req);
 }catch{console.warn("[taxi-sumup-oauth] configuration_failure stage="+phase);return new Response(JSON.stringify({error:"not_configured"}),{status:503,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});}
});
