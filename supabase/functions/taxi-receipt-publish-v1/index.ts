Deno.serve(async(req:Request)=>{
 const headers={"Cache-Control":"no-store","Content-Type":"application/json"};
 const reply=(status:number,code:string)=>new Response(JSON.stringify({code}),{status,headers});
 if(req.method!=="POST")return reply(405,"method");
 const secret=Deno.env.get("TAXI_RECEIPT_PUBLISH_TOKEN")||"";
 if(!/^[a-f0-9]{64}$/.test(secret))return reply(503,"not_configured");
 const supplied=req.headers.get("Authorization")||"";
 const expected="Bearer "+secret;
 let diff=supplied.length^expected.length;
 for(let i=0;i<expected.length;i++)diff|=(supplied.charCodeAt(i)||0)^expected.charCodeAt(i);
 if(diff!==0)return reply(401,"unauthorized");
 const id=new URL(req.url).searchParams.get("id")||"";
 if(!/^[a-f0-9]{64}$/.test(id))return reply(400,"id");
 if(req.headers.get("Content-Type")!=="image/png")return reply(415,"type");
 const reader=req.body?.getReader();if(!reader)return reply(400,"body");
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>6000000){await reader.cancel();return reply(413,"size");}chunks.push(value);}}catch{return reply(400,"body");}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 if(size<33||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)||String.fromCharCode(...bytes.slice(12,16))!=="IHDR")return reply(415,"png");
 const view=new DataView(bytes.buffer);if(view.getUint32(8)!==13||view.getUint32(16)<1||view.getUint32(16)>2000||view.getUint32(20)<1||view.getUint32(20)>5000)return reply(400,"dimensions");
 const base=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!base||!key)return reply(503,"storage");
 const path="/mon-taxi-receipts-private/"+id+".png",auth={Authorization:"Bearer "+key,apikey:key};
 try{
 const result=await fetch(base+"/storage/v1/object"+path,{method:"POST",headers:{...auth,"Content-Type":"image/png","x-upsert":"false"},body:bytes});
 if(result.ok)return reply(201,"published");
 const existing=await fetch(base+"/storage/v1/object/authenticated"+path,{headers:auth});
 if(existing.ok){const old=new Uint8Array(await existing.arrayBuffer());if(old.length===bytes.length&&old.every((v,i)=>v===bytes[i]))return reply(200,"already_published");return reply(409,"immutable");}
 return reply(503,"storage");
 }catch{return reply(503,"storage");}
});