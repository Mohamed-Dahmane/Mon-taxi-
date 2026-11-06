// Private SumUp sync. Invoke only with a valid server-side JWT; never from public V11.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const START = Date.parse("2026-10-31T23:00:00Z"); // 01/11 midnight Brussels
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", {status:405});
  // GitHub Actions may supply the existing secret over HTTPS after service-role authentication.
  // Never log or return this header.
  const key = Deno.env.get("SUMUP_API_KEY") || req.headers.get("x-sumup-api-key");
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return Response.json({ok:false,reason:"server_configuration_pending"},{status:503});
  // Even when verify_jwt is enabled, restrict writes to the service-role JWT.
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i,"") ?? "";
  if (!token) return Response.json({ok:false},{status:403});
  // A valid service-role JWT can differ from the injected legacy token.
  // Never trust decoded claims alone: PostgREST must verify its signature and access.
  if (token !== service) {
    let claims;
    try {
      const payload=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
      claims=JSON.parse(atob(payload+"=".repeat((4-payload.length%4)%4)));
    } catch { return Response.json({ok:false},{status:403}); }
    const projectRef=new URL(url).hostname.split(".")[0];
    if(claims.role!=="service_role" || claims.ref!==projectRef)
      return Response.json({ok:false},{status:403});
    // Bound credential verification and never forward privileged headers on redirects.
    let verification: Response;
    try {
      verification=await fetch(url+"/rest/v1/taxi_sumup_transactions?select=transaction_id&limit=0",{
        headers:{apikey:service,Authorization:"Bearer "+token},
        signal:AbortSignal.timeout(10000),redirect:"error"
      });
    } catch { return Response.json({ok:false},{status:403}); }
    if(!verification.ok) return Response.json({ok:false},{status:403});
    await verification.body?.cancel();
  }
  if (!key) return Response.json({ok:false,reason:"sumup_secret_missing"},{status:503});
  const db = createClient(url,service,{auth:{persistSession:false}});
  let count=0, cursor=0, reachedEnd=false;
  for(let page=0;page<20;page++){
    const endpoint=new URL("https://api.sumup.com/v0.1/me/transactions/history");
    endpoint.searchParams.set("limit","100");
    endpoint.searchParams.set("offset",String(cursor));
    endpoint.searchParams.set("oldest_time","2026-10-31T23:00:00Z");
    let response: Response;
    try {
      response=await fetch(endpoint,{headers:{Authorization:"Bearer "+key,Accept:"application/json"},signal:AbortSignal.timeout(20000),redirect:"error"});
    } catch {
      return Response.json({ok:false,reason:"sumup_network_error"},{status:502});
    }
    if(!response.ok) return Response.json({ok:false,reason:"sumup_http_"+response.status},{status:502});
    let data: unknown;
    try { data=await response.json(); }
    catch { return Response.json({ok:false,reason:"invalid_sumup_json"},{status:502}); }
    const entries=Array.isArray(data)?data:(data && typeof data==="object" ? (data.items??data.transactions) : undefined);
    // A 200 response containing an error object or an unknown shape is not an empty history.
    if(!Array.isArray(entries)) return Response.json({ok:false,reason:"unexpected_sumup_response"},{status:502});
    // The requested page size is 100; a larger page makes offset pagination unsafe.
    if(entries.length>100) return Response.json({ok:false,reason:"unexpected_sumup_page_size"},{status:502});
    const rows=[];
    for(const tx of entries){
      if(!tx || !tx.id || !tx.timestamp || tx.currency!=="EUR")continue;
      const t=Date.parse(tx.timestamp);
      if(!Number.isFinite(t)||t<START)continue;
      const cents=Math.round(Number(tx.amount)*100);
      if(!Number.isSafeInteger(cents)||cents<0)continue;
      const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(t));
      if(day<"2026-11-01")continue;
      rows.push({transaction_id:String(tx.id),transaction_time:new Date(t).toISOString(),local_day:day,amount_cents:cents,currency:"EUR",status:String(tx.status??"UNKNOWN"),updated_at:new Date().toISOString()});
    }
    if(rows.length){
      const {error}=await db.from("taxi_sumup_transactions").upsert(rows,{onConflict:"transaction_id"});
      if(error)return Response.json({ok:false,reason:"database_write_failed"},{status:500});
      count+=rows.length;
    }
    if(entries.length<100){reachedEnd=true;break;}
    cursor+=entries.length;
  }
  if(!reachedEnd) return Response.json({ok:false,reason:"pagination_limit_reached"},{status:503});
  return Response.json({ok:true,processed:count,window_start:"2026-11-01",note:"No transaction details returned"});
});
