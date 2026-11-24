import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInAnonymously,signOut} from 'firebase/auth';
import * as sdk from 'firebase/database';
import {defaults,applyEvent,matchView} from '../js/engine.js';

const PROJECT='demo-rival-roster';
let env,host,guest,outsider;
const code='861207';
const roomPath='rooms/'+code;
const catalog=JSON.parse(await readFile(new URL('../firebase/catalog.seed.json',import.meta.url)));
const admin=async callback=>env.withSecurityRulesDisabled(context=>callback(context.database()));
const ref=(client,path)=>sdk.ref(client.db,path);
const serverProfile=(client,name)=>({uid:client.uid,name});
async function client(name) {
  const app=initializeApp({apiKey:'demo',projectId:PROJECT,databaseURL:`https://${PROJECT}-default-rtdb.firebaseio.com`},name);
  const auth=getAuth(app);
  connectAuthEmulator(auth,'http://'+(process.env.FIREBASE_AUTH_EMULATOR_HOST||'127.0.0.1:9099'),{disableWarnings:true});
  const {user}=await signInAnonymously(auth);
  const db=sdk.getDatabase(app);
  const [hostname,port]=(process.env.FIREBASE_DATABASE_EMULATOR_HOST||'127.0.0.1:9000').split(':');
  sdk.connectDatabaseEmulator(db,hostname,Number(port));
  return {app,auth,db,uid:user.uid};
}
before(async()=>{
  env=await initializeTestEnvironment({projectId:PROJECT+'-default-rtdb',database:{host:'127.0.0.1',port:9000,rules:await readFile(new URL('../firebase/database.rules.json',import.meta.url),'utf8')}});
  await env.clearDatabase();
  await admin(db=>sdk.set(sdk.ref(db,'catalog'),catalog));
  [host,guest,outsider]=await Promise.all(['Host','Guest','Outsider'].map(client));
});
after(async()=>{
  await Promise.all([host,guest,outsider].filter(Boolean).map(async client=>{await signOut(client.auth);await deleteApp(client.app);}));
  await env?.cleanup();
});
const proposal=config=>({...defaults,...config});
async function openRoom(config={},path=roomPath) {
  await assertSucceeds(sdk.runTransaction(ref(host,path),old=>old?undefined:{
    p0:serverProfile(host,'Red'),created:sdk.serverTimestamp(),proposal:proposal(config),
  },{applyLocally:false}));
  await assertSucceeds(sdk.set(ref(guest,path+'/p1'),serverProfile(guest,'Blue')));
}
function build(config,number=0,after=-1,poolIds) {
  const size=config.size*2;
  const ids=poolIds??Object.keys(catalog).filter(id=>id===catalog[id]).slice(0,config.mode==='auction'?size+3:size);
  const match={number,after,config,count:ids.length,pool:Object.fromEntries(ids.map((id,i)=>[i,{id,i,bit:2**i}])),
    ids:Object.fromEntries(ids.map((id,i)=>[catalog[id],i]))};
  match.events=[applyEvent(match,[],'start',{actor:host.uid,side:0,now:Date.now(),recipient:0})];
  return match;
}
const append=(client,path,event,number=0)=>sdk.set(ref(client,`${path}/games/${number}/events/${event.seq}`),event);
const action=(client,match,events,kind,extra={})=>applyEvent(match,events,kind,{actor:client.uid,side:client===host?0:1,now:Date.now(),...extra});
const put=async(client,path,match,events,kind,extra)=>{
  const e=action(client,match,events,kind,extra);
  await assertSucceeds(append(client,path,e,match.number));
  events.push(e);
};
test('private room, guest and host identity, atomic draft, realtime parity, reconnect and immutable setup',async()=>{
  await openRoom();
  await assertFails(sdk.get(ref(outsider,roomPath)));
  await assertFails(sdk.set(ref(outsider,roomPath+'/p1'),serverProfile(outsider,'Third')));
  await assertFails(sdk.set(ref(guest,roomPath+'/p1'),serverProfile(guest,'Duplicate')));
  await assertFails(sdk.set(ref(guest,roomPath+'/proposal'),proposal({size:2})));
  const match=build(proposal());
  await assertFails(sdk.set(ref(host,roomPath+'/games/0'),{...match,pool:{...match.pool,1:{...match.pool[1],id:match.pool[0].id}}}));
  await assertFails(sdk.set(ref(host,roomPath+'/games/0'),{...match,config:proposal({budget:101})}));
  await assertSucceeds(sdk.set(ref(host,roomPath+'/games/0'),match));
  const first=action(host,match,match.events,'assign',{recipient:0});
  const altered={...first,s:{...first.s,n0:5}};
  await assertFails(append(host,roomPath,altered));
  await assertFails(append(guest,roomPath,{...first,actor:guest.uid}));
  const sameRevision=await Promise.allSettled([append(host,roomPath,first),append(host,roomPath,{...first,at:first.at-1})]);
  assert.equal(sameRevision.filter(result=>result.status==='fulfilled').length,1);
  const saved=(await sdk.get(ref(host,roomPath+'/games/0/events/1'))).val();
  const events=[...match.events,saved];
  await assertFails(append(host,roomPath,first));
  await assertFails(sdk.set(ref(host,roomPath+'/games/0/config/size'),4));
  const synced=new Promise(resolve=>{
    const unsub=sdk.onValue(ref(guest,roomPath+'/games/0/events/2'),snap=>{if(snap.exists()){unsub();resolve(snap.val());}});
  });
  await put(guest,roomPath,match,events,'assign',{recipient:0});
  assert.deepEqual(await synced,events.at(-1));
  sdk.goOffline(guest.db);
  sdk.goOnline(guest.db);
  const [a,b]=await Promise.all([host,guest].map(c=>sdk.get(ref(c,roomPath))));
  assert.deepEqual(a.val(),b.val());
  await put(host,roomPath,match,events,'askUndo');
  await assertFails(append(host,roomPath,{...action(guest,match,events,'undo'),actor:host.uid}));
  await put(guest,roomPath,match,events,'undo');
  assert.equal(events.at(-1).s.n0,1);
  for(let i=1;i<10;i++){
    const s=events.at(-1).s;
    const client=s.turn===0?host:guest;
    const kind=s.n0===5||s.n1===5?'autoAssign':'assign';
    await put(client,roomPath,match,events,kind,{recipient:0});
  }
  const final=matchView(events,match.pool);
  assert.deepEqual(final.teams.map(team=>team.length),[5,5]);
  assert.equal(new Set(final.teams.flat().map(card=>card.id)).size,10);
  const last=events.at(-1).seq;
  const notebook={seq:last,captain:final.teams[0][0].id,stipulation:1,matchups:'',strategy:'Counter speed',
    argument:'Control the pace',ready:true,vote:0,concluded:false};
  const debate=roomPath+'/games/0/discussion/';
  await assertFails(sdk.set(ref(host,debate+guest.uid),notebook));
  await assertFails(sdk.set(ref(host,debate+host.uid),{...notebook,seq:last-1}));
  await assertSucceeds(sdk.set(ref(host,debate+host.uid),notebook));
  assert.equal((await sdk.get(ref(guest,debate+host.uid))).val().argument,notebook.argument);
  const rematch=build(proposal({mode:'picks',size:2,snake:true,swapped:true}),1,last);
  await assertSucceeds(sdk.set(ref(host,roomPath+'/proposal'),rematch.config));
  await assertSucceeds(sdk.set(ref(host,roomPath+'/games/1'),rematch));
  await assertFails(append(host,roomPath,action(host,match,events,'askUndo')));
  for(const [card,client] of [host,guest,guest,host].entries()){
    if(card) await assertFails(append(client,roomPath,{...rematch.events.at(-1),actor:client.uid,kind:'pick',card:0,seq:card+1},1));
    await put(client,roomPath,rematch,rematch.events,'pick',{card});
  }
  assert.deepEqual(matchView(rematch.events,rematch.pool).teams.map(team=>team.length),[2,2]);
});
test('auction rules enforce server time, bid limits, race, permanent pass, reserve and settlement',async()=>{
  const path='rooms/834516';
  const config=proposal({mode:'auction',size:2,seconds:5,extension:2,manual:true});
  await openRoom(config,path);
  const match=build(config);
  await assertSucceeds(sdk.set(ref(host,path+'/games/0'),match));
  const events=[...match.events];
  const state=events[0].s;
  assert.deepEqual([state.m0,state.m1],[100,100]);
  const legal=action(host,match,events,'bid',{amount:15});
  await assertFails(append(host,path,{...legal,amount:100,s:{...legal.s,bid:100}}));
  await assertFails(append(host,path,{...legal,kind:'close'}));
  await assertFails(append(host,path,{...legal,at:Date.now()+20000}));
  const other=action(guest,match,events,'bid',{amount:16});
  const contested=await Promise.allSettled([append(host,path,legal),append(guest,path,other)]);
  assert.equal(contested.filter(result=>result.status==='fulfilled').length,1);
  const leader=(await sdk.get(ref(host,path+'/games/0/events/1'))).val();
  events.push(leader);
  await assertFails(append(host,path,legal));
  const leadClient=leader.s.leader===0?host:guest;
  const otherClient=leadClient===host?guest:host;
  await put(otherClient,path,match,events,'pass');
  const possible=events.at(-1);
  await assertFails(append(otherClient,path,{...possible,seq:possible.seq+1,kind:'bid',amount:90}));
  await put(leadClient,path,match,events,'pass');
  await put(otherClient,path,match,events,'close');
  assert.equal(events.at(-1).s[leader.s.leader===0?'m0':'m1'],100-leader.amount);
  await put(host,path,match,events,'advance');
  await put(host,path,match,events,'pass');
  await put(guest,path,match,events,'pass');
  await put(host,path,match,events,'close');
  assert.equal(events.at(-1).s.award,-1);
  await put(host,path,match,events,'advance');
  const deadline=events.at(-1).s.deadline;
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,deadline-Date.now()+20)));
  const crafted=action(host,match,events,'bid',{amount:1,now:deadline-1});
  await assertFails(append(host,path,crafted));
  await put(host,path,match,events,'close');
  while(events.at(-1).s.phase!=='done'){
    await put(host,path,match,events,'advance');
    const s=events.at(-1).s;
    if(match.count-s.round===4-s.n0-s.n1) await put(host,path,match,events,'reserve');
    else {
      if(s.n0<2) await put(host,path,match,events,'pass');
      if(s.n1<2) await put(guest,path,match,events,'pass');
      await put(host,path,match,events,'close');
    }
  }
  assert.deepEqual(matchView(events,match.pool).teams.map(team=>team.length),[2,2]);
});

test('reconciled catalog accepts new Raven and preserves a historical card reference',async()=>{
  const path='rooms/834517';
  const config=proposal({mode:'blind',size:2});
  await openRoom(config,path);
  const ids=['wrestler-raven','raven','sting--crow','alexa-bliss'];
  const match=build(config,0,-1,ids);
  await assertSucceeds(sdk.set(ref(host,path+'/games/0'),match));
  const stored=(await sdk.get(ref(guest,path+'/games/0/pool'))).val();
  assert.deepEqual(Object.values(stored).map(card=>card.id),ids);
});

test('wrestling quotas flow through Firebase and uncontested lots reveal for five seconds',async()=>{
  for(const [i,mode] of ['blind','picks','auction'].entries()) {
    const path='rooms/83453'+i;
    const config=proposal({mode,universe:'wrestling',size:2,split:'1',women:1,manual:true,first:0});
    const {women,...settings}=config;
    await openRoom(settings,path);
    const ids=['asuka','bayley','sting','kane'];
    const match=build(config,0,-1,ids);
    for(const card of Object.values(match.pool)) card.woman=card.i<2?1:0;
    const refGame=ref(host,path+'/games/0');
    await assertFails(sdk.set(refGame,{...match,pool:{...match.pool,0:{...match.pool[0],woman:0}}}));
    await assertSucceeds(sdk.set(refGame,match));
    const events=[...match.events];
    if(mode==='blind') {
      await put(host,path,match,events,'assign',{recipient:0});
      await put(guest,path,match,events,'autoAssign');
      await put(host,path,match,events,'assign',{recipient:0});
      await put(guest,path,match,events,'autoAssign');
    } else if(mode==='picks') {
      await put(host,path,match,events,'pick',{card:0});
      await put(guest,path,match,events,'pick',{card:2});
      assert.throws(()=>action(host,match,events,'pick',{card:1}));
      await put(host,path,match,events,'pick',{card:3});
      await put(guest,path,match,events,'pick',{card:1});
    } else {
      await put(host,path,match,events,'pass');
      await put(guest,path,match,events,'pass');
      await put(host,path,match,events,'close');
      await put(host,path,match,events,'advance');
      await put(host,path,match,events,'compositionAssign');
      assert.throws(()=>action(host,match,events,'advance'));
      await new Promise(resolve=>setTimeout(resolve,5100));
      await put(host,path,match,events,'advance');
      assert.equal(events.at(-1).s.phase,'auction');
    }
    assert.deepEqual([events.at(-1).s.w0,events.at(-1).s.w1],[1,1]);
  }
});
