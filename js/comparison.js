import {labels,title} from './characters.js';

export const stipulations=['Balanced match','Survivor Series elimination','Texas Death Match','WarGames','Traditional tag team',
  'No-disqualification','Ladder match','Open battlefield','Urban combat','Preparation time allowed','Defend the target','Last team standing','No preparation time'];
const wrestling=['technical','strength','speed','endurance','hardcore','promo','star'];
const comics=['strength','speed','intelligence','combat','durability','power','teamwork'];
const mixed=['strength','speed','technique','resilience','coordination','specialty'];
const mixedLabels={technique:'Technique',resilience:'Resilience',coordination:'Coordination',specialty:'Specialty'};
const mixedMap={
  wrestling:{technique:'technical',resilience:'endurance',coordination:'promo',specialty:'hardcore'},
  comics:{technique:'combat',resilience:'durability',coordination:'teamwork',specialty:'power'},
};
const weightings=[{}, {endurance:2,teamwork:2,resilience:2},{endurance:2,hardcore:3,resilience:2,specialty:3},
  {hardcore:2,strength:2,specialty:2},{technical:2,teamwork:2,technique:2,coordination:2},{hardcore:3,specialty:3},
  {speed:3,endurance:2,resilience:2},{strength:2,power:2,specialty:2},
  {speed:2,combat:2,technique:2},{intelligence:3,technical:2,technique:2},
  {durability:2,teamwork:2,resilience:2,coordination:2},{durability:3,endurance:3,resilience:3},{speed:2,combat:2,technique:2}];
export function compare(teams,stipulation=0) {
  const cards=teams.flat();
  const unified=cards.length&&cards.every(c=>c.universe===cards[0].universe);
  const keys=unified?(cards[0].universe==='wrestling'?wrestling:comics):mixed;
  const grade=(card,key)=>card.ratings[key]??card.ratings[mixedMap[card.universe][key]];
  const stats=keys.map(key=>{
    const weight=weightings[stipulation][key]??1;
    return {key,label:labels[key]||mixedLabels[key],weight,
      values:teams.map(team=>team.reduce((sum,card)=>sum+grade(card,key),0)/Math.max(team.length,1)),
    };
  });
  const total=stats.reduce((n,s)=>n+s.weight,0);
  const scores=teams.map((_,i)=>stats.reduce((n,s)=>n+s.values[i]*s.weight,0)/total);
  const ranked=teams.map((_,i)=>[...stats].sort((a,b)=>b.values[i]-a.values[i]));
  const edges=teams.map((_,i)=>[...stats].sort((a,b)=>(b.values[i]-b.values[1-i])-(a.values[i]-a.values[1-i]))[0]);
  const rankedCards=teams.map(team=>[...team].sort((a,b)=>keys.reduce((sum,key)=>sum+grade(b,key)-grade(a,key),0)));
  return {stats,scores,ranked,edges,matchups:rankedCards[0].map((card,index)=>[card,rankedCards[1][index]]),
    winner:Math.abs(scores[0]-scores[1])<0.05?-1:(scores[0]>scores[1]?0:1)};
}
export const teamText=(teams,names)=>teams.map((team,i)=>names[i]+'\n'+team.map((c,j)=>`${j+1}. ${title(c)}`).join('\n')).join('\n\n');
export function discussionPrompt(teams,names,stip,result,discussion) {
  return `Moderate a friendly Rival Roster debate. Stipulation: ${stipulations[stip]}. Treat these as subjective game ratings.\n\n${teamText(teams,names)}\n\n`+
    teams.map((_,i)=>`${names[i]} · Score ${result.scores[i].toFixed(1)}\nCaptain: ${teams[i].find(c=>c.id===discussion[i]?.captain)?.name||'Undecided'}\nMatchups: ${discussion[i]?.matchups||'None'}\nStrategy: ${discussion[i]?.strategy||'None'}\nArgument: ${discussion[i]?.argument||'None'}`).join('\n\n')+
    '\n\nCompare strengths, matchup counters and plausible winning strategies for both teams. Explain assumptions and invite disagreements.\n\n'+
    result.stats.map(row=>`${row.label} (weight ${row.weight}): ${row.values.map(x=>x.toFixed(1)).join(' vs ')}`).join('\n');
}
