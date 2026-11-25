import {createHandler} from "./oauth-handler.mjs";
import {createStore} from "./oauth-store.mjs";
import {createSumUpTransport} from "./sumup-transport.mjs";
const env=(k:string)=>Deno.env.get(k)??"";
Deno.serve(async (req:Request)=>{
 try{
  const clientId=env("SUMUP_OAUTH_CLIENT_ID"),clientSecret=env("SUMUP_OAUTH_CLIENT_SECRET");
  const merchant=env("TAXI_RECEIPT_MERCHANT")||env("TAXI_REFUND_MERCHANT");
  const deviceToken=env("TAXI_RECEIPT_DEVICE_TOKEN"),keyHex=env("TAXI_RECEIPT_ENCRYPTION_KEY");
  const url=env("SUPABASE_URL"),serviceKey=env("SUPABASE_SERVICE_ROLE_KEY");
  if(!clientSecret||!url||!serviceKey||deviceToken===env("TAXI_REFUND_DEVICE_TOKEN"))throw Error("not configured");
  const transport=createSumUpTransport({clientId,clientSecret});
  const handler=createHandler({clientId,merchant,deviceToken,keyHex,transport,storeFactory:({device,merchant}:{device:string,merchant:string})=>createStore({url,serviceKey,device,merchant})});
  return await handler(req);
 }catch{return new Response(JSON.stringify({error:"not_configured"}),{status:503,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});}
});
