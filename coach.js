// coach.js — Next-Best-Action advisor + Smart Replay/Compare helpers
(function(){
  const $ = (id)=>document.getElementById(id);
  const HIST_KEY='hvac_hist_v7_4b';

  // --- Simple stats helpers ---
  const n = (v)=> (v==null||isNaN(Number(v)))?null:Number(v);
  const slope = (arr)=>{
    const xs = arr.map(v=>n(v)).filter(v=>v!=null);
    if (xs.length<2) return 0;
    let s=0,c=0; for (let i=1;i<xs.length;i++){ s += xs[i]-xs[i-1]; c++; }
    return s/Math.max(1,c);
  };
  const variance = (arr)=>{
    const xs=arr.map(v=>n(v)).filter(v=>v!=null); if(xs.length<2) return 0;
    const m=xs.reduce((a,b)=>a+b,0)/xs.length; return xs.reduce((a,b)=>a+(b-m)*(b-m),0)/xs.length;
  };

  // Trend analyzer (shared with core)
  function analyzeTrends(caseId, getCaseSeries, computeCTOA){
    const rows = getCaseSeries(caseId);
    if (!rows || rows.length < 2) return { advisories: [], nudges: {} };

    const sh = rows.map(x=>x.superheat);
    const sc = rows.map(x=>x.subcool);
    const sp = rows.map(x=>x.suctionP);
    const hp = rows.map(x=>x.liquidP);
    const cs = rows.map(x=>x.condSat);
    const oat= rows.map(x=>x.outdoorDb);
    const dt = rows.map(x=>x.deltaT);
    const ctoa = rows.map((x,i)=> computeCTOA(cs[i], oat[i]));

    const d_head   = slope(hp);
    const d_suction= slope(sp);
    const d_SH     = slope(sh);
    const d_SC     = slope(sc);
    const d_CTOA   = slope(ctoa);
    const d_DT     = slope(dt);
    const var_SH   = variance(sh);
    const var_SC   = variance(sc);

    const adv = [];
    const nudges = {}; const bump = (k,v)=>{ nudges[k]=(nudges[k]||0)+v; };

    const psigRiseFast = d_head >= 40;
    const psigFallBoth = (d_head <= -20 && d_suction <= -8);
    const flat = (x, tol)=> Math.abs(x) <= tol;

    if (psigRiseFast && flat(d_SH,2) && flat(d_SC,2)) {
      adv.push("Head rising rapidly while SH/SC flat → suspect non-condensables. Purge/evacuate & weigh in.");
      bump('Non-condensables (air in system)', 16);
      bump('Condenser airflow failure (fan out / slow)', 6);
    }
    if (psigRiseFast && d_SC >= 2 && d_CTOA >= 3) {
      adv.push("Head & SC rising; CTOA widening → condenser airflow failure (fan/coil).");
      bump('Condenser airflow failure (fan out / slow)', 16);
    }
    if (psigFallBoth && d_SC <= -1.5 && d_SH >= 1.5) {
      adv.push("Both sides falling; SC↓ and SH↑ → undercharge trend.");
      bump('Undercharge (low refrigerant)', 14);
    }
    if (d_SH >= 2 && d_SC >= 1.5 && Math.abs(d_head) < 15) {
      adv.push("SH↑ and SC↑ while head ~stable → restriction (drier/LL) likely.");
      bump('Restriction — metering device / drier', 14);
    }
    const anyHighDT = dt.some(v=> v!=null && v>28);
    if (anyHighDT || d_DT >= 3) {
      adv.push("ΔT high/increasing without suction recovery → low evap airflow.");
      bump('Low airflow across evaporator', 10);
    }
    const anyHighSuction = sp.some(v=> v!=null && v>160);
    const headNotRising = d_head <= 0;
    if (anyHighSuction && headNotRising) {
      adv.push("High suction with flat/falling head → compressor valve leakage suspected.");
      bump('Compressor mechanical issue (valves/leak)', 14);
    }
    const shRange = (()=>{ const xs=sh.filter(v=>v!=null); return xs.length? (Math.max(...xs)-Math.min(...xs)) : 0; })();
    const scRange = (()=>{ const xs=sc.filter(v=>v!=null); return xs.length? (Math.max(...xs)-Math.min(...xs)) : 0; })();
    const pressuresStable = Math.abs(d_head) < 15 && Math.abs(d_suction) < 5;
    if (pressuresStable && (shRange >= 10 || scRange >= 10)) {
      adv.push("SH/SC unstable without matching pressure change → mixed refrigerant/contamination or TXV hunting.");
      bump('Mixed refrigerant / contamination', 12);
    }

    // Clamp total nudge
    let total = 0; for (const k in nudges) total += Math.abs(nudges[k]||0);
    if (total > 36){
      const scale = 36/total;
      for (const k in nudges) nudges[k] = Math.round(nudges[k]*scale);
    }

    return { advisories: adv, nudges };
  }

  // Compare modal table
  function renderCompareTable(caseId){
    const rows = JSON.parse(localStorage.getItem(HIST_KEY)||'[]').filter(x=>x.caseId===caseId).slice(0,50).reverse();
    const el = document.getElementById('compareContent');
    if (!rows.length){ el.innerHTML = '<em>No snapshots for this case yet.</em>'; return; }
    const tr = rows.map(x=>{
      const ctoa = (x.condSat!=null && x.outdoorDb!=null) ? Math.round((x.condSat - x.outdoorDb)*10)/10 : null;
      return `<tr>
        <td>${x.snapshotLabel||''}</td>
        <td>${x.time||''}</td>
        <td>${x.superheat??'—'}</td>
        <td>${x.subcool??'—'}</td>
        <td>${x.suctionP??'—'}</td>
        <td>${x.liquidP??'—'}</td>
        <td>${x.condSat??'—'}</td>
        <td>${x.outdoorDb??'—'}</td>
        <td>${ctoa??'—'}</td>
        <td>${x.actualDiagnosis || x.suggestedDiagnosis || ''}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `<div style="overflow:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="text-align:left;border-bottom:1px solid #e5eef8">
            <th>Snap</th><th>Time</th><th>SH (°F)</th><th>SC (°F)</th>
            <th>SP (psig)</th><th>HP (psig)</th><th>CondSat (°F)</th><th>OAT (°F)</th><th>CTOA (°F)</th><th>Diagnosis</th>
          </tr>
        </thead>
        <tbody>${tr}</tbody>
      </table></div>`;
  }

  // Smart Replay (reuse chart lib from index)
  let replayChart=null, replayTimer=null, replayIndex=0;
  function openReplay(){
    const modal = document.getElementById('replayModal');
    if (!modal) return;
    modal.style.display='block';
    const cid = (document.getElementById('caseId')||{}).value || (JSON.parse(localStorage.getItem(HIST_KEY)||'[]')[0]?.caseId) || '';
    document.getElementById('replayCase').value = cid;
    drawReplay(cid, true);
    const play = document.getElementById('replayPlay');
    const pause= document.getElementById('replayPause');
    const load = document.getElementById('replayLoad');
    const speed= document.getElementById('replaySpeed');
    const scrub= document.getElementById('replayScrub');
    load.onclick = ()=> drawReplay(document.getElementById('replayCase').value, true);
    play.onclick = ()=> startReplay(document.getElementById('replayCase').value, Number(speed.value||'1'));
    pause.onclick = ()=> stopReplay();
    scrub.oninput = ()=> scrubReplay(document.getElementById('replayCase').value, Number(scrub.value||'0'));
  }
  function closeReplay(){
    stopReplay();
    const modal = document.getElementById('replayModal');
    if (modal) modal.style.display='none';
  }
  function drawReplay(caseId, init=false){
    const rows = JSON.parse(localStorage.getItem(HIST_KEY)||'[]').filter(x=>x.caseId===caseId).slice(0,50).reverse();
    if (!rows.length){ alert('No snapshots for this Case ID.'); return; }
    const labels = rows.map(x=>x.snapshotLabel || (x.time||'').split(',')[0] || '');
    const series = {
      sh: rows.map(x=>x.superheat??null),
      sc: rows.map(x=>x.subcool??null),
      sp: rows.map(x=>x.suctionP??null),
      hp: rows.map(x=>x.liquidP??null),
      cs: rows.map(x=>x.condSat??null),
      dt: rows.map(x=>x.deltaT??null),
      ctoa: rows.map(x=> (x.condSat!=null && x.outdoorDb!=null) ? (x.condSat - x.outdoorDb) : null )
    };
    const ctx = document.getElementById('replayChart');
    if (replayChart) replayChart.destroy();
    replayChart = new Chart(ctx, {
      type:'line',
      data:{
        labels, datasets:[
          {label:'Superheat (°F)', data: series.sh, yAxisID:'y'},
          {label:'Subcool (°F)',  data: series.sc, yAxisID:'y'},
          {label:'Suction P (psig)', data: series.sp, yAxisID:'y1'},
          {label:'Head P (psig)', data: series.hp, yAxisID:'y1'},
          {label:'Cond Sat (°F)', data: series.cs, yAxisID:'y'},
          {label:'ΔT (°F)', data: series.dt, yAxisID:'y'},
          {label:'CTOA (°F)', data: series.ctoa, yAxisID:'y'}
        ]
      },
      options:{ responsive:true, maintainAspectRatio:false, animation:false, interaction:{mode:'index',intersect:false},
        scales:{ y:{position:'left', title:{display:true, text:'°F'}}, y1:{position:'right', grid:{drawOnChartArea:false}, title:{display:true, text:'psig'}} } }
    });
    if (init){ replayIndex=1; document.getElementById('replayScrub').value=0; }
  }
  function startReplay(caseId, speed){
    stopReplay();
    const rows = JSON.parse(localStorage.getItem(HIST_KEY)||'[]').filter(x=>x.caseId===caseId).slice(0,50).reverse();
    if (!rows.length) return;
    const labels = rows.map(x=>x.snapshotLabel||'');
    function frame(){
      const n = Math.min(labels.length, replayIndex);
      document.getElementById('replayScrub').value = Math.round((n-1)/(labels.length-1)*100);
      replayIndex++;
      if (replayIndex > labels.length){ stopReplay(); return; }
      drawReplay(caseId, false);
    }
    replayTimer = setInterval(frame, 900/Math.max(1, speed));
  }
  function stopReplay(){ if (replayTimer){ clearInterval(replayTimer); replayTimer=null; } }
  function scrubReplay(caseId, pct){
    const rows = JSON.parse(localStorage.getItem(HIST_KEY)||'[]').filter(x=>x.caseId===caseId).slice(0,50).reverse();
    if (!rows.length) return;
    const labels = rows.map(x=>x.snapshotLabel||'');
    replayIndex = Math.max(1, Math.round(1 + (pct/100)*(labels.length-1)));
    drawReplay(caseId, false);
  }

  // ---- Coach (Next-Best-Action) ----
  function entropy(p){ const eps=1e-9; let H=0; for (const q of p){ if(q>0) H -= q*Math.log2(q+eps); } return H; }
  function softmax(scores){
    const mx = Math.max(...scores);
    const ex = scores.map(s=>Math.exp(s-mx));
    const sum = ex.reduce((a,b)=>a+b,0)||1;
    return ex.map(v=>v/sum);
  }

  function enumerateActions(r, d){
    // Candidate next actions with simple outcome models keyed to common discriminators
    return [
      { id:'check_airflow', label:'Measure evap airflow (CFM) or increase fan 10%', targets:['Low airflow across evaporator','Condenser airflow failure (fan out / slow)'] },
      { id:'bleed_air', label:'Crack Schrader / purge test for trapped air', targets:['Non-condensables (air in system)','Overcharge (too much refrigerant)'] },
      { id:'weigh_charge', label:'Recover/Weigh charge delta 4–8 oz and observe SH/SC response', targets:['Undercharge (low refrigerant)','Overcharge (too much refrigerant)','Restriction — metering device / drier'] },
      { id:'txv_screen', label:'Inspect TXV inlet screen / bulb placement', targets:['Restriction — metering device / drier','TXV underfeeding (adjust superheat)','TXV overfeeding (adjust superheat)'] },
      { id:'condenser_coil', label:'Measure CTOA & check condenser fan/coil cleanliness', targets:['Condenser airflow failure (fan out / slow)','Non-condensables (air in system)'] },
      { id:'amps', label:'Measure compressor/fan amps vs nameplate', targets:['Compressor mechanical issue (valves/leak)','Condenser airflow failure (fan out / slow)'] },
    ];
  }

  function expectedEntropyReduction(action, probs){
    // Very light heuristic: assume action splits its target faults more sharply
    // We simulate outcome branches: A improves separation (70%) or is inconclusive (30%)
    const targetSet = new Set(action.targets||[]);
    const p0 = probs.slice();
    const branchImproved = p0.map((p,i)=> targetSet.has(probs._labels[i]) ? p*1.35 : p*0.85);
    const norm = branchImproved.reduce((a,b)=>a+b,0)||1; for(let i=0;i<branchImproved.length;i++) branchImproved[i]/=norm;
    const H0 = entropy(p0);
    const H1 = entropy(branchImproved);
    // Expectation: 0.7 improved, 0.3 no change
    return (H0 - (0.7*H1 + 0.3*H0));
  }

  function openCoach(r, d, getSeries){
    const causes = r.ranked.length ? r.ranked : [{cause:'Insufficient data', pct:0}];
    const labels = causes.map(c=>c.cause);
    const scores = causes.map(c=>c.pct/100);
    const probs = softmax(scores);
    probs._labels = labels;

    const actions = enumerateActions(r, d);
    const ranked = actions.map(a=>({ a, gain: expectedEntropyReduction(a, probs) }))
                          .sort((x,y)=>y.gain-x.gain).slice(0,3);

    const ul = document.createElement('ul'); ul.style.margin='0'; ul.style.paddingLeft='18px';
    ranked.forEach(item=>{
      const li = document.createElement('li');
      li.innerHTML = `<strong>${item.a.label}</strong> — info gain: ${(item.gain*100).toFixed(1)}%`;
      ul.appendChild(li);
    });

    const wrap = document.createElement('div');
    wrap.innerHTML = `<div style="font-weight:800;margin-bottom:6px">Next‑Best‑Action Coach</div>`;
    wrap.appendChild(ul);

    const why = document.getElementById('whyContent');
    if (why){
      why.innerHTML = wrap.outerHTML;
      const modal = document.getElementById('whyModal');
      modal.style.display='block';
    } else {
      alert('Coach:\n\n' + ranked.map(i=>`• ${i.a.label} — IG ${(i.gain*100).toFixed(1)}%`).join('\n'));
    }
  }

  // expose
  window.analyzeTrends = analyzeTrends;
  window.renderCompareTable = renderCompareTable;
  window.openReplay = openReplay;
  window.closeReplay = closeReplay;
  window.openCoach = openCoach;
})();