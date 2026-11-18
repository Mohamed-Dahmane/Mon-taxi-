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
  // Fail closed before sending privileged credentials to a misconfigured origin.
  // Keep this aligned with the fixed project checked by the GitHub Actions workflow.
  let origin: URL;
  try {
    origin = new URL(url);
    if (origin.protocol !== "https:" || origin.hostname !== "uenyvsiturkihectolxp.supabase.co" ||
        origin.port || origin.username || origin.password || origin.pathname !== "/" ||
        origin.search || origin.hash) throw new Error("unexpected Supabase origin");
  } catch {
    return Response.json({ok:false,reason:"invalid_supabase_origin"},{status:503});
  }
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
  // Prevent privileged Supabase requests from forwarding service-role headers across redirects.
  const db = createClient(url,service,{auth:{persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,redirect:"error"})}});
  let count=0, cursor=0, reachedEnd=false;
  // Stage pages until pagination completes: never write an incomplete history window.
  const pendingRows: Array<Record<string, string | number>> = [];
  // Offset pagination can shift while new transactions arrive; reject repeated IDs before any write.
  const seenTransactionIds = new Set<string>();
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
    // A successful HTTP status does not make a non-JSON response trustworthy.
    // Reject HTML, text or an absent media type before buffering the body.
    const mediaType=response.headers.get("content-type")?.split(";",1)[0].trim().toLowerCase();
    if(mediaType!=="application/json")
      return Response.json({ok:false,reason:"invalid_sumup_content_type"},{status:502});
    // Bound each remote page before JSON parsing: a compromised or malfunctioning
    // upstream must not exhaust Edge Function memory with an oversized response.
    const MAX_PAGE_BYTES=1024*1024;
    let data: unknown;
    try {
      const declared=Number(response.headers.get("content-length"));
      if(Number.isFinite(declared) && declared>MAX_PAGE_BYTES)
        return Response.json({ok:false,reason:"sumup_page_too_large"},{status:502});
      const reader=response.body?.getReader();
      if(!reader) return Response.json({ok:false,reason:"invalid_sumup_json"},{status:502});
      const chunks: Uint8Array[]=[];
      let total=0;
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        total+=value.byteLength;
        if(total>MAX_PAGE_BYTES){
          await reader.cancel();
          return Response.json({ok:false,reason:"sumup_page_too_large"},{status:502});
        }
        chunks.push(value);
      }
      const bytes=new Uint8Array(total);
      let offset=0;
      for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
    } catch { return Response.json({ok:false,reason:"invalid_sumup_json"},{status:502}); }
    const entries=Array.isArray(data)?data:(data && typeof data==="object" ? (("items" in data ? data.items : undefined) ?? ("transactions" in data ? data.transactions : undefined)) : undefined);
    // A 200 response containing an error object or an unknown shape is not an empty history.
    if(!Array.isArray(entries)) return Response.json({ok:false,reason:"unexpected_sumup_response"},{status:502});
    // The requested page size is 100; a larger page makes offset pagination unsafe.
    if(entries.length>100) return Response.json({ok:false,reason:"unexpected_sumup_page_size"},{status:502});
    const rows=[];
    for(const tx of entries){
      // Do not silently lose a EUR payment when SumUp returns an incomplete record.
      if(!tx || typeof tx!=="object")
        return Response.json({ok:false,reason:"invalid_sumup_transaction"},{status:502});
      // Missing or malformed currency must not silently discard a possible EUR payment.
      if(typeof tx.currency!=="string" || !/^[A-Z]{3}$/.test(tx.currency))
        return Response.json({ok:false,reason:"invalid_sumup_currency"},{status:502});
      // Detect shifting offset pages across all currencies, not just EUR rows.
      // A repeated non-EUR ID also means the pagination snapshot may be incomplete.
      // Bound external identifiers before retaining them in memory or sending them to PostgREST.
      if(typeof tx.id!=="string" || !tx.id || tx.id.length>128)
        return Response.json({ok:false,reason:"invalid_sumup_transaction"},{status:502});
      if(seenTransactionIds.has(tx.id))
        return Response.json({ok:false,reason:"duplicate_sumup_transaction_in_pages"},{status:502});
      seenTransactionIds.add(tx.id);
      if(tx.currency!=="EUR")continue;
      // Never coerce an unexpected status object to "[object Object]".
      // Missing status stays UNKNOWN for later manual reconciliation.
      if(tx.status != null && (typeof tx.status !== "string" || !tx.status.trim() || tx.status.length>64))
        return Response.json({ok:false,reason:"invalid_sumup_status"},{status:502});
      if(typeof tx.timestamp!=="string" || tx.timestamp.length>64 ||
         !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(tx.timestamp) ||
         typeof tx.amount!=="number" || !Number.isFinite(tx.amount))
        return Response.json({ok:false,reason:"invalid_sumup_transaction"},{status:502});
      // Date.parse can normalize impossible dates (for example February 30).
      // Validate the calendar and offset explicitly before assigning a Brussels accounting day.
      const parts=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(tx.timestamp);
      if(!parts) return Response.json({ok:false,reason:"invalid_sumup_timestamp"},{status:502});
      const [,yearText,monthText,dayText,hourText,minuteText,secondText,, ,offsetHourText,offsetMinuteText]=parts;
      const parsedYear=Number(yearText),parsedMonth=Number(monthText),dayNumber=Number(dayText);
      const hour=Number(hourText),minute=Number(minuteText),second=Number(secondText);
      const offsetHour=offsetHourText===undefined?0:Number(offsetHourText);
      const offsetMinute=offsetMinuteText===undefined?0:Number(offsetMinuteText);
      const calendar=new Date(0);
      calendar.setUTCFullYear(parsedYear,parsedMonth-1,dayNumber);
      calendar.setUTCHours(hour,minute,second,0);
      if(calendar.getUTCFullYear()!==parsedYear || calendar.getUTCMonth()!==parsedMonth-1 ||
         calendar.getUTCDate()!==dayNumber || calendar.getUTCHours()!==hour ||
         calendar.getUTCMinutes()!==minute || calendar.getUTCSeconds()!==second ||
         offsetHour>14 || offsetMinute>59 || (offsetHour===14 && offsetMinute!==0))
        return Response.json({ok:false,reason:"invalid_sumup_timestamp"},{status:502});
      const t=Date.parse(tx.timestamp);
      if(!Number.isFinite(t))
        return Response.json({ok:false,reason:"invalid_sumup_timestamp"},{status:502});
      if(t<START)continue;
      // EUR is a two-decimal currency. Reject fractional cents instead of
      // silently rounding a malformed amount into a different payment value.
      const rawCents=tx.amount*100;
      const cents=Math.round(rawCents);
      if(!Number.isSafeInteger(cents)||cents<0 ||
         Math.abs(rawCents-cents)>1e-7)
        return Response.json({ok:false,reason:"invalid_sumup_amount"},{status:502});
      const dateParts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(t));
      const dateField=(type: string)=>dateParts.find(part=>part.type===type)?.value;
      const year=dateField("year"), month=dateField("month"), dayOfMonth=dateField("day");
      if(!year || !month || !dayOfMonth) return Response.json({ok:false,reason:"invalid_local_date"},{status:502});
      const day=`${year}-${month}-${dayOfMonth}`;
      if(day<"2026-11-01")continue;
      rows.push({transaction_id:String(tx.id),transaction_time:new Date(t).toISOString(),local_day:day,amount_cents:cents,currency:"EUR",status:String(tx.status??"UNKNOWN"),updated_at:new Date().toISOString()});
    }
    pendingRows.push(...rows);
    if(entries.length<100){reachedEnd=true;break;}
    cursor+=entries.length;
  }
  if(!reachedEnd) return Response.json({ok:false,reason:"pagination_limit_reached"},{status:503});
  // One PostgREST upsert is one PostgreSQL statement: all rows commit or none do.
  // Never split into independently committed batches, even for large histories.
  if(pendingRows.length){
    const {error}=await db.from("taxi_sumup_transactions").upsert(pendingRows,{onConflict:"transaction_id"});
    if(error)return Response.json({ok:false,reason:"database_write_failed"},{status:500});
  }
  count=pendingRows.length;
  return Response.json({ok:true,processed:count,window_start:"2026-11-01",note:"No transaction details returned"});
});
