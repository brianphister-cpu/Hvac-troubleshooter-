// coach.js — Next-Best-Action advisor + modal
(function(){
  const $ = (id)=>document.getElementById(id);
  function entropy(p){ const eps=1e-9; let H=0; for (const q of p){ if(q>0) H -= q*Math.log2(q+eps); } return H; }
  function softmax(scores){ const mx = Math.max(...scores); const ex = scores.map(s=>Math.exp(s-mx)); const sum = ex.reduce((a,b)=>a+b,0)||1; return ex.map(v=>v/sum); }
  function enumerateActions(){ return [
    { id:'check_airflow', label:'Measure evap airflow or increase fan 10%', targets:['Low airflow across evaporator'] },
    { id:'bleed_air', label:'Purge system for trapped air', targets:['Non-condensables (air in system)'] },
    { id:'weigh_charge', label:'Weigh charge ±4–8 oz and observe response', targets:['Undercharge (low refrigerant)','Overcharge (too much refrigerant)'] },
    { id:'txv_screen', label:'Inspect TXV screen / bulb placement', targets:['Restriction — metering device / drier','TXV underfeeding (adjust superheat)'] },
    { id:'condenser_coil', label:'Check condenser coil/fan cleanliness', targets:['Condenser airflow failure (fan out / slow)'] }
  ];}
  function expectedEntropyReduction(action, probs, labels){
    const set = new Set(action.targets||[]);
    const p0 = probs.slice();
    const improved = p0.map((p,i)=> set.has(labels[i]) ? p*1.35 : p*0.85);
    const norm = improved.reduce((a,b)=>a+b,0)||1; for(let i=0;i<improved.length;i++) improved[i]/=norm;
    const H0 = entropy(p0), H1 = entropy(improved);
    return (H0 - (0.7*H1 + 0.3*H0));
  }
  window.openCoach = function(r){
    const causes = r.ranked.length ? r.ranked : [{cause:'Insufficient data', pct:0}];
    const labels = causes.map(c=>c.cause);
    const scores = causes.map(c=>c.pct/100);
    const probs = softmax(scores);
    const ranked = enumerateActions().map(a=>({ a, gain: expectedEntropyReduction(a, probs, labels) })).sort((x,y)=>y.gain-x.gain).slice(0,3);
    const el = document.getElementById('coachContent');
    const modal = document.getElementById('coachModal');
    el.innerHTML = '<ul style="margin:0;padding-left:18px">' + ranked.map(i=>`<li><strong>${i.a.label}</strong> — info gain ${(i.gain*100).toFixed(1)}%</li>`).join('') + '</ul>';
    modal.style.display='block';
  };
})();