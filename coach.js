// coach.js — Next-Best-Action advisor + modal (modal open + idempotent close handled in app core)
(function(){
  const $ = (id)=>document.getElementById(id);
  function entropy(p){ const eps=1e-9; let H=0; for (const q of p){ if(q>0) H -= q*Math.log2(q+eps); } return H; }
  function softmax(scores){ const mx = Math.max(...scores); const ex = scores.map(s=>Math.exp(s-mx)); const sum = ex.reduce((a,b)=>a+b,0)||1; return ex.map(v=>v/sum); }
  function enumerateActions(){ return [
    { id:'check_airflow', label:'Measure evap airflow (CFM) or increase fan 10%', targets:['Low airflow across evaporator','Condenser airflow failure (fan out / slow)'] },
    { id:'bleed_air', label:'Crack Schrader / purge test for trapped air', targets:['Non-condensables (air in system)','Overcharge (too much refrigerant)'] },
    { id:'weigh_charge', label:'Recover/Weigh charge delta 4–8 oz and observe SH/SC response', targets:['Undercharge (low refrigerant)','Overcharge (too much refrigerant)','Restriction — metering device / drier'] },
    { id:'txv_screen', label:'Inspect TXV inlet screen / bulb placement', targets:['Restriction — metering device / drier','TXV underfeeding (adjust superheat)','TXV overfeeding (adjust superheat)'] },
    { id:'condenser_coil', label:'Measure CTOA & check condenser fan/coil cleanliness', targets:['Condenser airflow failure (fan out / slow)','Non-condensables (air in system)'] },
    { id:'amps', label:'Measure compressor/fan amps vs nameplate', targets:['Compressor mechanical issue (valves/leak)','Condenser airflow failure (fan out / slow)'] },
  ];}
  function expectedEntropyReduction(action, probs, labels){
    const set = new Set(action.targets||[]);
    const p0 = probs.slice();
    const improved = p0.map((p,i)=> set.has(labels[i]) ? p*1.35 : p*0.85);
    const norm = improved.reduce((a,b)=>a+b,0)||1; for(let i=0;i<improved.length;i++) improved[i]/=norm;
    const H0 = entropy(p0);
    const H1 = entropy(improved);
    return (H0 - (0.7*H1 + 0.3*H0));
  }
  window.openCoach = function(r, d){
    const causes = r.ranked.length ? r.ranked : [{cause:'Insufficient data', pct:0}];
    const labels = causes.map(c=>c.cause);
    const scores = causes.map(c=>c.pct/100);
    const probs = (function(){ const mx=Math.max(...scores); const ex=scores.map(s=>Math.exp(s-mx)); const s=ex.reduce((a,b)=>a+b,0)||1; return ex.map(v=>v/s); })();
    const ranked = enumerateActions().map(a=>({ a, gain: expectedEntropyReduction(a, probs, labels) })).sort((x,y)=>y.gain-x.gain).slice(0,3);
    const el = document.getElementById('coachContent');
    const modal = document.getElementById('coachModal');
    if (el && modal){
      el.innerHTML = '<div style=\"font-weight:800;margin-bottom:6px\">Next‑Best‑Action Coach</div><ul style=\"margin:0;padding-left:18px\">' +
        ranked.map(i=>`<li><strong>${i.a.label}</strong> — info gain: ${(i.gain*100).toFixed(1)}%</li>`).join('') + '</ul>';
      modal.style.display='block';
    } else {
      alert('Coach:\n' + ranked.map(i=>`• ${i.a.label} — IG ${(i.gain*100).toFixed(1)}%`).join('\n'));
    }
  };
})();