import {readFileSync,writeFileSync} from 'node:fs';
import {LIMIT,defaults,fields,compositionFields,moves,expressions,initial,initialAllowed} from '../js/engine.js';

const and = (...p) => '('+p.join(' && ')+')';
const or = (...p) => '('+p.join(' || ')+')';
const value = (base,key) => `${base}.child(${JSON.stringify(key)}).val()`;
const children = (base,keys) => `${base}.hasChildren(${JSON.stringify(keys)})`;
const number = (base,min,max) => and(`${base}.isNumber()`,`${base}.val() % 1 === 0`,`${base}.val() >= ${min}`,`${base}.val() <= ${max}`);
const str = (base,max) => and(`${base}.isString()`,`${base}.val().length <= ${max}`);
const options = (base,...values) => or(...values.map(v=>`${base}.val() === ${JSON.stringify(v)}`));
const schema = (keys, validators={}) => ({...Object.fromEntries(keys.map(key=>[key,{'.validate':validators[key]||true}])),$other:{'.validate':false}});
const uid0 = "root.child('rooms').child($room).child('p0').child('uid').val()";
const uid1 = "root.child('rooms').child($room).child('p1').child('uid').val()";
const player = and('auth != null',or(`auth.uid === ${uid0}`,`auth.uid === ${uid1}`));
const host = and('auth != null',`auth.uid === ${uid0}`);
const room = "root.child('rooms').child($room)";
const match = `${room}.child('games').child($game)`;
const N='newData';
const nextMatch = "newData.parent().parent()";
const following = `${room}.child('games').child((${value(match,'number')} + 1) + '')`;
const seq=value(N,'seq');
const prior = distance => `${match}.child('events').child((${seq} - ${distance}) + '')`;
const newConfig = `${nextMatch}.child('config')`;
function emit(x) {
  if (typeof x!=='object') return JSON.stringify(x);
  if (x.group==='woman') return `${nextMatch}.child('pool').child((${emit(x.key)}) + '').child('woman').val()`;
  if (x.group==='bit') return `${nextMatch}.child('pool').child((${emit(x.key)}) + '').child('bit').val()`;
  if (x.group==='state') return value(`${prior(1)}.child('s')`,x.key);
  if (x.group==='other') return value(`${prior(3)}.child('s')`,x.key);
  if (x.group==='config') return value(newConfig,x.key);
  if (x.group==='input') return value(N,x.key);
  if (x.group==='ctx') return {
    side:`(auth.uid === ${uid0} ? 0 : 1)`, actor:'auth.uid',now:'now',stamp:value(N,'at'),
    composed:`${newConfig}.child('women').exists()`,count:value(nextMatch,'count'),previousActor:value(prior(1),'actor'),previousKind:value(prior(1),'kind'),
  }[x.key];
  const terms=x.args.map(emit);
  return x.name==='?' ? `(${terms[0]} ? ${terms[1]} : ${terms[2]})` : `(${terms.join(` ${x.name} `)})`;
}
const eventKeys=['seq','kind','actor','at','card','amount','recipient','s'];
const kind = value(N,'kind');
const start = and(`${seq} === 0`,`${kind} === 'start'`,`!${match}.exists()`,host,emit(initialAllowed));
const subsequent = and(`${seq} > 0`,`${prior(1)}.exists()`,
  or(...Object.entries(moves).map(([k,move])=>and(`${kind} === '${k}'`,emit(move.when)))));
const fromStateField = field => {
  const byExpression = new Map();
  for (const [k,m] of [['start',null],...Object.entries(moves)]) {
    const expression=emit((m ? expressions(m) : initial)[field]);
    const names=byExpression.get(expression)||[];
    names.push(k);
    byExpression.set(expression,names);
  }
  const parentKind=value('newData.parent().parent()','kind');
  // Field-level validation uses the candidate event, two levels up.
  const rebase = expr => expr.replaceAll('newData','newData.parent().parent()');
  return or(...[...byExpression].map(([expr,kinds])=>and(
    or(...kinds.map(k=>`${parentKind} === '${k}'`)),`newData.val() === ${rebase(expr)}`)));
};
const event = {
  '.write':and(player,'!data.exists()','newData.exists()',`${match}.exists()`,`!${following}.exists()`),
  '.validate':and(children(N,eventKeys),`$seq === ${seq} + ''`,`${value(N,'actor')} === auth.uid`,
    `${value(N,'at')} >= now - 2000`,`${value(N,'at')} <= now + 1000`,or(start,subsequent)),
  ...schema(eventKeys,{
    seq:number(N,0,4000), at:number(N,0,9e15), card:number(N,-1,LIMIT-1),amount:number(N,0,1000),recipient:number(N,-1,1),
  }),
  s:{'.validate':and(children(N,fields),or(
    "newData.parent().parent().parent().child('config').child('women').exists() === false",
    children(N,compositionFields))),
    ...schema([...fields,...compositionFields],Object.fromEntries([...fields,...compositionFields].map(f=>[f,fromStateField(f)])))},

};
const ck=Object.keys(defaults);
const configValidators={
  mode:options(N,'blind','picks','auction'), size:number(N,1,8),first:number(N,-1,1),
  pickTime:or(options(N,0),number(N,5,120)), budget:number(N,1,1000),
  minimum:number(N,1,100), increment:number(N,1,100),seconds:number(N,5,120),extension:number(N,0,30),
  universe:options(N,'wrestling','comics','mixed','custom'),filters:str(N,400),exclude:str(N,4000),custom:str(N,4000),
  ...Object.fromEntries(['snake','manual','nominate','versions','swapped'].map(k=>[k,'newData.isBoolean()'])),
};
const configRule=(extra=[],matchConfig=false)=>({
  '.validate':and(children(N,ck),`${value(N,'budget')} >= ${value(N,'minimum')} * ${value(N,'size')}`,
    `${value(N,'extension')} <= ${value(N,'seconds')}`,...extra),
  ...schema([...ck,'split',...(matchConfig?['women']:[])],{...configValidators,women:number(N,0,4),
    split:and("newData.parent().child('universe').val() === 'wrestling'",options(N,'men','women','random','1','2','3','4'))}),
});
const previousGame=`${room}.child('games').child((${value(N,'number')} - 1) + '')`;
const previousLast=`${previousGame}.child('events').child(${value(N,'after')} + '')`;
const configAt = "newData.parent().parent().child('config')";
const poolIndex = value(N,'i');
const poolId = value(N,'id');
const catalogIdentity = `root.child('catalog').child(${poolId}).val()`;
const identity = `(${value(configAt,'versions')} === true ? ${poolId} : ${catalogIdentity})`;
const roster=JSON.parse(readFileSync(new URL('../tools/wrestlers.json',import.meta.url)));
const idsFor=division=>roster.filter(c=>c.division===division).map(c=>c.id).join('|');
const womenIds=idsFor('women'), menIds=idsFor('men');
const gameConfig="newData.child('config')";
const resolved=value(gameConfig,'women'), gameSize=value(gameConfig,'size'), split=value(gameConfig,'split');
const hasComposition=`${gameConfig}.child('women').exists()`;
const mixedComposition=and(`${resolved} > 0`,`${resolved} < ${gameSize}`);
const splitMatches=or(and(`${split} === 'men'`,`${resolved} === 0`),
  and(`${split} === 'women'`,`${resolved} === ${gameSize}`),
  and(mixedComposition,or(`${split} === 'random'`,`${split} === ${resolved} + ''`)));
const womenInPool=Array.from({length:LIMIT},(_,i)=>
  `(newData.child('pool').child('${i}').child('woman').val() === 1 ? 1 : 0)`).join(' + ');
const validComposition=or(and(`!${hasComposition}`,`${split} === null`),
  and(hasComposition,splitMatches,or(
    and(mixedComposition,`${value(N,'count')} === ${gameSize} * 2`,`(${womenInPool}) === ${resolved} * 2`),
    `!${mixedComposition}`)));
const poolWoman=value(N,'woman');
const correctDivision=or(
  and(`! ${configAt}.child('women').exists()`,`${poolWoman} === null`),
  and(`${configAt}.child('women').exists()`,or(
    and(`${poolWoman} === 1`,`${value(configAt,'women')} > 0`,`${poolId}.matches(/^(${womenIds})$/)`),
    and(`${poolWoman} === 0`,`${value(configAt,'women')} < ${value(configAt,'size')}`,`${poolId}.matches(/^(${menIds})$/)`))));
const gameKeys=['number','after','count','config','pool','ids','events'];
const debateKeys=['seq','captain','stipulation','matchups','strategy','argument','ready','vote','concluded'];
const debateSeq=value(N,'seq');
const debateEvent=`${match}.child('events').child(${debateSeq} + '')`;
const nextDebateEvent=`${match}.child('events').child((${debateSeq} + 1) + '')`;
const game = {
  '.write':and(host,'!data.exists()','newData.exists()',`${room}.child('p1').exists()`),
  '.validate':and(children(N,gameKeys),`$game === ${value(N,'number')} + ''`,
    or(and(`$game === '0'`,`${value(N,'after')} === -1`),
      and(`${previousLast}.exists()`,or(...['done','reset'].map(p=>`${value(`${previousLast}.child('s')`,'phase')} === '${p}'`)),
        `!${previousGame}.child('events').child((${value(N,'after')} + 1) + '').exists()`)),
    `${value(N,'count')} >= ${value("newData.child('config')",'size')} * 2`,validComposition,
    or(`${value("newData.child('config')",'mode')} !== 'blind'`,`${value(N,'count')} === ${value("newData.child('config')",'size')} * 2`)),
  ...schema(gameKeys,{number:number(N,0,1000),after:number(N,-1,4000),count:number(N,2,LIMIT)}),
  config:configRule([...ck,'split'].map(k=>`${value(N,k)} === ${value(`${room}.child('proposal')`,k)}`),true),
  pool:{
    '.validate':and(...Array.from({length:LIMIT},(_,i)=>or(`newData.parent().child('count').val() <= ${i}`,`newData.child('${i}').exists()`))),
    $index:{
      '.validate':and(children(N,['i','id','bit']),correctDivision,`$index === ${poolIndex} + ''`,`${poolIndex} < newData.parent().parent().child('count').val()`,
        `root.child('catalog').child(${poolId}).isString()`,`newData.parent().parent().child('ids').child(${identity}).val() === ${poolIndex}`,
        or(...Array.from({length:LIMIT},(_,i)=>and(`${poolIndex} === ${i}`,`${value(N,'bit')} === ${2**i}`)))),
      ...schema(['i','id','bit','woman'],{i:number(N,0,LIMIT-1),id:and(str(N,80),"newData.val().matches(/^[a-z0-9-]+$/)")}),
    },
  },
  ids:{$identity:{'.validate':and(number(N,0,LIMIT-1),`newData.parent().parent().child('pool').child(newData.val() + '').exists()`)}},
  events:{'.validate':"newData.child('0').exists()",$seq:event},
  discussion:{
    $uid:{
      '.write':and(player,'auth.uid === $uid','newData.exists()',`${match}.exists()`,`!${following}.exists()`),
      '.validate':and('auth.uid === $uid',children(N,debateKeys),
        `${value(`${debateEvent}.child('s')`,'phase')} === 'done'`,`!${nextDebateEvent}.exists()`),
      ...schema(debateKeys,{
        seq:number(N,1,4000),
        captain:str(N,80),stipulation:number(N,0,12),matchups:str(N,240),strategy:str(N,500),argument:str(N,600),
        ready:'newData.isBoolean()', vote:number(N,-1,1),concluded:'newData.isBoolean()',
      }),
    },
  },
};
const profile = {
  '.validate':and(children(N,['uid','name']),`${value(N,'uid')} === auth.uid`),
  ...schema(['uid','name'],{name:and(str(N,28),'newData.val().length >= 1')}),
};
const rules={rules:{
  '.read':false,'.write':false,
  catalog:{'.read':'auth != null'},
  '.info':{},
  rooms:{$room:{
    '.read':and('auth != null',or('!data.exists()',player)),
    '.write':and('auth != null','!data.exists()','newData.exists()',"$room.matches(/^[0-9]{6}$/)","!newData.hasChild('p1')","!newData.hasChild('games')","!newData.hasChild('presence')"),
    '.validate':children(N,['p0','proposal','created']),
    ...schema(['p0','p1','proposal','created','games','presence'],{created:and("newData.isNumber()","newData.val() >= now - 2000","newData.val() <= now")}),
    p0:profile,
    p1:{...profile,'.write':and('auth != null',`${room}.exists()`,'!data.exists()','newData.exists()',`auth.uid !== ${uid0}`)},
    proposal:{...configRule(),'.write':and(host,'newData.exists()')},
    games:{$game:game},
    presence:{$uid:{$session:{
      '.write':and(player,'auth.uid === $uid',"$session.matches(/^[a-z0-9-]{12,80}$/)"),
      '.validate':and('newData.isNumber()','newData.val() >= now - 2000','newData.val() <= now'),
    }}},
  }},
}};
delete rules.rules['.info'];
writeFileSync(new URL('../firebase/database.rules.json',import.meta.url),JSON.stringify(rules,null,2)+'\n');
