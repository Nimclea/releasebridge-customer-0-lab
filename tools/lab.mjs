#!/usr/bin/env node
// Test driver only. This program never issues ReleaseBridge decisions or protection receipts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan=JSON.parse(fs.readFileSync(path.join(root,'acceptance/scenarios.json'),'utf8'));
const args=process.argv.slice(2);
const command=args[0]??'help';
const ids=plan.cases.map(c=>c.id);
function runTests(files,{quiet=false}={}) {
  const r=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{
    cwd:root,encoding:'utf8',timeout:30000,maxBuffer:3*1024*1024,
    env:{...process.env,NODE_OPTIONS:''}
  });
  if(r.error || r.signal || r.status===null) throw new Error('TEST_RUNTIME_ERROR: '+(r.error?.message??r.signal));
  if(!quiet) {process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');}
  return {exit:r.status,output:(r.stdout??'')+'\n'+(r.stderr??'')};
}
function validatePlan() {
  if(plan.schema!=='RB_CUSTOMER0_12_PLUS_2_PLAN_V2'||plan.cases.length!==12||new Set(ids).size!==12) throw new Error('PLAN_INVALID');
  if(new Set(plan.cases.map(c=>c.claim_id)).size!==12) throw new Error('DUPLICATE_CLAIM');
  const counts={PASS:0,UNKNOWN:0,DENY:0};
  for(let i=0;i<12;i++) {
    const c=plan.cases[i];
    if(c.id!=='R'+String(i+1).padStart(2,'0')||c.sequence!==i+1||!Object.hasOwn(counts,c.first_decision_target)) throw new Error('SCENARIO_INVALID');
    counts[c.first_decision_target]++;
    for(const f of [c.source_path,c.oracle,'tasks/'+c.id+'.md']) if(!fs.statSync(path.join(root,f)).isFile()) throw new Error('MISSING_FILE: '+f);
  }
  if(counts.PASS!==3||counts.UNKNOWN!==4||counts.DENY!==5) throw new Error('SCENARIO_COUNTS_INVALID');
  return counts;
}
function noProtectionClaim() { console.log('RELEASEBRIDGE_ACCEPTANCE=NOT_EVALUATED');console.log('ACTIVE_PROTECTIONS=NOT_ATTESTED'); }
try {
  validatePlan();
  if(command==='validate') {
    console.log('LAB_PLAN=VALID_12_UNIQUE_CLAIMS'); noProtectionClaim();
  } else if(command==='smoke') {
    process.exitCode=runTests(['test/smoke.test.mjs']).exit; noProtectionClaim();
  } else if(command==='baseline'||command==='inventory') {
    const smoke=runTests(['test/smoke.test.mjs'],{quiet:true});
    if(smoke.exit!==0) {process.stdout.write(smoke.output);throw new Error('SMOKE_FAILED');}
    const rows=[];
    for(const c of plan.cases) {
      const r=runTests([c.oracle],{quiet:true});
      const assertionFailure=r.exit!==0 && /ERR_ASSERTION/.test(r.output) && /# tests 1(?:\r?\n|$)/.test(r.output);
      if(r.exit!==0&&!assertionFailure) {process.stdout.write(r.output);throw new Error('NON_ASSERTION_FAILURE: '+c.id);}
      rows.push({id:c.id,claim:c.claim_id,code_test:r.exit===0?'SATISFIED':'DEFECT_REPRODUCED'});
    }
    console.log(JSON.stringify({mode:command,code_assertions:rows,product_decisions:'NOT_EVALUATED',active_protections:'NOT_ATTESTED'},null,2));
    if(command==='baseline') {
      if(rows.some(r=>r.code_test!=='DEFECT_REPRODUCED')) throw new Error('BASELINE_NOT_12_REPRODUCIBLE_DEFECTS');
      console.log('INITIAL_FIXTURE=5_SMOKE_PASS_AND_12_ASSERTION_FAILURES');
      console.log('THIS_IS_FIXTURE_CALIBRATION_NOT_ACCEPTANCE');
    }
  } else if(command==='check') {
    if(args.length!==3||!['--only','--through'].includes(args[1])||!ids.includes(args[2])) throw new Error('USE: check --only R01 | check --through R12');
    const selected=args[1]==='--only'?plan.cases.filter(c=>c.id===args[2]):plan.cases.slice(0,ids.indexOf(args[2])+1);
    console.log('CODE_CONTRACTS='+selected.map(c=>c.id).join(','));
    process.exitCode=runTests(['test/smoke.test.mjs',...selected.map(c=>c.oracle)]).exit;
    noProtectionClaim();
  } else if(command==='c2') {
    console.log('C2_CODE_REBASELINE_CONTRACT_ONLY; NOT_AUTHORIZATION_OR_PROTECTION_ACCEPTANCE');
    process.exitCode=runTests(['test/smoke.test.mjs',...plan.cases.map(c=>c.oracle),'acceptance/c2-upgrade.test.mjs']).exit;
    noProtectionClaim();
  } else if(command==='ci') {
    const ref=process.env.GITHUB_HEAD_REF??'';
    const match=/^repair\/(R(?:0[1-9]|1[0-2]))(?:-[a-zA-Z0-9._-]+)?$/.exec(ref);
    if(!match) {
      console.log('CI_SCOPE=LAB_HEALTH_ONLY; use repair/R01-description for a repair candidate');
      process.exitCode=runTests(['test/smoke.test.mjs']).exit;
    } else {
      const selected=plan.cases.slice(0,ids.indexOf(match[1])+1);
      console.log('CI_SCOPE=CODE_CONTRACT_PREFIX_'+match[1]);
      process.exitCode=runTests(['test/smoke.test.mjs',...selected.map(c=>c.oracle)]).exit;
    }
    noProtectionClaim();
    const headRead=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',timeout:10000});
    if(headRead.status!==0||!/^[a-f0-9]{40,64}$/.test(headRead.stdout.trim())) throw new Error('CI_CANDIDATE_IDENTITY_MISSING');
    const actualCandidate=headRead.stdout.trim();
    console.log('ACTUAL_TESTED_CANDIDATE='+actualCandidate);
    if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '## Customer 0 application CI\n\nThis is application test evidence, **not** a ReleaseBridge PASS or protection receipt.\n\n'+
      'Candidate: `'+actualCandidate+'`\n\n'+
      (match?'Contracts through '+match[1]:'Lab health only; 12 known defects are separately listed.')+'\n');
  } else {
    console.log('node tools/lab.mjs validate | smoke | baseline | inventory | check --only R01 | check --through R12 | c2');
    if(command!=='help') process.exitCode=2;
  }
} catch(e) { console.error('LAB_ERROR: '+e.message);process.exitCode=2; }
