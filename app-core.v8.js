(() => {
  const APP_VERSION = document.getElementById('versionBadge')?.textContent || 'v8.0.0';
  const SUBPATH = '/Hvac-troubleshooter-/';
  const $ = (id)=>document.getElementById(id);
  const toNum = (v)=>{ if(v===undefined||v===null||String(v).trim()==='') return null; const n=Number(v); return isNaN(n)?null:n; };
  const round1 = (n)=> n==null?null:Math.round(n*10)/10;

  const BASE_TOL = { sh:4, sc:4, evap:4, dt:5 };
  const TARGETS = { evapSat:40, deltaT:20 };
  const HIST_KEY = 'hvac_hist_v7_4b';

  const ALL_CAUSES = [
    'System operating properly',
    'Undercharge (low refrigerant)',
    'Overcharge (too much refrigerant)',
    'Restriction — metering device / drier',
    'Low airflow across evaporator',
    'Non-condensables (air in system)',
    'Compressor mechanical issue (valves/leak)',
    'Equipment mismatch (ODU>IDU)',
    'TXV overfeeding (adjust superheat)',
    'TXV underfeeding (adjust superheat)',
    'EEV overfeeding (check control/sensors)',
    'EEV underfeeding (check control/sensors)',
    'Condenser airflow failure (fan out / slow)',
    'Reversing valve bypass (cooling)',
    'Reversing valve bypass (heating)',
    'Mixed refrigerant / contamination',
    'High SC from mild ambient (verify manufacturer target)',
    'Freeze risk / airflow marginal',
    'Heating mode: outdoor TXV restriction / underfeed',
  ];

  const PT_FALLBACK = {
    R410A:[{t:30,p:100},{t:35,p:110},{t:40,p:118},{t:45,p:130},{t:50,p:143},{t:55,p:158},{t:60,p:175}],
    R22:[{t:30,p:56},{t:35,p:61},{t:40,p:66},{t:45,p:72},{t:50,p:78},{t:55,p:85},{t:60,p:92}],
    R32:[{t:30,p:90},{t:35,p:98},{t:40,p:107},{t:45,p:117},{t:50,p:128},{t:55,p:140},{t:60,p:153}],
    R454B:[{t:30,p:88},{t:35,p:96},{t:40,p:105},{t:45,p:115},{t:50,p:126},{t:55,p:138},{t:60,p:151}]
  };
  const PT = {}; const ptMeta = {}; const PT_BADGE = $('ptBadge');
  function timeout(ms){ return new Promise((_,rej)=> setTimeout(()=>rej(new Error('timeout')),ms)); }
  async function getJSON(url){
    const res = await Promise.race([fetch(url,{cache:'reload'}), timeout(3500)]);
    if(!res || !res.ok) throw new Error('http '+(res && res.status));
    const ct = res.headers.get('content-type')||'';
    if(!ct.includes('application/json')) throw new Error('bad content-type');
    return res.json();
  }
  async function initRefrigerants(){
    const sel = $('refrig'); if(!sel) return;
    const defaults = ['R410A','R22','R32','R454B'];
    sel.innerHTML='';
    defaults.forEach(n=>{ const o=document.createElement('option'); o.value=n; o.textContent=n.replace('R','R-'); sel.appendChild(o); });
    sel.value='R410A';
    if (PT_BADGE){ PT_BADGE.textContent='PT: Fallback'; PT_BADGE.classList.add('bad'); }

    try{
      const idx = await getJSON(SUBPATH+'pt/index.json?v='+APP_VERSION);
      const names = Array.isArray(idx.refrigerants) && idx.refrigerants.length
        ? idx.refrigerants.map(x=>x.name) : defaults;
      const changed = names.join('|') !== defaults.join('|');
      if (changed){
        sel.innerHTML='';
        names.forEach(n=>{ const o=document.createElement('option'); o.value=n; o.textContent=n.replace('R','R-'); sel.appendChild(o); });
        sel.value = names.includes('R410A') ? 'R410A' : names[0];
      }
      let csvFound = false;
      for (const item of (idx.refrigerants||[])){
        try{
          const tab = await getJSON(SUBPATH+'pt/'+item.file+'?v='+APP_VERSION);
          if (tab && Array.isArray(tab.table) && tab.table.length){ PT[item.name]=tab.table; ptMeta[item.name]=item.source||'CSV'; csvFound = true; }
        } catch(e){
          const fn = item.name;
          if(PT_FALLBACK[fn]){ PT[fn]=PT_FALLBACK[fn]; ptMeta[fn]='Fallback'; }
        }
      }
      if (PT_BADGE){
        if(csvFound){ PT_BADGE.textContent='PT: CSV'; PT_BADGE.classList.remove('bad'); }
        else { PT_BADGE.textContent='PT: Fallback'; PT_BADGE.classList.add('bad'); }
      }
    }catch(e){
      defaults.forEach(n=>{ if(!PT[n]){ PT[n]=PT_FALLBACK[n]; ptMeta[n]='Fallback'; } });
      if (PT_BADGE){ PT_BADGE.textContent='PT: Fallback'; PT_BADGE.classList.add('bad'); }
    }
  }
  function tFromPsig(ref, psig){
    const tab = PT[ref] || PT_FALLBACK['R410A']; if(!tab || !tab.length || psig==null) return null;
    if(psig <= tab[0].p) return tab[0].t;
    if(psig >= tab[tab.length-1].p) return tab[tab.length-1].t;
    for(let i=0;i<tab.length-1;i++){ const a=tab[i], b=tab[i+1]; if(psig>=a.p && psig<=b.p){ const f=(psig-a.p)/(b.p-a.p); return a.t + f*(b.t-a.t); } }
    return null;
  }

  function computeConfidence(det, d, TOL){
    let score=0,max=0;
    max+=48;
    if(det.superheat!=null && d.targetSH!=null) score += Math.max(0, 28*(1 - Math.min(Math.abs(det.superheat-d.targetSH)/(TOL.sh*2),1)));
    if(det.subcool!=null && d.targetSC!=null)  score += Math.max(0, 20*(1 - Math.min(Math.abs(det.subcool -d.targetSC)/(TOL.sc*2),1)));
    max+=30;
    if(det.deltaT!=null) score += Math.max(0, 24*(1 - Math.min(Math.abs(det.deltaT-20)/(TOL.dt*2),1)));
    else score += 6;
    max+=22;
    if(det.evapSat!=null) score += Math.max(0, 16*(1 - Math.min(Math.abs(det.evapSat-40)/(TOL.evap*2),1)));
    if(det.condSat!=null) score += 6;
    let bonus=0;
    const shNear=(det.superheat!=null && d.targetSH!=null)? Math.abs(det.superheat-d.targetSH)<=Math.max(1,TOL.sh-1):false;
    const scNear=(det.subcool !=null && d.targetSC!=null)? Math.abs(det.subcool -d.targetSC)<=Math.max(1,TOL.sc-1):false;
    const dtNear=(det.deltaT !=null)? Math.abs(det.deltaT - 20)<=Math.max(2,TOL.dt-1):false;
    const evNear=(det.evapSat!=null)? Math.abs(det.evapSat - 40)<=Math.max(2,TOL.evap-1):false;
    if(shNear) bonus+=6; if(scNear) bonus+=6; if(dtNear) bonus+=8; if(evNear) bonus+=4;
    score += bonus; max += 24;
    return Math.max(0, Math.min(100, Math.round((score/max)*100)));
  }

  function loadHist(){ try{ return JSON.parse(localStorage.getItem(HIST_KEY)||'[]'); }catch(e){ return []; } }
  function saveHist(a){ localStorage.setItem(HIST_KEY, JSON.stringify(a)); }
  function getCaseSeries(caseId){
    const a=loadHist(); return a.filter(x=>x.caseId===caseId).slice(0,50).reverse();
  }
  function computeCTOA(condSat, outdoorDb){ if (condSat==null || outdoorDb==null) return null; return Math.round((condSat - outdoorDb)*10)/10; }

  function normalizeTargetsIfAny(d){
    try{
      const adj = window.normalizeTargets?.(d);
      if (adj && typeof adj==='object'){
        d.norm = adj;
      }
    }catch(e){ /* ignore */ }
  }

  function diagnoseAll(d){
    normalizeTargetsIfAny(d);

    const evapSat = tFromPsig(d.refrig, d.suctionP);
    const condSat = tFromPsig(d.refrig, d.liquidP);
    const superheat = (d.suctionT!=null && evapSat!=null)? d.suctionT - evapSat : null;
    const subcool  = (d.liquidT!=null && condSat!=null)?  condSat - d.liquidT : null;

    let deltaT = null, deltaTSource='—';
    if (d.deltaTManual!=null){ deltaT = d.deltaTManual; deltaTSource='manual'; }
    else if (d.supplyT!=null && d.returnT!=null){ deltaT = d.returnT - d.supplyT; deltaTSource='calc'; }

    const det = {
      evapSat: round1(evapSat), condSat: round1(condSat),
      superheat: superheat==null?null:round1(superheat),
      subcool: subcool==null?null:round1(subcool),
      deltaT: deltaT==null?null:round1(deltaT), deltaTSource
    };

    const causes = Object.fromEntries(ALL_CAUSES.map(k=>[k,0]));
    causes['Undercharge (low refrigerant)']=8;
    causes['Overcharge (too much refrigerant)']=6;
    causes['Restriction — metering device / drier']=6;
    causes['Low airflow across evaporator']=6;
    causes['Non-condensables (air in system)']=4;
    causes['Compressor mechanical issue (valves/leak)']=4;
    causes['Equipment mismatch (ODU>IDU)']=4;

    const rules = [];
    const othersOK = (det.subcool!=null && Math.abs(det.subcool - (d.targetSC??10)) <= BASE_TOL.sc) &&
                     (det.evapSat!=null && Math.abs(det.evapSat - 40) <= BASE_TOL.evap) &&
                     (det.deltaT==null || Math.abs(det.deltaT - (d.norm?.deltaTTarget ?? 20)) <= BASE_TOL.dt);

    // valve tuning
    if((d.systemType==='txv' || d.systemType==='eev') && det.superheat!=null && (d.targetSH!=null) && othersOK){
      const shErr = det.superheat - d.targetSH;
      if (shErr < -BASE_TOL.sh){
        rules.push('Low SH with SC/Evap/ΔT near target ⇒ overfeeding');
        causes[d.systemType==='eev' ? 'EEV overfeeding (check control/sensors)' : 'TXV overfeeding (adjust superheat)'] += 22;
      } else if (shErr > BASE_TOL.sh){
        rules.push('High SH with SC/Evap/ΔT near target ⇒ underfeeding');
        causes[d.systemType==='eev' ? 'EEV underfeeding (check control/sensors)' : 'TXV underfeeding (adjust superheat)'] += 22;
      }
    }

    // SH/SC patterns
    if(det.superheat!=null && d.targetSH!=null){
      const ds = det.superheat - d.targetSH;
      if(ds >= 6){ causes['Undercharge (low refrigerant)'] += 14; causes['Restriction — metering device / drier'] += 6; rules.push('High SH suggests underfeed/undercharge or restriction'); }
      else if(ds <= -6){ causes['Overcharge (too much refrigerant)'] += 12; causes['Restriction — metering device / drier'] += 4; rules.push('Low SH suggests overfeed/overcharge'); }
    }
    if(det.subcool!=null && d.targetSC!=null){
      const dc = det.subcool - d.targetSC;
      if(dc >= 6){ causes['Overcharge (too much refrigerant)'] += 14; causes['Restriction — metering device / drier'] += 6; rules.push('High SC suggests overcharge or condenser flooding'); }
      else if(dc <= -4){ causes['Undercharge (low refrigerant)'] += 12; rules.push('Low SC suggests undercharge or flashing'); }
    }

    // pressures
    if(d.suctionP!=null && d.liquidP!=null){
      if(d.suctionP < 105 && d.liquidP < 320){ causes['Undercharge (low refrigerant)'] += 12; rules.push('Low low-side & low high-side ⇒ likely undercharge'); }
      if(d.suctionP < 105 && d.liquidP > 380){ causes['Low airflow across evaporator'] += 10; causes['Non-condensables (air in system)'] += 8; rules.push('Low suction + high head ⇒ airflow issue or non-condensables'); }
      if(d.suctionP > 160 && d.liquidP < 330){ causes['Compressor mechanical issue (valves/leak)'] += 16; rules.push('High suction + normal/low head ⇒ compressor valves/leak'); }
      if(d.suctionP > 160 && d.liquidP > 480){ causes['Overcharge (too much refrigerant)'] += 10; causes['Non-condensables (air in system)'] += 8; rules.push('High suction + very high head ⇒ overcharge or air'); }
    }

    // deltaT with normalization
    const deltaTarget = d.norm?.deltaTTarget ?? 20;
    if(det.deltaT!=null){
      if(det.deltaT < (deltaTarget - 8)){ causes['Low airflow across evaporator'] += 18; rules.push(`ΔT < target(${deltaTarget}) ⇒ airflow/latent load issue`); }
      else if(det.deltaT > (deltaTarget + 8)){ causes['Low airflow across evaporator'] += 8; rules.push(`ΔT > target(${deltaTarget}) ⇒ check airflow / sizing`); }
    }

    // ambient cues (CTOA)
    const ctoa = computeCTOA(det.condSat, d.outdoorDb);
    if (ctoa!=null){
      if (ctoa >= 35){ causes['Overcharge (too much refrigerant)'] += 6; causes['Condenser airflow failure (fan out / slow)'] += 8; }
      if (ctoa <= 12){ causes['Undercharge (low refrigerant)'] += 6; }
    }

    // Trend advisories + score nudges (if caseId present)
    try{
      const cid = (document.getElementById('caseId')||{}).value || null;
      if (cid && window.analyzeTrends){
        const t = window.analyzeTrends(cid, getCaseSeries, computeCTOA);
        if (t && t.nudges){
          let total = 0;
          for (const k in t.nudges){ if (causes[k]!=null){ causes[k] += t.nudges[k]; total += Math.abs(t.nudges[k]||0); } }
          // clamp overall trend impact
          if (total > 36){
            const scale = 36/total;
            for (const k in t.nudges){ if (causes[k]!=null) causes[k] -= t.nudges[k]*(1-scale); }
          }
        }
      }
    }catch(e){ /* ignore trend failure */ }

    // On-device learning weighting
    try{
      if (window.predictNudges){
        const x = buildFeatureVector(d, det, ctoa);
        const ln = window.predictNudges(x);
        for (const k in ln){ if (causes[k]!=null) causes[k] += ln[k]; }
      }
    }catch(e){ /* ignore learning failure */ }

    let ranked = Object.keys(causes).map(k=>({cause:k,score:causes[k]})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    const nearOk = (det.evapSat!=null && Math.abs(det.evapSat-40)<=BASE_TOL.evap) &&
                   (det.superheat!=null && d.targetSH!=null && Math.abs(det.superheat-d.targetSH)<=BASE_TOL.sh) &&
                   (det.subcool!=null && d.targetSC!=null && Math.abs(det.subcool-d.targetSC)<=BASE_TOL.sc) &&
                   (det.deltaT==null || Math.abs(det.deltaT-(d.norm?.deltaTTarget ?? 20))<=BASE_TOL.dt);
    if (nearOk) ranked.unshift({cause:'System operating properly', score:100});
    const total = ranked.reduce((s,i)=>s+i.score,0)||1; ranked.forEach(a=>a.pct=Math.round((a.score/total)*100));
    ranked = ranked.slice(0,3);
    const conf = computeConfidence(det, d, BASE_TOL);
    const primary = ranked[0] ? {cause: ranked[0].cause, pct: conf} : {cause:'Insufficient data', pct:0};

    let valveNote = '';
    if((d.systemType==='txv' || d.systemType==='eev') && det.superheat!=null && d.targetSH!=null && othersOK){
      const shErr = det.superheat - d.targetSH;
      if (shErr < -BASE_TOL.sh){
        valveNote = (d.systemType==='eev')
          ? 'EEV likely overfeeding: verify suction temp/pressure sensors & controller setpoint; re-home stepper if needed.'
          : 'TXV likely overfeeding: reduce superheat slightly (¼–½ turn), verify bulb placement and insulation.';
      } else if (shErr > BASE_TOL.sh){
        valveNote = (d.systemType==='eev')
          ? 'EEV likely underfeeding: check sensors, look for restriction ahead of valve, verify control signal/steps.'
          : 'TXV likely underfeeding: increase superheat slightly, check inlet screen/drier restriction.';
      }
    }

    return {details:det, ranked, primary, steps:[], input:d, confNote:'', rulesFired:rules, valveNote, ctoa};
  }

  function buildFeatureVector(d, det, ctoa){
    // Compact vector for the learner
    return {
      refrig: d.refrig, systemType: d.systemType,
      idb: d.indoorDb, iwb: d.indoorWb, odb: d.outdoorDb,
      targetSH: d.targetSH, targetSC: d.targetSC,
      suctionP: d.suctionP, suctionT: d.suctionT,
      liquidP: d.liquidP, liquidT: d.liquidT,
      evapSat: det.evapSat, condSat: det.condSat,
      superheat: det.superheat, subcool: det.subcool,
      deltaT: det.deltaT, ctoa: ctoa
    };
  }

  function reasoningLines(det, d){
    const lines = [];
    if(det.evapSat!=null) lines.push(`Evap Sat: ${det.evapSat}°F (~40°F)`);
    if(det.condSat!=null) lines.push(`Cond Sat: ${det.condSat}°F`);
    if(det.superheat!=null && d.targetSH!=null) lines.push(`Superheat: ${det.superheat}°F (target ${d.targetSH}°F)`);
    if(det.subcool!=null  && d.targetSC!=null) lines.push(`Subcool: ${det.subcool}°F (target ${d.targetSC}°F)`);
    if(det.deltaT!=null) lines.push(`ΔT (${det.deltaTSource}): ${det.deltaT}°F (target ${d.norm?.deltaTTarget ?? 20}°F)`);
    if(d.norm?.badge) lines.push(d.norm.badge);
    return lines;
  }

  // ---- UI rendering ----
  function populateConfirmOptions(r){
    const sel = $('confirmSelect'); if(!sel) return;
    const keep = sel.value;
    sel.innerHTML='';
    const optBlank = document.createElement('option'); optBlank.value=''; optBlank.textContent='— Optional: Confirm diagnosis (logs to CSV) —'; sel.appendChild(optBlank);
    const seen = new Set();
    const add = (label)=>{ if(!label || seen.has(label)) return; seen.add(label); const o=document.createElement('option'); o.value=label; o.textContent=label; sel.appendChild(o); };
    if (r && r.primary && r.primary.cause) add(r.primary.cause);
    if (r && Array.isArray(r.ranked)) r.ranked.forEach(x=> add(x.cause));
    ALL_CAUSES.forEach(add);
    sel.value = keep || '';
  }

  function renderResults(r){
    const pf=$('primaryFault'), cp=$('confPct'), note=$('confNote');
    if (pf) pf.textContent = r.primary.cause;
    if (cp) { let confAdj=r.primary.pct||0; if(r.primary.cause.toLowerCase().includes('operating properly') && confAdj<95) confAdj=95; cp.textContent = confAdj+'%'; }
    if (note) {
      const noteBits = [];
      if (r.details.deltaT==null) noteBits.push('ΔT missing (enter manual or SAT/RAT)');
      else noteBits.push(r.details.deltaTSource==='manual' ? 'ΔT provided by tech' : 'ΔT computed from SAT/RAT');
      if (r.details.superheat!=null && r.input.targetSH!=null && Math.abs(r.details.superheat-r.input.targetSH)<=BASE_TOL.sh) noteBits.push('SH near target');
      if (r.details.subcool!=null && r.input.targetSC!=null && Math.abs(r.details.subcool-r.input.targetSC)<=BASE_TOL.sc) noteBits.push('SC near target');
      if (r.details.evapSat!=null && Math.abs(r.details.evapSat-40)<=BASE_TOL.evap) noteBits.push('Evap sat near 40°F');
      if (r.ctoa!=null) noteBits.push(`CTOA: ${r.ctoa}°F`);
      note.textContent = noteBits.join(' • ');
    }
    const set = (id,val)=>{ const el=$(id); if(el) el.textContent = (val==null?'—':val+' °F'); };
    set('evapSat', r.details.evapSat); set('condSat', r.details.condSat); set('superheat', r.details.superheat); set('subcool', r.details.subcool);
    const dtEl=$('deltat'); if(dtEl) dtEl.textContent = (r.details.deltaT==null?'—':r.details.deltaT+' °F');

    const list=$('causesList'); if(list){ list.innerHTML='';
      const lines = reasoningLines(r.details, r.input);
      r.ranked.forEach(it=>{
        const row=document.createElement('div'); row.className='cause';
        const why = document.createElement('details');
        const bullets = lines.map(s=>`<li>${s}</li>`).join('');
        why.innerHTML = `<summary>${it.cause} — ${it.pct}%</summary><ul style="margin:6px 0 0 18px">${bullets}</ul>`;
        row.appendChild(why);
        const bar=document.createElement('div'); bar.className='bar'; bar.innerHTML=`<i style="width:${Math.max(6, it.pct)}%"></i>`; row.appendChild(bar);
        list.appendChild(row);
      });
    }
    populateConfirmOptions(r);

    const whyBtn = $('whyBtn'), modal = $('whyModal'), closeBtn = $('whyClose');
    if (whyBtn && modal && closeBtn){
      whyBtn.onclick = ()=>{
        const lines = reasoningLines(r.details, r.input);
        const rules = (r.rulesFired||[]).map(x=>`<li>${x}</li>`).join('') || '<li>(no major rule triggers)</li>';
        $('whyContent').innerHTML =
          `<div><strong>Numbers used</strong><ul>${lines.map(s=>`<li>${s}</li>`).join('')}</ul></div>
           <div style="margin-top:8px"><strong>Rules that influenced this result</strong><ul>${rules}</ul></div>`;
        modal.style.display='block';
      };
      closeBtn.onclick = ()=> modal.style.display='none';
      modal.onclick = (e)=>{ if(e.target===modal) modal.style.display='none'; };
    }
  }

  function readInputs(){
    return {
      refrig: ($('refrig')||{}).value || 'R410A',
      systemType: ($('systemType')||{}).value || 'txv',
      indoorDb: toNum(($('indoorDb')||{}).value), indoorWb: toNum(($('indoorWb')||{}).value), outdoorDb: toNum(($('outdoorDb')||{}).value),
      targetSH: toNum(($('targetSH')||{}).value) ?? 10, targetSC: toNum(($('targetSC')||{}).value) ?? 10,
      caseId: (($('caseId')||{}).value||'').trim() || null,
      snapshotLabel: (($('snapshotLabel')||{}).value||'').trim() || null,
      suctionP: toNum(($('suctionP')||{}).value), suctionT: toNum(($('suctionT')||{}).value),
      liquidP: toNum(($('liquidP')||{}).value), liquidT: toNum(($('liquidT')||{}).value),
      supplyT: toNum(($('supplyT')||{}).value), returnT: toNum(($('returnT')||{}).value),
      deltaTManual: toNum(($('deltaTManual')||{}).value)
    };
  }

  function runDiagnose(){
    const d=readInputs();
    if(d.suctionP==null||d.liquidP==null||d.suctionT==null||d.liquidT==null){ alert('Required: suction pressure, liquid pressure, suction line temp, and liquid line temp. SAT/RAT optional; manual ΔT optional.'); return; }
    const r = diagnoseAll(d); renderResults(r);
  }

  function genCaseId(){
    const d = new Date();
    const y = String(d.getFullYear()).slice(-2);
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    const rand = Math.floor(Math.random()*46656).toString(36).toUpperCase().padStart(3,'0');
    return `${y}${m}${day}-${rand}`;
  }
  function getNextSnapshotLabel(caseId){
    const a = loadHist().filter(x=>x.caseId===caseId);
    if (!a.length) return 'T0';
    const last = a[a.length-1].snapshotLabel||'';
    const m = /T\+?(\d+)/i.exec(last||'');
    if (!m) return 'T+10';
    const n = parseInt(m[1],10)||0;
    return 'T+'+(n+10);
  }

  function renderHist(){
    const list=$('historyList'); const a=loadHist(); if(!list) return;
    if(a.length===0){ list.textContent='No saved readings.'; return; }
    list.innerHTML='';
    a.forEach((h,i)=>{
      const d=document.createElement('div'); d.className='hist';
      d.innerHTML = `<div><strong>${h.refrig||''}</strong> · ${h.time||''}
        <br><span style="color:#5a748a;font-size:12px">Case ${h.caseId||'—'} · ${h.snapshotLabel||'—'} · 
        SP:${h.suctionP||''} ST:${h.suctionT||''} · LP:${h.liquidP||''} LT:${h.liquidT||''} · ΔT:${h.deltaT??'—'} (${h.deltaTSource||'—'}) · 
        ${h.actualDiagnosis || h.suggestedDiagnosis || ''} · Conf:${h.confPct||0}%</span></div>`;
      const del=document.createElement('button'); del.textContent='Del'; del.className='btn secondary'; del.style.padding='6px'; del.style.borderRadius='8px';
      del.onclick=()=>{ const x=loadHist(); x.splice(i,1); saveHist(x); renderHist(); };
      d.appendChild(del); list.appendChild(d);
    });
  }

  function initButtons(){
    const diagBtn=$('diagBtn'); if(diagBtn) diagBtn.addEventListener('click', runDiagnose);
    const genBtn = $('genCase'); if (genBtn) genBtn.addEventListener('click', ()=>{ const el=$('caseId'); if(el) el.value=genCaseId(); const sl=$('snapshotLabel'); if(sl) sl.value='T0'; });
    const saveBtn=$('saveBtn'); if(saveBtn) saveBtn.addEventListener('click', ()=>{
      const d=readInputs(); if(d.suctionP==null||d.liquidP==null||d.suctionT==null||d.liquidT==null){ alert('Enter required values before saving.'); return; }
      const r=diagnoseAll(d);
      const a=loadHist();
      const cid = d.caseId || genCaseId();
      const snap = d.snapshotLabel || getNextSnapshotLabel(cid);
      const entry = {
        time: new Date().toLocaleString(), appVersion:APP_VERSION,
        refrig:d.refrig, systemType:d.systemType,
        indoorDb:d.indoorDb, indoorWb:d.indoorWb, outdoorDb:d.outdoorDb, targetSH:d.targetSH, targetSC:d.targetSC,
        caseId: cid, snapshotLabel: snap,
        suctionP:d.suctionP, suctionT:d.suctionT, liquidP:d.liquidP, liquidT:d.liquidT, supplyT:d.supplyT, returnT:d.returnT,
        evapSat:r.details.evapSat, condSat:r.details.condSat, superheat:r.details.superheat, subcool:r.details.subcool, deltaT:r.details.deltaT, deltaTSource:r.details.deltaTSource,
        suggestedDiagnosis:r.primary.cause, actualDiagnosis:'', confPct:r.primary.pct, learningOn:true, testerInitials:'',
        rulesFired:(r.rulesFired||[]).join(' | '), valveNote:r.valveNote||// New fields for learning and tracking
caseID: getOrCreateCaseId(),
snapshotLabel: getSnapshotLabel(),
technicianName: getTechName(),
''
      };
      a.unshift(entry); if(a.length>1000) a.pop(); saveHist(a); alert('Saved to history.'); renderHist();
    });
    const exportBtn=$('exportHist'); if(exportBtn) exportBtn.addEventListener('click', ()=>{
      const rows=loadHist(); if(rows.length===0){alert('No history to export.'); return;}
      const escape = (v)=>{ if(v==null) return ''; const s=String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
      const order = [
        "time","appVersion","caseId","snapshotLabel",
        "refrig","systemType",
        "indoorDb","indoorWb","outdoorDb",
        "targetSH","targetSC",
        "suctionP","suctionT","liquidP","liquidT",
        "supplyT","returnT","deltaT","deltaTSource",
        "evapSat","condSat","superheat","subcool",
        "suggestedDiagnosis","actualDiagnosis",
        "confPct","learningOn","testerInitials",
        "rulesFired","valveNote","caseID","snapshotLabel","technicianName"

      ];
      const csv=[order.join(',')].concat(rows.map(r=>order.map(k=>escape(r[k])).join(','))).join('\n');
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='hvac_history_v8.csv'; a.click();
    });
    const clearBtn=$('clearHist'); if(clearBtn) clearBtn.addEventListener('click', ()=>{ if(confirm('Clear all history?')){ localStorage.removeItem(HIST_KEY); renderHist(); } });

    // Confirm → logs + learning
    const confirmBtn = $('confirmBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', ()=>{
      const sel = $('confirmSelect');
      if (!sel || !sel.value) { alert('Choose a diagnosis to confirm.'); return; }
      const d = readInputs();
      const r = diagnoseAll(d);
      const a = loadHist();
      const cid = d.caseId || genCaseId();
      const snap = d.snapshotLabel || getNextSnapshotLabel(cid);
      const entry = { time: new Date().toLocaleString(), appVersion:APP_VERSION, refrig:d.refrig, systemType:d.systemType,
        indoorDb:d.indoorDb, indoorWb:d.indoorWb, outdoorDb:d.outdoorDb, targetSH:d.targetSH, targetSC:d.targetSC,
        caseId: cid, snapshotLabel: snap, suctionP:d.suctionP, suctionT:d.suctionT, liquidP:d.liquidP, liquidT:d.liquidT, supplyT:d.supplyT, returnT:d.returnT,
        evapSat:r.details.evapSat, condSat:r.details.condSat, superheat:r.details.superheat, subcool:r.details.subcool, deltaT:r.details.deltaT, deltaTSource:r.details.deltaTSource,
        suggestedDiagnosis:r.primary.cause, actualDiagnosis: sel.value, confPct:r.primary.pct, learningOn:true, testerInitials:'', rulesFired:(r.rulesFired||[]).join(' | '), valveNote:r.valveNote||'' };
      a.unshift(entry); if(a.length>1000) a.pop(); saveHist(a); renderHist(); alert('Confirmation recorded.');

      try{
        const x = buildFeatureVector(d, r.details, r.ctoa);
        window.learnOnline?.(x, sel.value);
      }catch(e){/* ignore */}
    });

    // Compare + Replay (reuse Smart Replay handlers inside coach.js if present)
    const compareBtn = $('compareBtn'); const compareModal = $('compareModal'); const compareClose = $('compareClose');
    if (compareBtn && compareModal){
      compareBtn.onclick = ()=>{
        const cid = ($('caseId')||{}).value || (loadHist()[0] && loadHist()[0].caseId) || '';
        if (!cid){ alert('Enter or generate a Case ID first.'); return; }
        if (window.renderCompareTable) window.renderCompareTable(cid);
        compareModal.style.display='block';
      };
      compareClose.onclick = ()=> compareModal.style.display='none';
      compareModal.onclick = (e)=>{ if(e.target===compareModal) compareModal.style.display='none'; };
    }

    const replayBtn = $('replayBtn'); const replayModal=$('replayModal'); const replayClose=$('replayClose');
    if (replayBtn && replayModal){
      replayBtn.onclick = ()=>{ window.openReplay?.(); };
      replayClose.onclick = ()=>{ window.closeReplay?.(); };
      replayModal.onclick = (e)=>{ if(e.target===replayModal) window.closeReplay?.(); };
    }

    // Coach button
    const coachBtn = $('coachBtn');
    if (coachBtn){
      coachBtn.onclick = ()=>{
        const d=readInputs();
        const r=diagnoseAll(d);
        const seriesGetter = (cid)=> getCaseSeries(cid);
        window.openCoach?.(r, d, seriesGetter);
      };
    }
  }

  async function boot(){
    await initRefrigerants();
    let deferredPrompt; const installBtn = $('installBtn');
    window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; if(installBtn) installBtn.style.display='inline-block'; });
    if (installBtn) installBtn.addEventListener('click', async ()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; installBtn.style.display='none'; });
    renderHist();
    initButtons();
  }
  boot();
})();
