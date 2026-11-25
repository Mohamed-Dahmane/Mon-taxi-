import assert from "node:assert/strict";
import {createOAuthProtection} from "../supabase/functions/taxi-sumup-oauth/oauth-protection.mjs";
let time=100000;
const rows=new Map(),store={
 async insertState(row){if(rows.has(row.digest))throw Error("duplicate");rows.set(row.digest,row);},
 async consumeState(digest,at){const row=rows.get(digest);rows.delete(digest);return row&&row.expiresAt>at?row:null;}
};
const device="device_test_123456",merchant="merchant1",keyHex="ab".repeat(32);
const p=createOAuthProtection({keyHex,store,now:()=>time});
const state=await p.start(device,merchant);
assert.match(state,/^[a-f0-9]{64}$/);assert.equal(rows.has(state),false);
assert.deepEqual(await p.consume(state),{device,merchant});
await assert.rejects(p.consume(state),/state_invalid/);
await assert.rejects(p.consume("x"),/state_invalid/);
const expired=await p.start(device,merchant);time+=300001;await assert.rejects(p.consume(expired),/state_invalid/);
const concurrent=await p.start(device,merchant);const results=await Promise.allSettled([p.consume(concurrent),p.consume(concurrent)]);assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
const tokens={accessToken:"fake-access",refreshToken:"fake-refresh",scope:"transactions.history user.profile_readonly"};
const envelope=await p.seal(device,merchant,tokens);
assert.ok(!envelope.includes("fake"));assert.notEqual(envelope,await p.seal(device,merchant,tokens));
assert.deepEqual(await p.open(device,merchant,envelope),tokens);
await assert.rejects(p.open(device,"merchant2",envelope),/envelope_invalid/);
await assert.rejects(p.open("device_test_654321",merchant,envelope),/envelope_invalid/);
const corrupt=envelope.slice(0,-1)+(envelope.endsWith("a")?"b":"a");await assert.rejects(p.open(device,merchant,corrupt),/envelope_invalid/);
await assert.rejects(createOAuthProtection({keyHex:"cd".repeat(32),store}).open(device,merchant,envelope),/envelope_invalid/);
assert.throws(()=>createOAuthProtection({keyHex:"short",store}),/protection_config/);
await assert.rejects(p.start("x",merchant),/binding_invalid/);
console.log("OAuth one-time state, expiry, concurrency, encryption and binding tests passed (mock store).");
