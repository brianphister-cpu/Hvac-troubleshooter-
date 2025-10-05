/* send-report.v81.js — v8.0.6 */
(function(){
  const BTN_ID = 'sendReportBtn';
  const RELAY = 'https://hvac-email-relay.vercel.app/api/sendCsv'; // adjust only if your Vercel endpoint differs
  const TO_EMAIL = 'Brian.phister@harrisairsystems.com';
  const HIST_KEY='hvac_hist_v7_4b';

  function loadHist(){ try{return JSON.parse(localStorage.getItem(HIST_KEY)||'[]');}catch(e){return []} }

  function buildCsv(rows){
    const esc=(v)=>{ if(v==null) return ''; const s=String(v); return /[",\r\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
    const order=["time","appVersion","caseId","snapshotLabel","refrig","systemType","indoorDb","indoorWb","outdoorDb","targetSH","targetSC","suctionP","suctionT","liquidP","liquidT","supplyT","returnT","deltaT","deltaTSource","evapSat","condSat","superheat","subcool","suggestedDiagnosis","actualDiagnosis","confPct","learningOn","testerInitials","rulesFired"];
    const header=order.join(',');
    const body=rows.map(r=>order.map(k=>esc(r[k])).join(',')).join('\r\n');
    return '\ufeff'+header+'\r\n'+body;
  }

  async function sendViaRelay(to, csv){
    const res = await fetch(RELAY, {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body: JSON.stringify({ to, csvContent: csv })
    });
    const text = await res.text();
    let data = null; try { data = JSON.parse(text); } catch(_){}
    if(!res.ok){
      const msg = data && data.error ? data.error : `HTTP ${res.status}`;
      throw new Error('Relay returned '+msg);
    }
    return data || { ok:true };
  }

  function downloadLocal(csv){
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='hvac_history_export.csv'; a.click();
  }

  async function onClick(){
    const btn = document.getElementById(BTN_ID);
    if (btn){ btn.disabled = true; btn.textContent = 'Sending…'; }
    try{
      const rows = loadHist();
      if (!rows.length) throw new Error('No history to send.');
      const csv = buildCsv(rows);
      if (!TO_EMAIL || !/@/.test(TO_EMAIL)) throw new Error('Recipient email not configured.');
      await sendViaRelay(TO_EMAIL, csv);
      console.info('[send-report] Relay OK → email queued to', TO_EMAIL);
      alert('Report sent to '+TO_EMAIL);
    } catch(err){
      console.warn('[send-report] Relay failed → falling back. Reason:', err);
      alert('Could not send via relay: '+err.message+'.\nA CSV will download locally instead.');
      try {
        const rows = loadHist();
        const csv = buildCsv(rows);
        downloadLocal(csv);
      } catch(e2){
        alert('Also failed to export CSV locally: '+e2.message);
      }
    } finally{
      if (btn){ btn.disabled = false; btn.textContent = 'Send Report'; }
    }
  }

  function boot(){
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    // Avoid double-binding in hot reload
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', onClick, { passive:true });
    console.log('[send-report.v81] wired to #' + BTN_ID + ' → relay:', RELAY);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

  
