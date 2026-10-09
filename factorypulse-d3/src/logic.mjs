// All fixtures are SYNTHETIC. No personal, DENSO, ERP or proprietary production data.
const BASE = Object.freeze({
  quantities:[90,70], priorities:[2,1], due:[135,165], transit:18,
  cutRate:3, assemblyRate:2, inspectRate:4, stock:180,
  downtimeEnd:0, refillAt:0, qaHoldUntil:0,
  backupRate:2, backupCapacity:200, backupApproved:true,
  substituteApproved:true, substituteUnits:160, qaExpediteApproved:true,
  repairDuration:30, routeSetup:12, inboundDuration:38, qaReinspectDuration:28,
  decisionDeadline:60, // maximum time to make initial safe recommendation
  feedLag:3, manualLookup:15, // assumed time until trustworthy cross-department information arrives
  dataFresh:true,
});
const TYPES={
  machine:{name:'Machine downtime',trigger:'MES · M-CUT-01',reason:'M-CUT-01 is unavailable; order queue is affected.',actions:['none','repair','reroute']},
  material:{name:'Material shortage',trigger:'WMS · PART-X',reason:'PART-X cannot cover the next full lot.',actions:['none','expedite','substitute']},
  quality:{name:'Quality hold',trigger:'QA · LOT-101',reason:'The first lot is held pending controlled inspection.',actions:['none','reinspect']},
};
const ACTIONS={
  none:{name:'Wait / retain current plan',dept:'Planning',cost:0},
  repair:{name:'Expedite maintenance',dept:'Maintenance',cost:18},
  reroute:{name:'Route to approved backup',dept:'Production',cost:25},
  expedite:{name:'Expedite inbound shipment',dept:'Purchasing',cost:24},
  substitute:{name:'Use QA-approved substitute',dept:'Quality',cost:34},
  reinspect:{name:'Approved parallel reinspection',dept:'Quality',cost:17}
};
function makeWorld(type,overrides={},id='illustration'){
  if(!TYPES[type])throw new Error('Unknown incident');
  return { ...BASE,
    ...(type==='machine'?{downtimeEnd:75}:type==='material'?{stock:60,refillAt:95}:{qaHoldUntil:165}),
    ...overrides,
    type,id
  };
}
const DEMOS=[
  makeWorld('machine',{},'demo-machine'),
  makeWorld('material',{},'demo-material'),
  makeWorld('quality',{},'demo-quality'),
  makeWorld('machine',{backupApproved:false,qaExpediteApproved:false},'unsafe-backup'),
  makeWorld('material',{dataFresh:false},'stale-data'),
  makeWorld('quality',{qaExpediteApproved:false},'qa-approval-missing')
];


const round=x=>Math.round(x*100)/100;
const assert=(c,m)=>{if(!c)throw Error(m)};
function checkInputs(w){
  assert(TYPES[w.type], 'invalid incident');
  for(const v of [...w.quantities,...w.due,...w.priorities,w.cutRate,w.assemblyRate,w.inspectRate,w.backupRate,w.backupCapacity,w.stock,w.transit,w.feedLag,w.manualLookup]){
    assert(Number.isFinite(v)&&v>=0,'negative or non-finite resource/timing');
  }
  assert(w.quantities.length===2&&w.due.length===2&&w.priorities.length===2,'two-order demonstration');
  assert(w.cutRate>0&&w.assemblyRate>0&&w.inspectRate>0,'throughput > 0');
  return true;
}
function eligible(w,action){
  if(!TYPES[w.type].actions.includes(action))return {ok:false,why:'action does not address this incident'};
  if(action==='reroute' && (!w.backupApproved||w.backupCapacity < w.quantities.reduce((a,b)=>a+b,0)))return {ok:false,why:'backup route unapproved or lacks capacity'};
  if(action==='substitute' && (!w.substituteApproved || (w.stock+w.substituteUnits)<w.quantities.reduce((a,b)=>a+b,0)))return {ok:false,why:'substitute not QA-approved or insufficient'};
  if(action==='reinspect' && !w.qaExpediteApproved)return {ok:false,why:'QA-authorized reinspection unavailable'};
  return {ok:true,why:'hard constraints satisfied'};
}
// Discrete serial-stage schedule. Lateness computed exactly once at the shipping gate.
// For simplicity, lots are indivisible, no splitting/preemption, and a single carrier departure is omitted.
function evaluate(w,action='none',decisionAt=0){
  checkInputs(w);assert(ACTIONS[action],'unknown action');
  assert(Number.isFinite(decisionAt)&&decisionAt>=0,'bad decision time');
  const valid=eligible(w,action); if(!valid.ok)return {feasible:false,why:valid.why,action,decisionAt};
  let cutRate=w.cutRate, ready=(w.type==='machine'?w.downtimeEnd:0), stock=w.stock;
  let replenishAt=w.refillAt, qaHold=w.qaHoldUntil, approvedRelease=false;
  if(w.type==='machine'){
    if(action==='repair')ready=Math.min(ready,decisionAt+w.repairDuration);
    if(action==='reroute'){ready=Math.min(ready,decisionAt+w.routeSetup);cutRate=w.backupRate;}
  }
  if(w.type==='material'){
    if(action==='expedite')replenishAt=Math.min(replenishAt,decisionAt+w.inboundDuration);
    if(action==='substitute')stock+=w.substituteUnits;
  }
  if(w.type==='quality'&&action==='reinspect'){
    // The QA manager has authorized the alternate inspection, not an unsafe forced release.
    qaHold=Math.min(qaHold,decisionAt+w.qaReinspectDuration);approvedRelease=true;
  }
  let cutFree=ready, assemblyFree=0, qualityFree=0, inboundCount=0;
  const rows=[];
  for(let i=0;i<w.quantities.length;i++){
    const qty=w.quantities[i];let materialReady=0;
    if(stock<qty){stock+=240;inboundCount++;materialReady=replenishAt;}
    if(stock<qty)return {feasible:false,why:'not enough material',action,decisionAt};
    stock-=qty;
    const cutStart=Math.max(cutFree,materialReady),cutEnd=cutStart+qty/cutRate;cutFree=cutEnd;
    const assemblyStart=Math.max(assemblyFree,cutEnd),assemblyEnd=assemblyStart+qty/w.assemblyRate;assemblyFree=assemblyEnd;
    const qaStart=Math.max(qualityFree,assemblyEnd,i===0?qaHold:0);
    const qaEnd=qaStart+qty/w.inspectRate;qualityFree=qaEnd;
    const eta=qaEnd+w.transit,late=Math.max(0,eta-w.due[i]);
    rows.push({id:`ORD-${101+i}`,qty,due:w.due[i],cutStart:round(cutStart),cutEnd:round(cutEnd),assemblyEnd:round(assemblyEnd),qaStart:round(qaStart),qaEnd:round(qaEnd),eta:round(eta),late:round(late),priority:w.priorities[i],qualityReleased:qaEnd>=qaHold});
  }
  const lateness=rows.reduce((s,r)=>s+r.late,0), weightedLate=rows.reduce((s,r)=>s+r.late*r.priority,0);
  const score=weightedLate+0.65*ACTIONS[action].cost; // synthetic cost weight: for ranking only, never monetary ROI
  return {feasible:true,action,decisionAt,rows,lateMinutes:round(lateness),weightedLate:round(weightedLate),costPoints:ACTIONS[action].cost,loss:round(score),inboundCount,approvedRelease,
    why: action==='none'?'No intervention selected':'Action simulated under declared capacity/quality authorization'};
}
// Policy receives a dated snapshot, not hidden post-decision facts.
// A stale feed cannot authorize a risky intervention; system must request verification.
function decide(w,channel='integrated',opts={}){
  checkInputs(w);
  const feedLag=opts.feedLag ?? w.feedLag, manualLookup=opts.manualLookup ?? w.manualLookup;
  const ready=channel==='integrated'?feedLag:manualLookup;
  const fresh=channel==='integrated'?w.dataFresh:true;
  if(!fresh)return {status:'VERIFY',why:'stale / inconsistent cross-layer input; manual confirmation required',decisionAt:ready,channel,chosen:'none',simulation:evaluate(w,'none',ready)};
  if(ready>w.decisionDeadline)return {status:'ESCALATE',why:'decision time budget expired; request operator approval',decisionAt:ready,channel,chosen:'none',simulation:evaluate(w,'none',ready)};
  // The SAME exhaustive loss-based policy is used for BOTH information channels.
  const scored=TYPES[w.type].actions.map(a=>evaluate(w,a,ready)).filter(s=>s.feasible)
    .sort((a,b)=>a.loss-b.loss || ACTIONS[a.action].cost-ACTIONS[b.action].cost);
  const best=scored[0],noAction=scored.find(s=>s.action==='none');
  // Threshold prevents recommendation when benefit is insignificant. Always allow the safe no-action response.
  const chosen=(noAction.loss-best.loss>=1)?best:noAction;
  return {status:chosen.action==='none'?'NO_ACTION':'RECOMMEND',why:chosen.action==='none'?'No safe intervention has >= 1 point improvement under these assumptions':'Lowest loss among permitted interventions',decisionAt:ready,channel,chosen:chosen.action,simulation:chosen,options:scored};
}
function oracle(w){
  const options=TYPES[w.type].actions.map(a=>evaluate(w,a,0)).filter(o=>o.feasible).sort((a,b)=>a.loss-b.loss);
  return options[0];
}
function trial(w,opts={}){
  const sop=decide(w,'manual',opts), integrated=decide(w,'integrated',opts),truth=oracle(w);
  const metric=p=>({status:p.status,action:p.chosen,decisionAt:p.decisionAt,loss:p.simulation.loss,lateMinutes:p.simulation.lateMinutes,
    regret:round(Math.max(0,p.simulation.loss-truth.loss)),violations:p.simulation.feasible?0:1});
  return {id:w.id,type:w.type,assumptions:{manualLookup:opts.manualLookup ?? w.manualLookup,feedLag:opts.feedLag ?? w.feedLag,feedFresh:w.dataFresh},
    manual:metric(sop),integrated:metric(integrated),oracle:{action:truth.action,loss:truth.loss},
    localEvent:TYPES[w.type].trigger,world:w};
}




export {BASE,TYPES,ACTIONS,makeWorld,DEMOS,checkInputs,eligible,evaluate,decide,oracle,trial};
