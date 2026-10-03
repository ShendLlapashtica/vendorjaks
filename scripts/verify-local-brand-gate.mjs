// Proves (restored 2026-09-14) that the substring trap is closed and genuine locals still pass.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rf=globalThis.fetch;
globalThis.fetch=async(u,o)=>{const s=String(u);
 if(s.startsWith('/data/')){const p=path.join(ROOT,s);return{ok:fs.existsSync(p),status:200,json:async()=>JSON.parse(fs.readFileSync(p,'utf8'))};}
 if(/openfoodfacts/.test(s))return{ok:true,status:200,json:async()=>({products:[],count:0})};
 return rf(u,o);};
const {loadAllData}=await import(`file:///${ROOT}/src/lib/dataLoader.js`);
const {isEligibleLocalCandidate}=await import(`file:///${ROOT}/src/lib/matcher.js`);
const {buildCuratedLocalBrandSet}=await import(`file:///${ROOT}/src/lib/brandAlternatives.js`);
const data=await loadAllData();
const set=buildCuratedLocalBrandSet(data.brandAlternatives,data.localCatalogs);
// No local prefix on these codes, so eligibility rests purely on the brand set.
const CASES=[
 ['Vitalia','5310000000000',false,'North Macedonian (GS1 531) — the reported bug'],
 ['Vitamin','8600000000000',false,'Serbian producer, must never be "local"'],
 ['Vitamin Horgoš','3870000000000',false,'Serbian brand on a NON-Serbian prefix'],
 ['Vitalis','4000000000000',false,'unrelated brand containing "vita"'],
 ['Vita','9990000000000',true,'the genuine curated Kosovo dairy'],
 ['Vita 1L','9990000000000',true,'same brand with a size suffix'],
 ['Birra Peja','9990000000000',true,'curated Kosovo brewery'],
 ['Prince Caffe','9990000000000',true,'curated Kosovo roaster'],
 ['Frutti','9990000000000',true,'curated Kosovo juice'],
];
let fail=0;
for(const [brand,code,want,why] of CASES){
  const got=isEligibleLocalCandidate({brand,code},data.gs1,set);
  const ok=got===want;
  if(!ok)fail++;
  console.log(`  ${ok?'PASS':'FAIL'}  ${brand.padEnd(16)} eligible=${String(got).padEnd(5)} want=${String(want).padEnd(5)} ${why}`);
}
console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
