/*! send-report.v74b.smart.js — v7.4f: place inside History next to Export CSV; robust load */
(() => {
  'use strict';

  // EDIT THESE
  const RELAY_URL     = 'https://hvac-email-relay.vercel.app/api/sendCsv';
  const REPORT_TO     = 'brianphister@gmail.com';     // your email
  const SHARED_SECRET = 'Axpquvxp';                        // your relay secret if used

  // ----- CSV sourcing (unchanged, robust) -----
  function pickKeys(rows){
    if (!rows || !rows.length) return [];
    const preferred = ['timestamp','refrigerant','systemType','indoorDbF','indoorWbF','outdoorDbF','suctionPsig','liquidPsig','suctionLineTempF','liquidLineTempF','targetSuperheatF','targetSubcoolF','superheatF','subcoolF','evapSatF','condSatF','deltaTF','satF','ratF','diagnosis','confidence'];
    const keys = Object.keys(rows[0]);
    const out = preferred.filter(k => keys.includes(k));
    for (const k of keys) if (!out.includes(k)) out.push(k);
    return out;
  }
  function toCsv(rows){
    if (!rows || !rows.length) return '';
    const keys = pickKeys(rows);
    const esc = v => { if (v==null) return ''; const s=String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
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
      let best=null,bestLen=0;
      for (let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i)||'';
        if (!/history/i.test(k)) continue;
        try{ const parsed = JSON.parse(localStorage.getItem(k));
          if (Array.isArray(parsed) && parsed.length > bestLen){ best = parsed; bestLen = parsed.length; }
        }catch{}
      }
      if (best && best.length) return toCsv(best);
    }catch{}
    const items = Array.from(document.querySelectorAll('.history .hist, #history .hist, [data-history-item]'));
    if (items.length){
      const rows = items.map((el,i)=>({ index: i+1, text: (el.textContent||'').trim().replace(/\s+/g,' ') }));
      return toCsv(rows);
    }
    return '';
  }

  async function sendReport(csv){
    if (!csv){ alert('No report data found. Try Export CSV once, then Send Report.'); return; }
    try{
      const r = await fetch(RELAY_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ to: REPORT_TO, subject:'HVAC History CSV', text:'CSV attached from HVAC Troubleshooter.', csvContent: csv, secret: SHARED_SECRET })
      });
      const t = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(t.error || ('HTTP '+r.status));
      alert('Report emailed ✔');
    }catch(e){ console.error('Send report failed:', e); alert('Send failed: ' + (e?.message || e)); }
  }

  // ----- Placement helpers -----
  function createButton(){
    const btn = document.createElement('button');
    btn.id = 'sendReportBtn';
    btn.type = 'button';
    btn.textContent = 'Send Report';
    btn.className = 'btn primary';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', () => {
      const csv = getCsv();
      if (!csv) {
        const exportBtn = findExportCsvButton();
        if (exportBtn){ exportBtn.click(); setTimeout(() => sendReport(getCsv()), 350); return; }
      }
      sendReport(csv);
    });
    return btn;
  }

  function findHistoryToolbar(){
    // common containers in your app for history actions; expand if you have a dedicated id/class
    return document.querySelector('#historyActions, .history .actions, .panel .history .actions') || null;
  }
  function findExportCsvButton(){
    const id = document.querySelector('#exportCsv, #exportCSV');
    if (id) return id;
    const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
    return btns.find(b => /export\s*csv/i.test((b.textContent||'').trim())) || null;
  }

  function ensureButtonInHistory(){
    const existing = document.getElementById('sendReportBtn');
    const exportBtn = findExportCsvButton();
    const toolbar = findHistoryToolbar();

    if (!existing) {
      // First time insertion
      const btn = createButton();
      if (exportBtn && exportBtn.parentElement) {
        exportBtn.parentElement.insertBefore(btn, exportBtn.nextSibling);
      } else if (toolbar) {
        toolbar.appendChild(btn);
      } else {
        // fallback: under header so it’s visible
        const header = document.querySelector('header, .header, .panel header');
        if (header && header.parentElement) header.parentElement.insertBefore(btn, header.nextSibling);
        else (document.querySelector('.app') || document.body).prepend(btn);
      }
      return;
    }

    // If it exists but isn’t beside Export, move it next to Export
    if (exportBtn && exportBtn.parentElement && existing.previousElementSibling !== exportBtn) {
      exportBtn.parentElement.insertBefore(existing, exportBtn.nextSibling);
    } else if (toolbar && existing.parentElement !== toolbar && !exportBtn) {
      toolbar.appendChild(existing);
    }
  }

  // MutationObserver: wait for the Export button/toolbar if rendered later
  function observeAndPlace(){
    ensureButtonInHistory();
    const obs = new MutationObserver(() => ensureButtonInHistory());
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeAndPlace, { once:true });
  } else {
    observeAndPlace();
  }
})();
