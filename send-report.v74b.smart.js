/*! send-report.v74b.smart.js — place button near Export CSV inside History panel; email to owner */
(() => {
  'use strict';
  // === CONFIG ===
  const RELAY_URL     = 'https://hvac-email-relay.vercel.app/api/sendCsv';
  const REPORT_TO     = 'you@yourcompany.com';   // TODO: set to your email
  const SHARED_SECRET = '';                      // set if your relay requires it
  // ==============

  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  }

  function pickKeys(rows){
    if (!rows?.length) return [];
    const pref = ['timestamp','refrigerant','systemType','indoorDbF','indoorWbF','outdoorDbF','suctionPsig','liquidPsig','suctionLineTempF','liquidLineTempF','targetSuperheatF','targetSubcoolF','superheatF','subcoolF','evapSatF','condSatF','deltaTF','satF','ratF','diagnosis','confidence'];
    const keys = Object.keys(rows[0]);
    const out = pref.filter(k => keys.includes(k));
    for (const k of keys) if (!out.includes(k)) out.push(k);
    return out;
  }
  function toCsv(rows){
    if (!rows?.length) return '';
    const keys = pickKeys(rows);
    const esc = v => { if (v==null) return ''; const s=String(v); return /[",\n]/.test(s) ? ('"'+s.replace(/"/g,'""')+'"') : s; };
    const head = keys.join(',');
    const body = rows.map(r => keys.map(k => esc(r[k])).join(',')).join('\n');
    return head + '\n' + body + '\n';
  }

  function getCsv(){
    try{ if (typeof window.buildHistoryCsv === 'function'){ const s = window.buildHistoryCsv(); if (s && /,/.test(String(s))) return String(s); } }catch{}
    try{ if (typeof window.exportHistoryToCsv === 'function'){ const s = window.exportHistoryToCsv({ returnString:true }); if (s && /,/.test(String(s))) return String(s); } }catch{}
    if (typeof window.__lastCsv === 'string' && /,/.test(window.__lastCsv)) return window.__lastCsv;
    try{
      const direct = localStorage.getItem('hvac_history_csv'); if (direct && /,/.test(direct)) return direct;
      let best=null,bestLen=0; let bestKey='';
      for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i)||''; if(!/history/i.test(k)) continue;
        try{ const parsed = JSON.parse(localStorage.getItem(k)); if (Array.isArray(parsed) && parsed.length>bestLen){ best=parsed; bestLen=parsed.length; bestKey=k; } }catch{}
      }
      if (best && best.length) return toCsv(best);
    }catch{}
    const items = Array.from(document.querySelectorAll('.history .hist, #history .hist, [data-history-item]'));
    if (items.length){ const rows = items.map((el,i)=>({index:i+1, text:(el.textContent||'').trim().replace(/\s+/g,' ')})); return toCsv(rows); }
    return '';
  }

  async function sendReport(csv){
    if (!csv){ alert('No report data found. Try Export CSV once, then Send Report.'); return; }
    try{
      const resp = await fetch(RELAY_URL, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ to: REPORT_TO, subject:'HVAC History CSV', text:'CSV attached from HVAC Troubleshooter.', csvContent: csv, secret: SHARED_SECRET })
      });
      const data = await resp.json().catch(()=>({}));
      if (!resp.ok) throw new Error(data.error || ('HTTP '+resp.status));
      alert('Report emailed ✔');
    }catch(e){ console.error('Send report failed:', e); alert('Send failed: ' + (e?.message || e)); }
  }

  function findHistoryPanel(){
    // Try common containers used in your app for the history area
    return document.querySelector('.history, #history, .panel .history, .panel[data-section="history"]') || null;
  }
  function findExportCsvButton(){
    const ids = document.querySelector('#exportCsv, #exportCSV');
    if (ids) return ids;
    const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
    return btns.find(b => /export\s*csv/i.test((b.textContent||'').trim())) || null;
  }

  function insertButton(){
    if (document.getElementById('sendReportBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'sendReportBtn';
    btn.type = 'button';
    btn.textContent = 'Send Report';
    btn.className = 'btn primary';
    btn.style.marginLeft = '8px';

    btn.addEventListener('click', () => {
      let csv = getCsv();
      if (!csv){
        const exportBtn = findExportCsvButton();
        if (exportBtn){ exportBtn.click(); setTimeout(()=> sendReport(getCsv()), 350); return; }
      }
      sendReport(csv);
    });

    // Prefer placing inside the History box next to Export CSV
    const exportBtn = findExportCsvButton();
    if (exportBtn && exportBtn.parentElement){
      exportBtn.parentElement.insertBefore(btn, exportBtn.nextSibling);
      return;
    }
    const hist = findHistoryPanel();
    if (hist) { hist.appendChild(btn); return; }
    // fallback: under header
    const header = document.querySelector('header, .header, .panel header');
    if (header && header.parentElement) header.parentElement.insertBefore(btn, header.nextSibling);
    else (document.querySelector('.app') || document.body).prepend(btn);
  }

  onReady(insertButton);
})();
