import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorld,evaluate,eligible,decide,trial,oracle,TYPES} from '../src/logic.mjs';
test('three incidents have order-level ETA',()=>{for(const kind of ['machine','material','quality'])assert.equal(evaluate(makeWorld(kind)).rows.length,2)});
test('lateness only at shipment gate',()=>{const o=evaluate(makeWorld('machine'));assert.ok(Math.abs(o.lateMinutes-o.rows.reduce((n,x)=>n+Math.max(0,x.eta-x.due),0))<1e-5)});
test('unapproved backup is disallowed',()=>{const w=makeWorld('machine',{backupApproved:false});assert.equal(eligible(w,'reroute').ok,false)});
test('insufficient capacity is disallowed',()=>{assert.equal(eligible(makeWorld('machine',{backupCapacity:100}),'reroute').ok,false)});
test('QA unapproved fast clearance is disallowed',()=>{assert.equal(eligible(makeWorld('quality',{qaExpediteApproved:false}),'reinspect').ok,false)});
test('stale feed requests verification',()=>{const x=decide(makeWorld('material',{dataFresh:false}));assert.equal(x.status,'VERIFY');assert.equal(x.chosen,'none')});
test('delay past decision cutoff escalates',()=>{assert.equal(decide(makeWorld('machine',{feedLag:75})).status,'ESCALATE')});
test('information-neutral case must tie',()=>{const t=trial(makeWorld('machine',{due:[400,410]}));assert.equal(t.manual.loss,t.integrated.loss)});
test('manual may beat delayed feed',()=>{const t=trial(makeWorld('machine',{manualLookup:0,feedLag:40,due:[115,145]}));assert.ok(t.manual.loss<=t.integrated.loss)});
test('same information time should tie',()=>{const t=trial(makeWorld('machine',{manualLookup:7,feedLag:7}));assert.equal(t.manual.loss,t.integrated.loss)});
test('oracle score cannot be worse than any feasible immediate action',()=>{for(const k of ['machine','material','quality']){const w=makeWorld(k);for(const a of TYPES[k].actions){const r=evaluate(w,a,0);if(r.feasible)assert.ok(oracle(w).loss<=r.loss)}}});


test('stock delay changes the actual material-ready gate',()=>{const a=evaluate(makeWorld('material',{stock:60,refillAt:95}),'none');const b=evaluate(makeWorld('material',{stock:60,refillAt:30}),'none');assert.ok(a.rows[0].eta>b.rows[0].eta)});
test('valid QA reinspection never releases before the authorized alternate gate',()=>{const w=makeWorld('quality');const x=evaluate(w,'reinspect',10);assert.ok(x.rows[0].qaStart>=Math.min(w.qaHoldUntil,10+w.qaReinspectDuration))});
test('order timestamps are monotone across all stages',()=>{for(const k of ['machine','material','quality'])for(const r of evaluate(makeWorld(k)).rows)assert.ok(r.cutStart<=r.cutEnd&&r.cutEnd<=r.assemblyEnd&&r.assemblyEnd<=r.qaStart&&r.qaStart<=r.qaEnd&&r.qaEnd<=r.eta)});
test('intervention selection is recomputed and never a fixed discount',()=>{const w=makeWorld('machine');const a=evaluate(w,'repair',10),b=evaluate(w,'reroute',10);assert.notDeepEqual(a.rows,b.rows)});
test('unapproved substitution cannot be used',()=>{assert.equal(eligible(makeWorld('material',{substituteApproved:false}),'substitute').ok,false)});
test('all chosen interventions must be feasible',()=>{for(const k of ['machine','material','quality']){const w=makeWorld(k);const d=decide(w);assert.equal(evaluate(w,d.chosen,d.decisionAt).feasible,true)}});
