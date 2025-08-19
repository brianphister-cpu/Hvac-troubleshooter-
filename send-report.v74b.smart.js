/*! send-report.v74b.smart.js — guaranteed button + robust CSV source */
(() => {
  'use strict';

  // EDIT THESE
  const RELAY_URL     = 'https://hvac-email-relay.vercel.app/api/sendCsv';
  const REPORT_TO     = 'brianphister@gmail.com';   // <- your email
  const SHARED_SECRET = 'Axpquvxp';                      // <- your Vercel secret (or '' if none)

  const log = (...a)=>console.log('[SendReport]', ...a);

  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  }

  function pickKeys(rows){
    if (!rows || !rows.length) return [];
    const preferred = ['timestamp','refrigerant','systemType','indoorDbF','indoorWbF','outdoorDbF','suctionPsig','liquidPsig','suctionLineTempF','liquidLineTempF','targetSuperheatF','targetSubcoolF','superheatF','subcoolF','evapSatF','condSatF','deltaTF','satF','ratF','diagnosis','confidence'];
    const keys = Object.keys(rows[0]);
    const ordered = preferred.filter(k => keys.includes(k));
    for (const k of keys) if (!ordered.includes(k)) ordered.push(k);
    return ordered;
  }
  function toCsv(rows){
    if (!rows || !rows.length) return '';
    const keys = pickKeys(rows);
    const esc = v => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
    };
    const head = keys.join(',');
    const body = rows.map(r => keys.map(k => esc(r[k])).join(',')).join('\n');
    return head + '\n' + body + '\n';
  }

  function getCsv() {
    // 1) App-provided builders
    try{
      if (typeof window.buildHistoryCsv === 'function'){
        const s = window.buildHistoryCsv(); if (s && /,/.test(String(s))) { log('via buildHistoryCsv'); return String(s); }
      }
    }catch(e){ log('buildHistoryCsv err', e); }
    try{
      if (typeof window.exportHistoryToCsv === 'function'){
        const s = window.exportHistoryToCsv({ returnString: true }); if (s && /,/.test(String(s))) { log('via exportHistoryToCsv'); return String(s); }
      }
    }catch(e){ log('exportHistoryToCsv err', e); }

    // 2) Known caches
    if (typeof window.__lastCsv === 'string' && /,/.test(window.__lastCsv)) { log('via __lastCsv'); return window.__lastCsv; }

    // 3) localStorage (arrays or CSV)
    try{
      const direct = localStorage.getItem('hvac_history_csv');
      if (direct && /,/.test(direct)) { log('via localStorage hvac_history_csv'); return direct; }
      let best = null, bestLen = 0, bestKey = '';
      for (let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i) || '';
        if (!/history/i.test(k)) continue;
        try{
          const parsed = JSON.parse(localStorage.getItem(k));
          if (Array.isArray(parsed) && parsed.length > bestLen){ best=parsed; bestLen=parsed.length; bestKey=k; }
        }catch{}
      }
      if (best && best.length){ log('via localStorage', bestKey); return toCsv(best); }
    }catch(e){}

    // 4) DOM fallback (very light)
    const items = Array.from(document.querySelectorAll('.history .hist, #history .hist, [data-history-item]'));
    if (items.length){
      log('via DOM fallback');
      const rows = items.map((el, ix) => ({ index: ix+1, text: (el.textContent||'').trim().replace(/\s+/g,' ') }));
      return toCsv(rows);
    }
    return '';
  }

  async function sendReport(csvString){
    if (!csvString) { alert('No report data found. Try exporting once, then Send Report.'); return; }
    try{
      const resp = await fetch(RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ to: REPORT_TO, subject: 'HVAC History CSV', text: 'CSV attached from HVAC Troubleshooter.', csvContent: csvString, secret: SHARED_SECRET })
      });
      const data = await resp.json().catch(()=> ({}));
      if (!resp.ok) throw new Error(data.error || ('HTTP '+resp.status));
      alert('Report emailed ✔');
    }catch(err){
      console.error('Send report failed:', err);
      alert('Send failed: ' + (err?.message || err));
    }
  }

  function insertButton(){
    // Avoid duplicates
    const existing = document.getElementById('sendReportBtn');
    if (existing) { log('button already present'); return; }

    const btn = document.createElement('button');
    btn.id = 'sendReportBtn';
    btn.type = 'button';
    btn.textContent = 'Send Report';
    btn.className = 'btn primary';
    btn.style.display = 'inline-block';
    btn.style.margin = '8px 0';

    btn.addEventListener('click', () => {
      const csv = getCsv();
      if (!csv) {
        // tap export csv (if exists) to populate caches, then retry
        const exportBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => /export\s*csv/i.test((b.textContent||'').trim()));
        if (exportBtn) {
          exportBtn.click();
          setTimeout(() => sendReport(getCsv()), 350);
          return;
        }
      }
      sendReport(csv);
    });

    // Mount under header if present; else at top of main app container
    const header = document.querySelector('header, .header, .panel header');
    if (header && header.parentElement) header.parentElement.insertBefore(btn, header.nextSibling);
    else (document.querySelector('.app') || document.body).prepend(btn);

    log('button inserted');
  }

  function verifyLoaded(){
    // visible logs to help quick triage in DevTools if needed
    log('script loaded, DOM state:', document.readyState);
  }

  onReady(() => { verifyLoaded(); insertButton(); });
})();
