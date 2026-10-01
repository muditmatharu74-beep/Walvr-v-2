const test=require('node:test'),assert=require('node:assert/strict');
const p=require('../experiments/relatability/protocol.js');
test('six study orders are balanced and repeat without exposing treatment names to viewers',()=>{
 const orders=Array.from({length:6},(_,i)=>p.orderFor(i+1));assert.equal(new Set(orders.map(x=>x.join())).size,6);
 for(let position=0;position<3;position++)for(const v of p.variants)assert.equal(orders.filter(o=>o[position]===v).length,2);
 assert.deepEqual(p.orderFor(7),p.orderFor(1));for(const n of [0,-1,1.5,NaN])assert.throws(()=>p.orderFor(n));
});
test('study refuses mismatched duration, dimensions, or missing exports',()=>{
 const valid={duration:20,width:1080,height:1920};assert.equal(p.validateMedia([valid,valid,valid]),true);
 for(const bad of [{...valid,duration:18},{...valid,width:1920,height:1080},{...valid,duration:Infinity}])assert.throws(()=>p.validateMedia([valid,valid,bad]));
 assert.throws(()=>p.validateMedia([valid]));
});
test('response CSV preserves text and neutralizes spreadsheet formulas',()=>{
 const csv=p.csv([{participant:1,association:'=HYPERLINK("https://example.test")',variant:'everyday'}]);
 assert.ok(csv.includes('"\'=HYPERLINK(""https://example.test"")"'));
 assert.ok(p.csv([{association:'a,"b"\nc'}]).includes('"a,""b""\nc"'));
});
