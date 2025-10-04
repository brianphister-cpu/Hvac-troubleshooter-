// learning.js — On-device logistic nudges using localStorage
(function(){
  const KEY = 'hvac_model_v1';
  const CAUSES = [
    'Undercharge (low refrigerant)',
    'Overcharge (too much refrigerant)',
    'Restriction — metering device / drier',
    'Low airflow across evaporator',
    'Non-condensables (air in system)',
    'Compressor mechanical issue (valves/leak)',
    'TXV overfeeding (adjust superheat)',
    'TXV underfeeding (adjust superheat)',
    'Condenser airflow failure (fan out / slow)',
    'Mixed refrigerant / contamination'
  ];

  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } }
  function save(m){ localStorage.setItem(KEY, JSON.stringify(m)); }
  function featKeys(x){
    return ['idb','iwb','odb','targetSH','targetSC','suctionP','liquidP','evapSat','condSat','superheat','subcool','deltaT','ctoa'];
  }
  function vectorize(x){
    const k = featKeys(x);
    const v = k.map(key => {
      const val = x[key]; return (val==null || isNaN(Number(val))) ? 0 : Number(val);
    });
    return {k, v};
  }

  function sigmoid(z){ return 1/(1+Math.exp(-z)); }
  function dot(a,b){ let s=0; for(let i=0;i<a.length;i++) s+= (a[i]||0)*(b[i]||0); return s; }

  // Train: small online step for the confirmed cause only (one-vs-rest simplification)
  function learnOnline(x, confirmedCause){
    const m = load();
    const {k, v} = vectorize(x);
    const lr = 0.0025; // tiny step
    const cap = 0.35;  // max |weight| to avoid runaway
    const idx = confirmedCause;

    m[idx] = m[idx] || { W: new Array(k.length).fill(0) };
    const W = m[idx].W;

    // Predict p = sigmoid(W·x)
    const p = sigmoid(dot(W, v));
    const y = 1; // positive for confirmed class

    // Gradient step: W += lr*(y - p)*x
    for (let i=0;i<W.length;i++){
      W[i] += lr*(y - p)*v[i];
      W[i] = Math.max(-cap, Math.min(cap, W[i]));
    }
    m[idx].W = W;
    save(m);
  }

  // Use small nudges to bias scores before ranking
  function predictNudges(x){
    const m = load();
    const {k, v} = vectorize(x);
    const out = {};
    const alpha = 6; // scale logits → score nudges
    for (const c of CAUSES){
      const W = (m[c] && m[c].W) ? m[c].W : null;
      if (!W) continue;
      const z = dot(W, v);
      out[c] = Math.max(-8, Math.min(8, z*alpha));
    }
    return out;
  }

  // admin helpers
  function resetLearning(){ localStorage.removeItem(KEY); }
  function exportLearning(){ return JSON.stringify(load()); }
  function importLearning(json){ try{ const m=JSON.parse(json); save(m); return true; }catch(e){ return false; } }

  window.learnOnline = learnOnline;
  window.predictNudges = predictNudges;
  window.resetLearning = resetLearning;
  window.exportLearning = exportLearning;
  window.importLearning = importLearning;
})();