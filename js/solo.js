import {makePool} from './characters.js';

export const soloNames = ['Your team', 'Opponent'];
export const soloModes = {wrestling:'Wrestling · Keep or Let Go', comics:'Comics · Blind Draft'};
export const soloSize = 5;

export function startSolo(catalog, universe) {
  const {pool}=makePool(catalog,{universe,mode:'blind',size:soloSize},soloSize*2);
  return {universe,ids:Object.values(pool).map(card=>card.id),teams:[[],[]],history:[],index:0};
}

export function automaticSide(game) {
  if(game.teams[0].length===soloSize) return 1;
  if(game.teams[1].length===soloSize) return 0;
  return null;
}

export function assignSolo(game, index, side) {
  if(index!==game.index||index>=game.ids.length) return false;
  const automatic=automaticSide(game);
  const recipient=automatic??side;
  if((recipient!==0&&recipient!==1)||game.teams[recipient].length>=soloSize) return false;
  const id=game.ids[index];
  game.teams[recipient].push({id});
  game.history.push({id,side:recipient,automatic:automatic!==null});
  game.index++;
  return true;
}
