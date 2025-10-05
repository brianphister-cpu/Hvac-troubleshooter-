
/*!
 * HVAC Troubleshooter Pro — Send Report v8.1 (Vercel relay first)
 * Order: 1) POST to Vercel relay, 2) Web Share (files), 3) Download + mailto.
 * Drop-in: keep button id #sendReportBtn. No external deps.
 */
(function () {
  // ===== CONFIG =====
  const RELAY_ENDPOINT = "https://hvac-email-relay.vercel.app/api/sendCsv"; // <-- PUT YOUR URL HERE
  const SUPPORT_EMAIL  = "Brian.phister@harrisairsystems.com";
  const CSV_FILENAME   = "hvac_report.csv";
  const HIST_KEY       = "hvac_hist_v7_4b";    // keep storage key for continuity
  const BUTTON_ID      = "sendReportBtn";

  // ===== CSV BUILD (same column order as your exports) =====
  const CSV_ORDER = [
    "time","appVersion","refrig","systemType",
    "indoorDb","indoorWb","outdoorDb","targetSH","targetSC",
    "suctionP","suctionT","liquidP","liquidT","supplyT","returnT",
    "deltaT","evapSat","condSat","superheat","subcool",
    "suggestedDiagnosis","actualDiagnosis","confPct","learningOn",
    "testerInitials","deltaTSource","rulesFired","valveNote"
  ];
  function loadHist(){ try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { return []; } }
  function csvEscape(v){ if (v==null) return ""; const s=String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; }
  function buildCSV(rows){
    const header = CSV_ORDER.join(",") + "\n";
    if (!rows || !rows.length) return header;
    const body = rows.map(r => CSV_ORDER.map(k => csvEscape(r[k])).join(",")).join("\n");
    return header + body + "\n";
  }

  // ===== HELPERS =====
  async function webShareFile(file){
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "HVAC Troubleshooter Pro — Report",
        text: "Attached: CSV export from field diagnostics."
      });
      return true;
    }
    return false;
  }
  function downloadBlob(blob, name){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 300);
  }
  function mailtoFallback(name){
    const subject = encodeURIComponent("HVAC Troubleshooter Report");
    const body = encodeURIComponent(
      "The CSV ("+name+") was downloaded. Please attach it to this email.\n\n" +
      "If the share sheet did not appear, check your Downloads folder."
    );
    window.location.href = `mailto:${encodeURIComponent(SUPPORT_EMAIL)}?subject=${subject}&body=${body}`;
  }

  // ===== VERCEL RELAY SEND =====
  // Replace your current sendViaRelay() with this JSON version:
async function sendViaRelay(csvText, csvFilename, meta) {
  if (!RELAY_ENDPOINT || !/^https?:\/\//i.test(RELAY_ENDPOINT)) {
    throw new Error("Relay endpoint not configured");
  }
  const payload = {
    to: SUPPORT_EMAIL,                               // relay requires this
    subject: "HVAC Troubleshooter Pro — Field Report",
    message: "Attached: CSV export from HVAC Troubleshooter Pro.",
    csvContent: csvText,                             // relay requires this
    filename: csvFilename || "hvac_report.csv",      // optional helper for your email
    meta: meta || {}
  };

  const res = await fetch(RELAY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(()=> "");
    throw new Error("Relay returned "+res.status+"  :: "+txt);
  }
  return true;
}


  // ===== MAIN ACTION =====
  async function sendReport(){
    try {
      // Build CSV from history
      const rows  = loadHist();
      const csv   = buildCSV(rows);
      const blob  = new Blob([csv], { type: "text/csv" });
      // Minimal meta: include counters and latest case context if present
      const meta = {
        rowCount: rows.length,
        latest: rows[0] || null,
        userAgent: navigator.userAgent,
        origin: location.origin,
        path: location.pathname + location.search
      };

      // 1) Try Vercel relay first
      try {
        await sendViaRelay(blob, CSV_FILENAME, meta);
        alert("Report sent successfully via relay.");
        return;
      } catch (e) {
        console.warn("[send-report] Relay failed, falling back. Reason:", e);
      }

      // 2) Try Web Share with file (Android/TWA happy path)
      try {
        const file = new File([blob], CSV_FILENAME, { type: "text/csv" });
        if (await webShareFile(file)) return;
      } catch (_) {}

      // 3) Fallbacks: download + open mailto with instructions
      downloadBlob(blob, CSV_FILENAME);
      mailtoFallback(CSV_FILENAME);
    } catch (err) {
      console.error("[send-report] fatal error:", err);
      alert("Could not generate or send the report. Please use Export History CSV and email it manually.");
    }
  }

  // ===== WIRE UP BUTTON =====
  function ready(fn){ document.readyState !== "loading" ? fn() : document.addEventListener("DOMContentLoaded", fn); }
  ready(()=>{
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) { console.warn("[send-report] #"+BUTTON_ID+" not found"); return; }
    const clone = btn.cloneNode(true); btn.parentNode.replaceChild(clone, btn); // remove old listeners
    clone.addEventListener("click", (e)=>{ e.preventDefault(); sendReport(); }, { passive:false });
    console.log("[send-report.v81] wired to #"+BUTTON_ID, "→ relay first:", RELAY_ENDPOINT);
  });
})();

