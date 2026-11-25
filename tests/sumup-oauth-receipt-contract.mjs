import assert from "node:assert/strict";
import * as api from "../supabase/functions/taxi-sumup-oauth/receipt-contract.mjs";
function checks(api,assert){
 const {validateScopes,buildAuthorize,validateTokens,validateReceipt}=api,exact="transactions.history user.profile_readonly",state="A".repeat(43),redirect="https://uenyvsiturkihectolxp.supabase.co/functions/v1/taxi-sumup-oauth";
 assert.equal(validateScopes("user.profile_readonly transactions.history"),exact);
 assert.throws(()=>validateScopes(exact+" payments"));assert.throws(()=>validateScopes("transactions.history"));assert.throws(()=>validateScopes(undefined));
 const url=buildAuthorize("cc_classic_test_123",redirect,state);
 assert.equal(url.startsWith("https://api.sumup.com/authorize?"),true);assert.equal(url.includes("scope=transactions.history%20user.profile_readonly"),true);assert.equal(url.includes("state="+state),true);
 assert.throws(()=>buildAuthorize("cc_classic_test_123","https://bad.example",state));assert.throws(()=>buildAuthorize("cc_classic_test_123",redirect,"short"));
 const tokens={access_token:"test-access",refresh_token:"test-refresh",expires_in:3599,token_type:"Bearer",scope:exact};
 assert.equal(validateTokens(tokens).scope,exact);assert.throws(()=>validateTokens({...tokens,scope:"payments"}));assert.throws(()=>validateTokens({...tokens,scope:undefined}));assert.equal(validateTokens({...tokens,scope:undefined},exact).scope,exact);
 const tx={transaction_code:"T123",merchant_code:"M123",currency:"EUR",status:"SUCCESSFUL",amount:"65.00",timestamp:"2026-11-25T08:00:00Z",receipt_no:"1",card_last4:"1234"};
 const raw={transaction_data:tx,merchant_data:{merchant_profile:{business_name:"Taxi",vat_id:"VAT"}},acquirer_data:{authorization_code:"private"}};
 const r=validateReceipt(raw,"T123",6500,"M123");assert.equal(r.amountCents,6500);assert.equal(r.business,"Taxi");assert.equal(r.card_last4,undefined);assert.equal(r.acquirer_data,undefined);
 for(const change of [{transaction_code:"OTHER"},{merchant_code:"OTHER"},{currency:"USD"},{status:"FAILED"},{amount:"65.01"},{amount:"65.001"},{timestamp:"invalid"}])assert.throws(()=>validateReceipt({...raw,transaction_data:{...tx,...change}},"T123",6500,"M123"));
}
checks(api,assert);
console.log("OAuth receipt contract passed");
