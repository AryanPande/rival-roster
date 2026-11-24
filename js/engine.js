// A small expression tree lets the browser and Firebase evaluate the same rules.
export const LIMIT = 24;
export const defaults = Object.freeze({
  mode: 'blind', size: 5, first: -1, snake: false, pickTime: 0, budget: 100,
  minimum: 1, increment: 1, seconds: 20, extension: 5, manual: false, nominate: false,
  versions: false, swapped: false, universe: 'mixed', filters: '', exclude: '', custom: '',
});
export const configKeys = Object.keys(defaults);
export const fields = ['phase','n0','n1','m0','m1','round','turn','index','used','leader','bid','passed','deadline','award','card','price'];
export const compositionFields=['w0','w1','automatic'];
const ref = (group, key) => ({ group, key });
const state = key => ref('state', key);
const config = key => ref('config', key);
const input = key => ref('input', key);
const other = key => ref('other', key);
const ctx = key => ref('ctx', key);
const op = name => (...args) => ({ name, args });
const eq = op('==='), ne = op('!=='), gt = op('>'), lt = op('<'), ge = op('>='), le = op('<=');
const add = op('+'), sub = op('-'), mul = op('*'), mod = op('%');
const all = op('&&'), any = op('||'), choose = op('?');
const side = ctx('side'), now = ctx('now'), stamp = ctx('stamp'), count = ctx('count');
const size = config('size'), turn = state('turn'), round = state('round');
const index = state('index'), used = state('used'), phase = state('phase');
const n0 = state('n0'), n1 = state('n1'), m0 = state('m0'), m1 = state('m1');
const deadline = state('deadline'), leader = state('leader'), bid = state('bid'), passed = state('passed');
const actor = ctx('actor'), previousActor = ctx('previousActor'), previousKind = ctx('previousKind');
const card = input('card'), amount = input('amount'), recipient = input('recipient');
const gameMode = config('mode'), minimum = config('minimum');
const invert = value => sub(1, value);
const slots = target => sub(size, choose(eq(target,0),n0,n1));
const credits = target => choose(eq(target,0),m0,m1);
const occupied = target => gt(slots(target),0);
const composed=ctx('composed');
const women=config('women');
const mixed=all(composed,gt(women,0),lt(women,size));
const woman=selection=>ref('woman',selection);
const womenUsed=target=>choose(eq(target,0),state('w0'),state('w1'));
const eligible=(target,selection)=>all(occupied(target),any(eq(composed,false),
  choose(eq(woman(selection),1),lt(womenUsed(target),women),lt(sub(choose(eq(target,0),n0,n1),womenUsed(target)),sub(size,women)))));
const uncontested=all(composed,ne(eligible(0,index),eligible(1,index)));
const ignored=all(composed,eq(eligible(0,index),false),eq(eligible(1,index),false));
const tally=(target,selection)=>Object.fromEntries([0,1].map(i=>['w'+i,
  choose(all(composed,eq(target,i),eq(woman(selection),1)),add(state('w'+i),1),state('w'+i))]));

const total = add(n0,n1);
const done = eq(total,mul(size,2));
const reserve = all(eq(mixed,false),eq(sub(count,round),sub(mul(size,2),total)));
const active = any(eq(phase,'draft'),eq(phase,'auction'),eq(phase,'nominate'),eq(phase,'settled'));
const passBit = choose(eq(side,0),1,2);
const hasPassed = any(eq(passed,3),eq(passed,passBit));
const pickSpan = mul(config('pickTime'),1000);
const pickEnd = choose(gt(pickSpan,0),add(stamp,pickSpan),0);
const lotSpan = mul(config('seconds'),1000);
const lotEnd = add(stamp,lotSpan);
const open = target => choose(occupied(target),target,invert(target));
const openFor=(target,selection)=>choose(eligible(target,selection),target,invert(target));
const bit = value => ref('bit',value);
const unused = value => lt(mod(used,mul(bit(value),2)),bit(value));
const legalCard = all(ge(card,0),lt(card,count),unused(card));
const wait = any(eq(previousKind,'askUndo'),eq(previousKind,'askReset'));
const unblocked = eq(wait,false);
const finishing = eq(add(total,1),mul(size,2));
const nextTurn = choose(all(eq(gameMode,'picks'),eq(config('snake'),true),eq(mod(round,2),0)),invert(turn),choose(all(eq(gameMode,'picks'),eq(config('snake'),true)),turn,invert(turn)));
const draftDeadline = choose(finishing,0,pickEnd);
const draftAward = (target, selection) => ({
  ...tally(target,selection),
  phase:choose(finishing,'done','draft'), n0:add(n0,choose(eq(target,0),1,0)),
  n1:add(n1,choose(eq(target,1),1,0)), round:add(round,1), turn:nextTurn,
  index:choose(eq(gameMode,'blind'),add(index,1),-1), used:add(used,bit(selection)),
  deadline:draftDeadline, award:target, card:selection, price:0,
});
const startLot = selection => ({phase:'auction',index:selection,leader:-1,bid:0,passed:0,deadline:lotEnd});
const settle = (target, price, automatic=false) => ({
  ...tally(target,index), automatic,
  phase:choose(all(ge(target,0),finishing,eq(automatic,false)),'done','settled'), round:add(round,1),
  n0:add(n0,choose(eq(target,0),1,0)), n1:add(n1,choose(eq(target,1),1,0)),
  m0:sub(m0,choose(eq(target,0),price,0)), m1:sub(m1,choose(eq(target,1),price,0)),
  used:add(used,bit(index)), deadline:stamp, award:target, card:index, price,
});
const always = {};
const regular = (when, changes) => ({when:all(unblocked,when),changes});
const manualPick = all(eq(phase,'draft'),eq(side,turn),any(eq(deadline,0),lt(now,deadline)));
const timedPick = all(eq(phase,'draft'),gt(deadline,0),ge(now,deadline));
const canonicalFreePick = all(legalCard,eq(mod(used,bit(card)),sub(bit(card),1)));
const bidFloor = choose(eq(leader,-1),minimum,add(bid,config('increment')));
const undoable = ['assign','pick','autoAssign','autoPick','bid','pass','close','reserve','compositionAssign','skipIneligible','advance','nominate','autoNominate'];
export const moves = {
  assign: regular(all(manualPick,eq(gameMode,'blind'),eligible(0,index),eligible(1,index),any(eq(recipient,0),eq(recipient,1)),eligible(recipient,index)),draftAward(recipient,index)),
  autoAssign: regular(all(eq(phase,'draft'),eq(gameMode,'blind'),any(timedPick,eq(eligible(0,index),false),eq(eligible(1,index),false))),draftAward(openFor(turn,index),index)),
  pick: regular(all(manualPick,eq(gameMode,'picks'),legalCard,eligible(turn,card)),draftAward(turn,card)),
  autoPick: regular(all(timedPick,eq(gameMode,'picks'),choose(composed,legalCard,canonicalFreePick),eligible(turn,card)),draftAward(turn,card)),
  nominate: regular(all(eq(phase,'nominate'),lt(now,deadline),eq(side,open(turn)),legalCard),startLot(card)),
  autoNominate: regular(all(eq(phase,'nominate'),ge(now,deadline),canonicalFreePick),startLot(card)),
  bid: regular(all(eq(phase,'auction'),eq(reserve,false),lt(now,deadline),eq(uncontested,false),eligible(side,index),eq(hasPassed,false),
    ne(leader,side),eq(mod(amount,1),0),ge(amount,bidFloor),le(amount,sub(credits(side),mul(sub(slots(side),1),minimum)))),
    {leader:side,bid:amount,deadline:choose(lt(deadline,add(stamp,mul(config('extension'),1000))),add(stamp,mul(config('extension'),1000)),deadline)}),
  pass: regular(all(eq(phase,'auction'),eq(reserve,false),lt(now,deadline),eq(uncontested,false),eligible(side,index),eq(hasPassed,false)),{passed:add(passed,passBit)}),
  close: regular(all(eq(phase,'auction'),eq(reserve,false),eq(uncontested,false),eq(ignored,false),any(ge(now,deadline),eq(passed,3),
    all(eq(occupied(0),false),eq(passed,2)),all(eq(occupied(1),false),eq(passed,1)))),settle(choose(all(mixed,eq(leader,-1)),turn,leader),choose(all(mixed,eq(leader,-1)),minimum,bid))),
  reserve: regular(all(eq(phase,'auction'),reserve,eq(uncontested,false)),settle(open(turn),minimum)),
  compositionAssign: regular(all(eq(phase,'auction'),uncontested),settle(openFor(turn,index),minimum,true)),
  skipIneligible: regular(all(eq(phase,'auction'),ignored),settle(-1,0)),
  advance: regular(all(eq(phase,'settled'),choose(all(composed,eq(state('automatic'),true)),ge(now,add(deadline,5000)),all(eq(done,false),any(eq(config('manual'),true),ge(now,add(deadline,2100)))))),{
    phase:choose(done,'done',choose(eq(config('nominate'),true),'nominate','auction')), automatic:false,
    index:choose(eq(config('nominate'),true),-1,round),turn:invert(turn),
    leader:-1,bid:0,passed:0,deadline:lotEnd,
  }),
  askUndo: regular(all(ne(phase,'reset'),any(...undoable.map(kind=>eq(previousKind,kind)))),always),
  askReset: regular(all(active,eq(side,0)),always),
  decline: {when:all(wait,ne(actor,previousActor)),changes:always},
  withdraw: {when:all(wait,eq(actor,previousActor)),changes:always},
  undo: {when:all(eq(previousKind,'askUndo'),ne(actor,previousActor)),changes:Object.fromEntries([...fields,...compositionFields].filter(key=>!['award','card','price'].includes(key)).map(key=>[
    key,key==='deadline' ? choose(any(eq(other('phase'),'auction'),eq(other('phase'),'nominate')),lotEnd,choose(eq(other('phase'),'draft'),pickEnd,other('deadline'))) : other(key),
  ]))},
  reset: {when:all(eq(previousKind,'askReset'),ne(actor,previousActor)),changes:{phase:'reset',deadline:0}},
};
export const initial = {
  phase:choose(eq(gameMode,'auction'),choose(eq(config('nominate'),true),'nominate','auction'),'draft'),
  w0:0,w1:0,automatic:false,n0:0,n1:0,m0:config('budget'),m1:config('budget'),round:0,turn:input('recipient'),
  index:choose(any(eq(gameMode,'picks'),all(eq(gameMode,'auction'),eq(config('nominate'),true))),-1,0),
  used:0,leader:-1,bid:0,passed:0,
  deadline:choose(eq(gameMode,'auction'),lotEnd,pickEnd),
  award:-1,card:-1,price:0,
};
export const initialAllowed = all(any(eq(recipient,0),eq(recipient,1)),any(eq(config('first'),-1),eq(config('first'),recipient)));

export function expressions(move) {
  return Object.fromEntries([...fields,...compositionFields].map(key=>[key, move.changes[key] ?? ({award:-1,card:-1,price:0})[key] ?? state(key)]));
}

const operations = {
  '===':(a,b)=>a===b, '!==':(a,b)=>a!==b, '>':(a,b)=>a>b, '<':(a,b)=>a<b,
  '>=':(a,b)=>a>=b, '<=':(a,b)=>a<=b, '+':(a,b)=>a+b, '-':(a,b)=>a-b,
  '*':(a,b)=>a*b, '%':(a,b)=>a%b,
};
export function evaluate(expr, context) {
  if (typeof expr !== 'object') return expr;
  if (expr.group === 'woman') return context.pool[evaluate(expr.key,context)]?.woman;
  if (expr.group === 'bit') return 2 ** evaluate(expr.key,context);
  if (expr.group) return context[expr.group][expr.key];
  const arg = index => evaluate(expr.args[index],context);
  if (expr.name==='?') return arg(0) ? arg(1) : arg(2);
  if (expr.name==='&&') return expr.args.every((_,index)=>arg(index));
  if (expr.name==='||') return expr.args.some((_,index)=>arg(index));
  return operations[expr.name](arg(0),arg(1));
}
export function applyEvent(match, events, kind, options) {
  const previous = events.at(-1);
  const { actor, side, now } = options;
  const input = {card:options.card ?? -1, amount:options.amount ?? 0,recipient:options.recipient ?? -1};
  const context = {
    state:previous?.s,other:events.at(-3)?.s,input,config:match.config,pool:match.pool,
    ctx:{composed:Number.isInteger(match.config.women),side,actor,now,stamp:now,count:match.count,previousActor:previous?.actor,previousKind:previous?.kind},
  };
  const allowed = kind==='start' ? !previous && evaluate(initialAllowed,context) :
    previous && Object.hasOwn(moves,kind) && evaluate(moves[kind].when,context);
  if (!allowed) throw new Error('That move is unavailable. Check the latest room state.');
  const template = kind==='start' ? initial : expressions(moves[kind]);
  const s = Object.fromEntries((context.ctx.composed?[...fields,...compositionFields]:fields).map(key=>[key,evaluate(template[key],context)]));
  return {seq:previous ? previous.seq+1 : 0,kind,actor,at:now,...input,s};
}

export function matchView(events, pool) {
  const effective = [];
  for (const event of events) {
    if (event.kind==='undo') effective.pop();
    else if (!['askUndo','askReset','decline','withdraw'].includes(event.kind)) effective.push(event);
  }
  const teams = [[],[]];
  for (const event of effective) {
    if (event.s.award >= 0) {
      teams[event.s.award].push({id:pool[event.s.card]?.id, price:event.s.price});
    }
  }
  return {teams,history:effective.slice(1)};
}

export const isUsed = (used,index) => Math.floor(used / 2 ** index) % 2 === 1;
export const remainingBudget = (s,c,side) => (side===0 ? s.m0 : s.m1) - (c.size-(side===0 ? s.n0 : s.n1)-1)*c.minimum;

export function canDraftCard(match,s,side,index) {
  const total=side?s.n1:s.n0;
  if(total>=match.config.size) return false;
  if(!Number.isInteger(match.config.women)) return true;
  const women=side?s.w1:s.w0;
  return match.pool[index]?.woman===1?women<match.config.women:total-women<match.config.size-match.config.women;
}
