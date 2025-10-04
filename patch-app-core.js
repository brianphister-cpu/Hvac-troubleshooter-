// patch-app-core.js — Confidence alignment + CSV + Coach modal fixes
(function(){
  const $ = (id)=>document.getElementById(id);

  // Coach close handler
  const coachModal = $('coachModal'); const coachClose = $('coachClose');
  if (coachModal && coachClose){ coachClose.onclick = ()=> coachModal.style.display='none';
    coachModal.onclick = (e)=>{ if(e.target===coachModal) coachModal.style.display='none'; };
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') coachModal.style.display='none'; });
  }

  // Confidence alignment
  window._alignConfidence = function(r){
    if(!r||!r.ranked||!r.ranked.length)return r;
    const p = r.ranked[0].pct||0;
    if(r.primary) r.primary.pct=p; else r.primary={cause:r.ranked[0].cause,pct:p};
    return r;
  };

  // Excel-safe CSV export
  window._exportHistoryCSV = function(loadHist){
    const rows=loadHist(); if(!rows.length){alert('No history');return;}
    const esc=v=>v==null?'':(/[",\r\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v);
    const order=["time","appVersion","caseId","snapshotLabel","refrig","systemType","indoorDb","indoorWb","outdoorDb","targetSH","targetSC","suctionP","suctionT","liquidP","liquidT","supplyT","returnT","deltaT","deltaTSource","evapSat","condSat","superheat","subcool","suggestedDiagnosis","actualDiagnosis","confPct","learningOn","testerInitials","rulesFired","valveNote"];
    const csv='\ufeff'+order.join(',')+'\r\n'+rows.map(r=>order.map(k=>esc(r[k]||'')).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='hvac_history_v8_0_1.csv';a.click();
  };
})();