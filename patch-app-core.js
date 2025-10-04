// patch-app-core.js — V8.0.1 minimal patches
(function(){
  const $ = (id)=>document.getElementById(id);
  // 1) Coach modal robust close (idempotent)
  (function(){
    const coachModal = document.getElementById('coachModal');
    const coachClose = document.getElementById('coachClose');
    if (coachModal && coachClose && !coachModal._wired) {
      coachClose.onclick = () => coachModal.style.display = 'none';
      coachModal.addEventListener('click', (e) => { if (e.target === coachModal) coachModal.style.display = 'none'; });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && coachModal.style.display === 'block') coachModal.style.display = 'none';
      });
      coachModal._wired = true;
    }
  })();

  // 2) Confidence alignment helper (call this after you compute ranked/primary)
  window._alignConfidence = function(result){
    if (!result || !result.ranked || !result.ranked.length) return result;
    const share = result.ranked[0].pct || 0;
    if (result.primary) {
      result.primary.pct = share;
    } else {
      result.primary = { cause: result.ranked[0].cause, pct: share };
    }
    return result;
  };

  // 3) Excel-friendly CSV export (drop-in, replace your export handler with this)
  window._exportHistoryCSV = function(loadHist){
    const rows = loadHist(); if (!rows.length){ alert('No history to export.'); return; }
    const esc = (v)=>{ if(v==null) return ''; const s=String(v); return /[",\r\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
    const order = ["time","appVersion","caseId","snapshotLabel","refrig","systemType","indoorDb","indoorWb","outdoorDb","targetSH","targetSC","suctionP","suctionT","liquidP","liquidT","supplyT","returnT","deltaT","deltaTSource","evapSat","condSat","superheat","subcool","suggestedDiagnosis","actualDiagnosis","confPct","learningOn","testerInitials","rulesFired","valveNote"];
    const header = order.join(',');
    const body = rows.map(r=>order.map(k=>esc(r[k])).join(',')).join('\r\n');
    const csv = '\ufeff' + header + '\r\n' + body;
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='hvac_history_v8_0_1.csv'; a.click();
  };
})();