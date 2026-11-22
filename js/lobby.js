import {applyEvent, defaults,LIMIT} from './engine.js';
import {makePool, randomSide,shuffle} from './characters.js';

export const listEvents = match => Object.values(match?.events||{}).sort((a,b)=>a.seq-b.seq);
export const latestMatch = room => Object.values(room?.games||{}).sort((a,b)=>a.number-b.number).at(-1);
const cleanName=name=>name.trim().replace(/\s+/g,' ').slice(0,28);
const roomPath=code=>'rooms/'+code;

export async function createRoom(api,name,mode) {
  const profile={uid:api.uid,name:cleanName(name)};
  for(let i=0;i<8;i++) {
    const raw=crypto.getRandomValues(new Uint32Array(1))[0];
    if (raw>=4294900000) continue;
    const code=String(raw%1000000).padStart(6,'0');
    const location=api.ref(api.db,roomPath(code));
    try {
      const result=await api.runTransaction(location,old=>old?undefined:{
        p0:profile,proposal:{...defaults,mode},created:api.serverTimestamp(),
      },{applyLocally:false});
      if(result.committed) return code;
    } catch(error) {
      if(!String(error.code||error.message).toLowerCase().includes('permission')) throw error;
    }
  }
  throw new Error('Could not reserve a room code. Try again.');
}
export async function joinRoom(api,code,name) {
  if(!/^\d{6}$/.test(code)) throw new Error('Enter a six-digit room code.');
  const base=api.ref(api.db,roomPath(code));
  try {
    const known=(await api.get(base)).val();
    if(known?.p0?.uid===api.uid||known?.p1?.uid===api.uid) return code;
    if(!known) throw new Error('This room code does not exist.');
  } catch(error) {
    if(!String(error.code||error.message).toLowerCase().includes('permission')) throw error;
  }
  try {
    await api.set(api.child(base,'p1'),{uid:api.uid,name:cleanName(name)});
    return code;
  } catch (error) {
    if(!String(error.code||error.message).toLowerCase().includes('permission')) throw error;
    const retry=await api.get(base).catch(()=>null);
    if(retry?.val()?.p1?.uid===api.uid) return code;
    throw new Error('This room is full or unavailable.');
  }
}
export function watchRoom(api,code,onRoom,onConnection,onError) {
  const base=api.ref(api.db,roomPath(code));
  const session=api.child(base,`presence/${api.uid}/${crypto.randomUUID()}`);
  let ended=false;
  const stopRoom=api.onValue(base,snap=>onRoom(snap.val()),onError);
  const stopConnected=api.onValue(api.ref(api.db,'.info/connected'),async snap=>{
    onConnection({connected:snap.val()===true});
    if (!snap.val()||ended) return;
    try {
      await api.onDisconnect(session).remove();
      if (!ended) await api.set(session,api.serverTimestamp());
    } catch(error) { if(!ended) onError(error); }
  });
  const stopOffset=api.onValue(api.ref(api.db,'.info/serverTimeOffset'),snap=>onConnection({offset:snap.val()||0}));
  return ()=>{
    ended=true;
    stopRoom();stopConnected();stopOffset();
    api.remove(session).catch(()=>{});
  };
}
export async function startMatch(api,code,room,cards,now) {
  const previous=latestMatch(room);
  const before=listEvents(previous).at(-1);
  const config=room.proposal;
  const match={number:previous?previous.number+1:0,after:before?.seq??-1,config,...makePool(cards,config,LIMIT)};
  const first=config.first===-1?randomSide():config.first;
  match.events={'0':applyEvent(match,[],'start',{actor:api.uid,side:0,now,recipient:first})};
  await api.set(api.ref(api.db,`${roomPath(code)}/games/${match.number}`),match);
}
export const saveProposal=(api,code,proposal)=>api.set(api.ref(api.db,roomPath(code)+'/proposal'),proposal);
export async function submit(api,code,match,kind,options) {
  const events=listEvents(match);
  const event=applyEvent(match,events,kind,{...options,actor:api.uid});
  const ref=api.ref(api.db,`${roomPath(code)}/games/${match.number}/events/${event.seq}`);
  const result=await api.runTransaction(ref,existing=>existing?undefined:event,{applyLocally:false});
  if(!result.committed) throw new Error('The room advanced first. Use the latest controls.');
}
export const saveDiscussion=(api,code,match,discussion)=>api.set(api.ref(api.db,`${roomPath(code)}/games/${match.number}/discussion/${api.uid}`),{...discussion,seq:listEvents(match).at(-1).seq});
