export function validateScopes(scope){
 if(typeof scope!=="string")throw Error("scope_missing");
 const got=[...new Set(scope.trim().split(/\s+/))].sort(),expected=["transactions.history","user.profile_readonly"];
 if(got.length!==expected.length||got.some((x,i)=>x!==expected[i]))throw Error("scope_mismatch");
 return expected.join(" ");
}

export function buildAuthorize(clientId,redirectUri,state){
 if(typeof clientId!=="string"||!/^cc_[A-Za-z0-9_-]{8,200}$/.test(clientId))throw Error("client_id");
 if(redirectUri!=="https://uenyvsiturkihectolxp.supabase.co/functions/v1/taxi-sumup-oauth")throw Error("redirect");
 if(typeof state!=="string"||!/^[A-Za-z0-9_-]{43,128}$/.test(state))throw Error("state");
 const q={response_type:"code",client_id:clientId,redirect_uri:redirectUri,scope:"transactions.history user.profile_readonly",state};
 return "https://api.sumup.com/authorize?"+Object.entries(q).map(([k,v])=>encodeURIComponent(k)+"="+encodeURIComponent(v)).join("&");
}

export function validateTokens(raw,previousScope){
 const opaque=x=>typeof x==="string"&&x.length>0&&x.length<=8192&&!/[\s\x00-\x1f\x7f]/.test(x);
 if(!raw||!opaque(raw.access_token)||!opaque(raw.refresh_token)||String(raw.token_type).toLowerCase()!=="bearer"||!Number.isSafeInteger(raw.expires_in)||raw.expires_in<=0||raw.expires_in>86400*7)throw Error("token_invalid");
 return {accessToken:raw.access_token,refreshToken:raw.refresh_token,expiresIn:raw.expires_in,scope:validateScopes(raw.scope??previousScope)};
}

export function validateReceipt(raw,reference,cents,merchant){
 if(typeof reference!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(reference)||!Number.isSafeInteger(cents)||cents<1||cents>9999900||typeof merchant!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(merchant))throw Error("request_invalid");
 const tx=raw?.transaction_data,amount=tx?.amount;
 if(typeof amount!=="string"||!/^\d{1,8}(?:\.\d{1,2})?$/.test(amount))throw Error("amount_invalid");
 const [major,minor=""]=amount.split(".");
 if(tx.transaction_code!==reference||tx.merchant_code!==merchant||tx.currency!=="EUR"||tx.status!=="SUCCESSFUL"||Number(major)*100+Number(minor.padEnd(2,"0"))!==cents||typeof tx.timestamp!=="string"||!Number.isFinite(Date.parse(tx.timestamp)))throw Error("receipt_mismatch");
 const clean=x=>typeof x==="string"?x.replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,160):"";
 const mp=raw?.merchant_data?.merchant_profile;
 return {reference,amountCents:cents,currency:"EUR",timestamp:tx.timestamp,business:clean(mp?.business_name),vat:clean(mp?.vat_id),number:clean(tx.receipt_no)};
}
