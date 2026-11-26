'use strict';
// This file is executed from the trusted PR base. Never execute PR-head scripts.
const cp=require('node:child_process');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const BEHAVIOR_IMAGE='docker.io/library/node:24.14.0-bookworm-slim@sha256:d8e448a56fc63242f70026718378bd4b00f8c82e78d20eefb199224a4d8e33d8';
const IMAGE_DIGEST='sha256:d8e448a56fc63242f70026718378bd4b00f8c82e78d20eefb199224a4d8e33d8';
const MAX_INPUT_BYTES=64*1024*1024,MAX_OUTPUT_BYTES=4*1024*1024,TEST_TIMEOUT_MS=300000;
const ISOLATION_PREFLIGHT=`'use strict';
import fs from 'node:fs';
function need(ok){if(!ok)throw Error('RB_ISOLATION_PREFLIGHT_DENY');}
need(process.getuid()===65532);
const status=fs.readFileSync('/proc/self/status','utf8');
need(/^NoNewPrivs:\\s+1$/m.test(status)&&/^Seccomp:\\s+2$/m.test(status)&&/^CapEff:\\s+0+$/m.test(status));
for(const k of Object.keys(process.env))need(!/^(?:GITHUB_|GH_|RB_|DOCKER_|ACTIONS_)/.test(k));
const mount=fs.readFileSync('/proc/self/mountinfo','utf8').split('\\n');
const root=mount.find(x=>x.split(' ')[4]==='/'),tmp=mount.find(x=>x.split(' ')[4]==='/tmp'),shmMount=mount.find(x=>x.split(' ')[4]==='/dev/shm');
need(root&&root.split(' ')[5].split(',').includes('ro'));
need(tmp&&['rw','noexec','nosuid','nodev'].every(x=>tmp.split(' ')[5].split(',').includes(x)));
need(shmMount&&['rw','noexec','nosuid','nodev'].every(x=>shmMount.split(' ')[5].split(',').includes(x)));
const read=p=>fs.readFileSync(p,'utf8').trim();
const cpu=read('/sys/fs/cgroup/cpu.max').split(' '),memory=Number(read('/sys/fs/cgroup/memory.max')),pids=Number(read('/sys/fs/cgroup/pids.max'));
need(cpu.length===2&&Number(cpu[0])>0&&Number(cpu[1])>0&&Number(cpu[0])/Number(cpu[1])<=1&&memory>0&&memory<=536870912&&pids>0&&pids<=64);
const st=fs.statfsSync('/tmp'),shm=fs.statfsSync('/dev/shm');need(st.bsize*st.blocks<=64*1024*1024&&shm.bsize*shm.blocks<=16*1024*1024);
const ifaces=fs.readdirSync('/sys/class/net');need(ifaces.length===1&&ifaces[0]==='lo');
`;
const fail=m=>{throw Error('RB_BEHAVIOR_DENY:'+m)};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const safePath=p=>typeof p==='string'&&/^[-\w./]+$/.test(p)&&!p.startsWith('/')&&!p.split('/').some(x=>!x||x==='.'||x==='..')&&!p.startsWith('.git/');
function git(...args){const r=cp.spawnSync('git',args,{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});if(r.status!==0)fail('GIT_'+args[0]);return r.stdout.trim();}
function bytesAt(ref,p){if(!safePath(p))fail('UNSAFE_PATH');const r=cp.spawnSync('git',['show',ref+':'+p],{encoding:null,timeout:30000,maxBuffer:4*1024*1024});if(r.status!==0)fail('BLOB_MISSING:'+p);return r.stdout;}
function jsonAt(ref,p){try{return JSON.parse(bytesAt(ref,p).toString('utf8'));}catch(e){fail('JSON_INVALID:'+p);}}
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
function verifySet(set,repo,branch,{historical=false}={}){
 if(set?.schema!=='RB_BEHAVIOR_CLAIM_SET_V1'||set.repository!==repo||set.branch!==branch||!Array.isArray(set.history)||set.history.length>4096)fail('CLAIM_SET_BINDING');
 if(!set.history.length)return {state:'READY_NO_ACCEPTED_BEHAVIOR_CLAIMS',claims:[],head:null};
 if(typeof set.acceptance_public_key!=='string'||!set.acceptance_public_key)fail('PRODUCT_ACCEPTANCE_KEY_UNAVAILABLE');
 if(typeof process.env.RB_ACCEPTANCE_PUBLIC_KEY!=='string'||!process.env.RB_ACCEPTANCE_PUBLIC_KEY||set.acceptance_public_key.replace(/\\n/g,'\n')!==process.env.RB_ACCEPTANCE_PUBLIC_KEY.replace(/\\n/g,'\n'))fail('PRODUCT_ACCEPTANCE_TRUST_ANCHOR_MISMATCH');
 let key;try{key=crypto.createPublicKey(set.acceptance_public_key.replace(/\\n/g,'\n'));}catch{fail('PRODUCT_ACCEPTANCE_KEY_INVALID');}
 if(key.asymmetricKeyType!=='ed25519')fail('PRODUCT_ACCEPTANCE_KEY_TYPE');
 let parent=null;const ids=new Set(),latest=new Map(),behaviorLatest=new Map(),usedBlobs=new Map(),claims=[];
 for(let i=0;i<set.history.length;i++){
  const e=set.history[i];if(!e||typeof e.payload!=='string'||typeof e.signature!=='string'||!/^[A-Za-z0-9_-]+$/.test(e.signature))fail('ENVELOPE_INVALID');
  const raw=Buffer.from(e.payload,'utf8');if(!crypto.verify(null,raw,key,Buffer.from(e.signature,'base64url')))fail('PRODUCT_ACCEPTANCE_SIGNATURE_INVALID');
  let p;try{p=JSON.parse(e.payload);}catch{fail('PAYLOAD_JSON');}
  if(!['RB_AGENT_FIX_ACCEPTED_V1','RB_AGENT_FIX_ACCEPTED_V2'].includes(p.schema)||p.repo!==repo||p.branch!==branch||!safePath(p.path)||!/^[a-f0-9]{40}$/.test(p.blob||'')||!/^[a-f0-9]{40}$/.test(p.head||'')||typeof p.issuer!=='string'||!p.issuer||!Number.isSafeInteger(p.issued_at)||!Number.isSafeInteger(p.expires_at)||p.expires_at<=p.issued_at||p.expires_at-p.issued_at>604800)fail('ACCEPTANCE_PAYLOAD_INVALID');
  const digest=sha(raw);if(ids.has(digest))fail('HISTORY_REPLAY');ids.add(digest);
  const legacy=p.schema==='RB_AGENT_FIX_ACCEPTED_V1',claimId=legacy?'legacy:'+p.path:p.claim_id;
  if(legacy&&i!==0)fail('LEGACY_REPLACEMENT_REQUIRES_SUCCESSION');
  if(!legacy&&(typeof claimId!=='string'||!/^[-\w:.\/]{1,200}$/.test(claimId)||p.parent!==parent))fail('HISTORY_PARENT_OR_CLAIM_INVALID');
  const prior=latest.get(claimId);if(!legacy&&(p.revision!==(prior?prior.revision+1:1)||p.predecessor!==(prior?prior.digest:null)))fail('CLAIM_SUCCESSION');
  if(prior&&prior.path!==p.path)fail('CLAIM_PATH_CHANGED');
  for(const [other,v] of latest)if(other!==claimId&&(v.path===p.path||v.path.startsWith(p.path+'/')||p.path.startsWith(v.path+'/')))fail('CLAIM_PATH_CONFLICT');
  const used=usedBlobs.get(claimId)||new Set();if(used.has(p.blob))fail('CLAIM_ROLLBACK');used.add(p.blob);usedBlobs.set(claimId,used);
  if(p.behavior){
   if(legacy||p.behavior.schema!=='RB_ACCEPTED_BEHAVIOR_V1'||p.behavior.claim_id!==claimId||p.behavior.revision!==p.revision||p.behavior.predecessor!==p.predecessor||p.behavior.source?.repo!==repo||p.behavior.source?.branch!==branch||p.behavior.source?.path!==p.path||p.behavior.source?.blob!==p.blob||p.behavior.source?.head!==p.head)fail('BEHAVIOR_ACCEPTANCE_BINDING');
   if(p.behavior.k4?.outcome!=='PRESERVE'||p.behavior.k4?.reason_code!=='AFFECTED_CLAIM_REPROVEN_CURRENT'||!/^[A-F0-9]{64}$/.test(p.behavior.k4?.decision_id||''))fail('ORIGINAL_K4_RECEIPT_INVALID');
   const k5=p.behavior.k5;if(k5?.schema!=='RB_K5_BEHAVIOR_EVIDENCE_V1'||k5.status!=='QUALIFIED'||!/^[a-f0-9]{64}$/.test(k5.evidence_digest||'')||!/^[a-f0-9]{64}$/.test(k5.regression_digest||'')||!k5.execution_ref||k5.impact_complete!==true||!Array.isArray(k5.negative_controls)||k5.negative_controls.length<1)fail('K5_EVIDENCE_UNAVAILABLE');
   const tests=p.behavior.tests;if(!Array.isArray(tests)||tests.length<1||tests.length>32)fail('REGRESSION_SUITE_MISSING');
   const names=new Set();for(const t of tests){if(!t||typeof t.name!=='string'||names.has(t.name)||!safePath(t.name)||typeof t.bytes_base64!=='string'||t.bytes_base64.length>350000||!/^[a-f0-9]{64}$/.test(t.sha256||''))fail('TEST_BUNDLE_INVALID');names.add(t.name);const b=Buffer.from(t.bytes_base64,'base64');if(b.length>256*1024||sha(b)!==t.sha256)fail('TEST_BUNDLE_DIGEST');}
   const suiteDigest=sha(Buffer.from(canonical(tests),'utf8'));if(suiteDigest!==k5.regression_digest||p.behavior.regression_digest!==suiteDigest)fail('REGRESSION_EVIDENCE_BINDING');
   if(!historical&&p.expires_at<=Math.floor(Date.now()/1000))fail('NEW_ACCEPTANCE_EXPIRED');
   behaviorLatest.set(claimId,{claim_id:claimId,revision:p.revision,digest,source:p.behavior.source,tests,k5,k4:p.behavior.k4});
  }else if(behaviorLatest.has(claimId))fail('BEHAVIOR_CLAIM_DOWNGRADE');
  latest.set(claimId,{revision:legacy?1:p.revision,digest,path:p.path,blob:p.blob});parent=digest;
 }
 claims.push(...behaviorLatest.values());claims.sort((a,b)=>a.claim_id.localeCompare(b.claim_id));
 return {state:claims.length?'ACCEPTED_BEHAVIOR_CLAIMS':'READY_NO_ACCEPTED_BEHAVIOR_CLAIMS',claims,head:parent};
}
function assertPrefix(base,next){if(next.history.length<base.history.length)fail('ACCEPTED_HISTORY_REMOVED');for(let i=0;i<base.history.length;i++)if(next.history[i].payload!==base.history[i].payload||next.history[i].signature!==base.history[i].signature)fail('ACCEPTED_HISTORY_REWRITTEN');}
function runDocker(args,{env=process.env,timeout=30000,maxBuffer=65536}={}){
 const r=cp.spawnSync('docker',args,{encoding:'utf8',timeout,maxBuffer,windowsHide:true,shell:false,env});
 if(r.error)fail('DOCKER_COMMAND_FAILED:'+String(r.error.code||'UNKNOWN'));
 if(r.status!==0)fail('DOCKER_COMMAND_DENIED');
 return String(r.stdout||'').trim();
}
function verifyDockerHost(security){
 if(!Array.isArray(security)||!security.includes('name=rootless')||!security.includes('name=seccomp,profile=builtin'))fail('DOCKER_ROOTLESS_OR_SECCOMP_UNVERIFIED');
}
function verifyImage(image,arch=process.arch){
 const expectedArch=arch==='x64'?'amd64':arch==='arm64'?'arm64':null;
 if(!expectedArch||!/^sha256:[a-f0-9]{64}$/.test(image?.Id||'')||!Array.isArray(image.RepoDigests)||
   !image.RepoDigests.includes(`docker.io/library/node@${IMAGE_DIGEST}`)||image.Os!=='linux'||image.Architecture!==expectedArch)fail('BEHAVIOR_IMAGE_IDENTITY_MISMATCH');
 const config=image?.Config;
 if(!config||typeof config!=='object'||Array.isArray(config))fail('BEHAVIOR_IMAGE_USER_OR_VOLUME_MISMATCH');
 const hasUser=Object.prototype.hasOwnProperty.call(config,'User');
 if(hasUser&&config.User!=='node'&&config.User!==null&&config.User!=='')fail('BEHAVIOR_IMAGE_USER_OR_VOLUME_MISMATCH');
 const hasVolumes=Object.prototype.hasOwnProperty.call(config,'Volumes');
 const volumes=config.Volumes;
 if(hasVolumes&&volumes!==null&&(typeof volumes!=='object'||Array.isArray(volumes)))fail('BEHAVIOR_IMAGE_USER_OR_VOLUME_MISMATCH');
 if(Object.keys(volumes||{}).length)fail('BEHAVIOR_IMAGE_USER_OR_VOLUME_MISMATCH');
}
function sandboxArguments({image,inputPath,runId,testFiles}){
 if(image!==BEHAVIOR_IMAGE||!path.isAbsolute(inputPath)||/[\n]/.test(inputPath)||!/^rb-[a-f0-9]{32}$/.test(runId)||!Array.isArray(testFiles)||!testFiles.length||testFiles.length>32)fail('BEHAVIOR_SANDBOX_ARGUMENT_INVALID');
 const testPaths=testFiles.map(n=>{if(!safePath(n)||!n.endsWith('.test.mjs')||n.length>220)fail('TEST_NAME_INVALID');return '/workspace/__accepted_tests__/'+n;});
  return ['create','--pull=never','--network=none','--ipc=private','--cgroupns=private','--read-only','--log-driver=none','--shm-size=16m',
  '--user=65532:65532','--cap-drop=ALL','--security-opt=no-new-privileges:true','--pids-limit=64','--memory=512m','--memory-swap=512m','--cpus=1',
  '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777','--mount',`type=bind,source=${inputPath},target=/workspace,readonly`,
  '--attach=stdout','--attach=stderr','--init','--restart=no','--no-healthcheck','--label',`rb.behavior.run=${runId}`,'--env=HOME=/tmp','--env=TMPDIR=/tmp','--env=TEMP=/tmp',
  '--env=NODE_OPTIONS=','--env=NODE_ENV=production','--workdir=/workspace','--entrypoint=/usr/local/bin/node',image,'--import','/workspace/__isolation_preflight__.mjs','--test',...testPaths];
}
function verifyContainer(c,{imageId,inputPath,expectedTests=[],runId}){
 const h=c?.HostConfig,e=c?.Config,m=c?.Mounts||[],tmpfs=h?.Tmpfs||{};
 const binds=m.filter(x=>x.Type==='bind'),other=m.filter(x=>x.Type!=='bind');
 const mountOk=binds.length===1&&binds[0].Source===inputPath&&binds[0].Destination==='/workspace'&&binds[0].RW===false&&
   other.every(x=>x.Type==='tmpfs'&&['/tmp','/dev/shm'].includes(x.Destination)&&x.RW===true)&&new Set(other.map(x=>x.Destination)).size===other.length;
 const env=e?.Env||[],allowed=new Set(['PATH','NODE_VERSION','YARN_VERSION','HOME','TMPDIR','TEMP','NODE_OPTIONS','NODE_ENV']);
 const cmd=e?.Cmd||[];
 if(c?.Image!==imageId||e?.User!=='65532:65532'||h?.NetworkMode!=='none'||h?.ReadonlyRootfs!==true||h?.Privileged!==false||
   (h?.Devices||[]).length||(h?.DeviceRequests||[]).length||(h?.CapAdd||[]).length||JSON.stringify(h?.CapDrop)!==JSON.stringify(['ALL'])||
   JSON.stringify(h?.SecurityOpt)!==JSON.stringify(['no-new-privileges:true'])||h?.PidsLimit!==64||h?.Memory!==536870912||
   h?.MemorySwap!==536870912||h?.NanoCpus!==1000000000||h?.ShmSize!==16777216||h?.Init!==true||h?.RestartPolicy?.Name!=='no'||h?.PidMode||h?.UsernsMode||
   h?.IpcMode!=='private'||h?.CgroupnsMode!=='private'||Object.keys(tmpfs).length!==1||tmpfs['/tmp']!=='rw,noexec,nosuid,nodev,size=64m,mode=1777'||
   (h?.Binds||[]).length||!mountOk||e?.WorkingDir!=='/workspace'||JSON.stringify(e?.Entrypoint)!==JSON.stringify(['/usr/local/bin/node'])||
   JSON.stringify(cmd)!==JSON.stringify(['--import','/workspace/__isolation_preflight__.mjs','--test',...expectedTests])||
   e?.AttachStdin===true||e?.AttachStdout!==true||e?.AttachStderr!==true||e?.OpenStdin===true||e?.ExposedPorts&&Object.keys(e.ExposedPorts).length||
   (h?.PortBindings&&Object.keys(h.PortBindings).length)||(h?.Links||[]).length||(h?.ExtraHosts||[]).length||(h?.VolumesFrom||[]).length||
   (h?.Sysctls&&Object.keys(h.Sysctls).length)||h?.LogConfig?.Type!=='none'||e?.Labels?.['rb.behavior.run']!==runId)fail('BEHAVIOR_CONTAINER_ISOLATION_MISMATCH');
 if(env.some(v=>!allowed.has(v.split('=',1)[0]))||new Set(env.map(v=>v.split('=',1)[0])).size!==env.length||
   !env.includes('HOME=/tmp')||!env.includes('NODE_OPTIONS=')||!env.includes('NODE_ENV=production'))fail('BEHAVIOR_CONTAINER_ENVIRONMENT_MISMATCH');
 return crypto.createHash('sha256').update(JSON.stringify({image:c.Image,host:h,config:e,mounts:m})).digest('hex');
}
function boundedInputPath(root){if(!path.isAbsolute(root)||/[,\n]/.test(root))fail('SANDBOX_INPUT_PATH_INVALID');return root;}
function prepareInput({root,sourceRef,claims}){
 if(!path.isAbsolute(root))fail('SANDBOX_INPUT_PATH_INVALID');
 const testsRoot=path.join(root,'__accepted_tests__');fs.mkdirSync(path.join(root,'src'),{recursive:true});fs.mkdirSync(testsRoot,{recursive:true});let total=0;const dirs=new Set([root,path.join(root,'src'),testsRoot]);
 const rows=git('ls-tree','-r','-l','--full-tree',sourceRef,'--','src').split(/\n?\n/).filter(Boolean),srcList=[];
 for(const row of rows){const m=row.match(/^100(?:644|755) blob [a-f0-9]{40} \d+\t(src\/.+)$/);if(!m||!safePath(m[1]))fail('SOURCE_TREE_CONTAINS_UNSUPPORTED_ENTRY');srcList.push(m[1]);}
 if(!srcList.length||srcList.length>10000)fail('SOURCE_TREE_UNAVAILABLE');
 for(const p of srcList){const b=bytesAt(sourceRef,p);total+=b.length;if(b.length>4*1024*1024||total>MAX_INPUT_BYTES)fail('SANDBOX_INPUT_LIMIT');const dest=path.join(root,...p.split('/'));fs.mkdirSync(path.dirname(dest),{recursive:true});dirs.add(path.dirname(dest));fs.writeFileSync(dest,b,{flag:'wx',mode:0o644});}
 const names=new Set();for(const c of claims)for(const t of c.tests){if(names.has(t.name)||!safePath(t.name))fail('TEST_NAME_COLLISION_OR_PATH');names.add(t.name);const b=Buffer.from(t.bytes_base64,'base64');if(b.length>256*1024||total+b.length>MAX_INPUT_BYTES||sha(b)!==t.sha256)fail('SANDBOX_INPUT_LIMIT_OR_TEST_DIGEST');total+=b.length;const dest=path.join(testsRoot,t.name+'.test.mjs');fs.mkdirSync(path.dirname(dest),{recursive:true});dirs.add(path.dirname(dest));fs.writeFileSync(dest,b,{flag:'wx',mode:0o644});}
 const preflight=Buffer.from(ISOLATION_PREFLIGHT,'utf8');total+=preflight.length;if(total>MAX_INPUT_BYTES)fail('SANDBOX_INPUT_LIMIT');fs.writeFileSync(path.join(root,'__isolation_preflight__.mjs'),preflight,{flag:'wx',mode:0o644});
 for(const dir of dirs){let cur=dir;while(cur.startsWith(root)){dirs.add(cur);const parent=path.dirname(cur);if(parent===cur)break;cur=parent;}}
 for(const dir of dirs)fs.chmodSync(dir,0o755);
 return {files:[...names].map(n=>n+'.test.mjs').sort(),bytes:total};
}
function runIsolatedSuite({inputPath,testFiles,runId,docker=runDocker,platform=process.platform,sandboxUid=process.env.RB_SANDBOX_UID,runtimeDir=process.env.XDG_RUNTIME_DIR,dockerHost=process.env.DOCKER_HOST,uid=typeof process.getuid==='function'?process.getuid():null,group=typeof process.getgid==='function'?process.getgid():null,socketStat=fs.lstatSync}){
 if(platform!=='linux')fail('ISOLATED_LINUX_RUNNER_REQUIRED');inputPath=boundedInputPath(inputPath);
 if(!Number.isInteger(uid)||!Number.isInteger(group)||!/^[1-9]\d{0,6}$/.test(String(sandboxUid||''))||Number(sandboxUid)===uid||runtimeDir!==`/run/user/${sandboxUid}`||dockerHost!==`unix://${runtimeDir}/docker.sock`)fail('ROOTLESS_DOCKER_ENDPOINT_UNVERIFIED');
 const socket=path.join(runtimeDir,'docker.sock');let socketInfo;try{socketInfo=socketStat(socket);}catch{fail('ROOTLESS_DOCKER_SOCKET_UNAVAILABLE');}
 if(!socketInfo.isSocket?.()||socketInfo.uid!==Number(sandboxUid)||socketInfo.gid!==group||(socketInfo.mode&0o020)===0)fail('ROOTLESS_DOCKER_SOCKET_OWNER_MISMATCH');
 const dockerConfig=fs.mkdtempSync(path.join(os.tmpdir(),'rb-docker-config-'));let containerId=null;
 const env={PATH:process.env.PATH||'/usr/bin:/bin',HOME:dockerConfig,TMPDIR:dockerConfig,TEMP:dockerConfig,DOCKER_CONFIG:dockerConfig,DOCKER_HOST:dockerHost,XDG_RUNTIME_DIR:runtimeDir};
 try{
  fs.writeFileSync(path.join(dockerConfig,'config.json'),'{}',{flag:'wx',mode:0o600});
  verifyDockerHost(JSON.parse(docker(['info','--format','{{json .SecurityOptions}}'],{env})));
  docker(['pull',BEHAVIOR_IMAGE],{env,timeout:120000,maxBuffer:MAX_OUTPUT_BYTES});
  const images=JSON.parse(docker(['image','inspect',BEHAVIOR_IMAGE],{env}));if(!Array.isArray(images)||images.length!==1)fail('BEHAVIOR_IMAGE_INSPECT_INVALID');verifyImage(images[0]);
  const args=sandboxArguments({image:BEHAVIOR_IMAGE,inputPath,runId,testFiles});
  const created=docker(args,{env});if(!/^[a-f0-9]{64}$/.test(created))fail('BEHAVIOR_CONTAINER_ID_INVALID');containerId=created;
  const config=JSON.parse(docker(['inspect',containerId],{env}))[0],expectedTests=testFiles.map(n=>'/workspace/__accepted_tests__/'+n);
  const configDigest=verifyContainer(config,{imageId:images[0].Id,inputPath,expectedTests,runId});
  const logs=docker(['start','--attach',containerId],{env,timeout:TEST_TIMEOUT_MS,maxBuffer:MAX_OUTPUT_BYTES});
  const final=JSON.parse(docker(['inspect',containerId],{env}))[0],state=final?.State;
  if(state?.Status!=='exited'||state.ExitCode!==0||state.OOMKilled||state.Error)fail('ISOLATED_REGRESSION_FAILED');
  const count=Number(logs.match(/# tests\s+(\d+)/)?.[1]||0),passed=Number(logs.match(/# pass\s+(\d+)/)?.[1]||0),failed=Number(logs.match(/# fail\s+(\d+)/)?.[1]||0);
  if(count<1||passed!==count||failed!==0)fail('ISOLATED_REGRESSION_RESULT_INVALID');
  return {image_digest:IMAGE_DIGEST,image_id:images[0].Id,container_id:containerId,container_config_digest:configDigest,source_ref:process.env.RB_HEAD_SHA,tests:count,logs_sha256:sha(logs)};
 }catch(e){if(/ETIMEDOUT|ENOBUFS/.test(String(e?.message||e)))fail('ISOLATED_REGRESSION_TIMEOUT_OR_OUTPUT_LIMIT');throw e;}
 finally{
  if(containerId){try{docker(['rm','--force',containerId],{env});}catch{fail('ISOLATED_CONTAINER_CLEANUP_FAILED');}}
  try{fs.rmSync(dockerConfig,{recursive:true,force:true});}catch{fail('ISOLATED_TEMP_CLEANUP_FAILED');}
 }
}
function main(){
 const repo=process.env.GITHUB_REPOSITORY,base=process.env.RB_BASE_SHA,head=process.env.RB_HEAD_SHA,branch=process.env.RB_BASE_REF,pr=process.env.RB_PR_NUMBER;
 if(!repo||!/^[-\w.]+\/[-\w.]+$/.test(repo)||!/^[a-f0-9]{40}$/.test(base||'')||!/^[a-f0-9]{40}$/.test(head||'')||!branch||!/^[-\w./]+$/.test(branch)||!/^[1-9]\d{0,9}$/.test(pr||''))fail('PR_EVENT_BINDING');
 git('fetch','--no-tags','origin',`refs/pull/${pr}/head`);
 if(git('rev-parse','FETCH_HEAD')!==head)fail('PR_HEAD_CHANGED_DURING_FETCH');
 git('merge-base','--is-ancestor',base,head);
 const baseSet=jsonAt(base,'.releasebridge/behavior-claims.json'),headSet=jsonAt(head,'.releasebridge/behavior-claims.json');
 const prior=verifySet(baseSet,repo,branch,{historical:true}),next=verifySet(headSet,repo,branch,{historical:true});
 assertPrefix(baseSet,headSet);
 if(baseSet.acceptance_public_key!==headSet.acceptance_public_key){
  const configured=process.env.RB_ACCEPTANCE_PUBLIC_KEY?.replace(/\\n/g,'\n');
  if(baseSet.history.length||baseSet.acceptance_public_key!==null||!configured||headSet.acceptance_public_key?.replace(/\\n/g,'\n')!==configured)fail('PRODUCT_ACCEPTANCE_KEY_CHANGED');
 }
 for(let i=baseSet.history.length;i<headSet.history.length;i++){
  const p=JSON.parse(headSet.history[i].payload);if(p.expires_at<=Math.floor(Date.now()/1000)||p.issued_at>Math.floor(Date.now()/1000)+60)fail('NEW_ACCEPTANCE_EXPIRED_OR_FUTURE');
 }
 const names=git('diff','--name-only','-z',base,head).split('\0').filter(Boolean);
 const controls=new Set(['.github/workflows/releasebridge-behavior.yml','.releasebridge/behavior-check.cjs']);
 const changedControls=names.filter(n=>controls.has(n));
 if(changedControls.length){
  const succession=next.claims.at(-1)?.k5?.consumer_successor;
  if(!succession||succession.previous_claim_head!==prior.head||succession.check_name!=='releasebridge-behavior'||!succession.files||
    succession.files['.github/workflows/releasebridge-behavior.yml']!==git('rev-parse',head+':.github/workflows/releasebridge-behavior.yml')||
    succession.files['.releasebridge/behavior-check.cjs']!==git('rev-parse',head+':.releasebridge/behavior-check.cjs'))fail('UNAUTHORIZED_CONSUMER_SUCCESSION');
 }
 // No accepted claim means infrastructure readiness only. This is never R01 PASS.
 if(!next.claims.length){if(names.includes('.releasebridge/behavior-claims.json')&&prior.claims.length)fail('EMPTY_POLICY_CANNOT_HIDE_ACCEPTED_CLAIMS');console.log('RELEASEBRIDGE_BEHAVIOR=READY_NO_ACCEPTED_CLAIMS_PROTECTION=NONE');return;}
 if(!next.claims.length||prior.claims.length&&!next.claims.length)fail('ACCEPTED_CLAIMS_MISSING');
 // Clear checkout credentials after the trusted PR-head fetch. Only verified source and signed test bytes enter the read-only bind.
 cp.spawnSync('git',['config','--local','--unset-all','http.https://github.com/.extraheader'],{cwd:process.cwd(),encoding:'utf8'});
 cp.spawnSync('git',['remote','remove','origin'],{cwd:process.cwd(),encoding:'utf8'});
 const credentialProbe=cp.spawnSync('git',['config','--local','--get-regexp','extraheader'],{cwd:process.cwd(),encoding:'utf8'});
 if(credentialProbe.status===0)fail('CHECKOUT_CREDENTIAL_NOT_CLEARED');
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'rb-behavior-input-')),inputPath=path.join(workspace,'input');fs.chmodSync(workspace,0o755);fs.mkdirSync(inputPath,{recursive:true});
 try{
  const prepared=prepareInput({root:inputPath,sourceRef:head,claims:next.claims});
  const runId='rb-'+crypto.randomBytes(16).toString('hex');
  const result=runIsolatedSuite({inputPath,testFiles:prepared.files,runId});
  const binding={schema:'RB_BEHAVIOR_SANDBOX_RESULT_V1',repo,pr,base,head,branch,claim_history_head:next.head,claims:next.claims.map(c=>({claim_id:c.claim_id,revision:c.revision,acceptance_digest:c.digest,source:c.source,k5_digest:c.k5.evidence_digest,regression_digest:c.k5.regression_digest,k4_decision_id:c.k4.decision_id})),run_id:runId,image_digest:result.image_digest,image_id:result.image_id,container_config_digest:result.container_config_digest,test_count:result.tests,output_sha256:result.logs_sha256};
  console.log('RELEASEBRIDGE_BEHAVIOR=PASS_ENFORCED_CLAIMS='+next.claims.length+' CLAIM_HEAD='+next.head+' PR='+pr+' BASE='+base+' HEAD='+head+' RESULT_BINDING_SHA256='+sha(Buffer.from(canonical(binding),'utf8')));
 }finally{try{fs.rmSync(workspace,{recursive:true,force:true});}catch{fail('ISOLATED_INPUT_CLEANUP_FAILED');}}}
if(require.main===module){try{main();}catch(e){console.error(String(e.message||e));process.exitCode=1;}}
module.exports={verifySet,assertPrefix,verifyDockerHost,verifyImage,sandboxArguments,verifyContainer,runIsolatedSuite,BEHAVIOR_IMAGE,IMAGE_DIGEST,ISOLATION_PREFLIGHT};
