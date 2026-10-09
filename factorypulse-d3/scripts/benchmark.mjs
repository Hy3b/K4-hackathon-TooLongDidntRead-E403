import fs from 'node:fs';
import {makeWorld,trial} from '../src/logic.mjs';
const kinds=['machine','material','quality'];
const cases=[
 ['critical-urgent',{due:[120,138],manualLookup:20,feedLag:3}],
 ['neutral-relaxed',{due:[250,280],manualLookup:20,feedLag:3}],
 ['fast-manual',{due:[122,155],manualLookup:0,feedLag:8}],
 ['late-feed',{due:[120,145],manualLookup:7,feedLag:35}],
 ['tight-capacity',{due:[126,154],backupCapacity:120,manualLookup:20,feedLag:3}],
 ['missing-approval',{due:[115,142],backupApproved:false,substituteApproved:false,qaExpediteApproved:false,manualLookup:20,feedLag:3}],
 ['stale-data',{due:[135,165],dataFresh:false,manualLookup:15,feedLag:5}],
 ['distribution-shift',{due:[113,130],cutRate:2.4,assemblyRate:1.65,qaHoldUntil:95,manualLookup:17,feedLag:8}]
];
const outcomes=kinds.flatMap(k=>cases.map(([label,vars])=>trial(makeWorld(k,vars,k+'-'+label))));
const clear=outcomes.filter(x=>x.integrated.status!=='VERIFY');
const summary={count:outcomes.length,wins:clear.filter(x=>x.integrated.loss<x.manual.loss-1e-4).length,
 ties:clear.filter(x=>Math.abs(x.integrated.loss-x.manual.loss)<1e-4).length,
 losses:clear.filter(x=>x.integrated.loss>x.manual.loss+1e-4).length,
 verify:outcomes.filter(x=>x.integrated.status==='VERIFY').length,
 warning:'Synthetic hand-authored fixtures, shared evaluator, no DENSO ROI or field validation'};
fs.mkdirSync('evidence',{recursive:true});
fs.writeFileSync('evidence/trials.json',JSON.stringify({summary,outcomes},null,2));
fs.writeFileSync('evidence/summary.json',JSON.stringify(summary,null,2));
console.log(summary);
