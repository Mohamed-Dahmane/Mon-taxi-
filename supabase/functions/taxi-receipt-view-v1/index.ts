Deno.serve(async (req: Request) => {
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
 const missing=()=>new Response("Reçu indisponible",{status:404,headers});
 if(req.method!=="GET")return new Response(null,{status:405,headers:{...headers,Allow:"GET"}});
 const id=new URL(req.url).searchParams.get("id")||"";
 if(!/^[a-f0-9]{64}$/.test(id))return missing();
 const base=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!base||!key)return new Response(null,{status:503,headers});
 try{
 const result=await fetch(base+"/storage/v1/object/authenticated/mon-taxi-receipts-private/"+id+".png",{headers:{Authorization:"Bearer "+key,apikey:key}});
 if(!result.ok||!result.body)return missing();
 return new Response(result.body,{headers:{...headers,"Content-Type":"image/png","Content-Disposition":"inline"}});
 }catch{return new Response(null,{status:503,headers});}
});