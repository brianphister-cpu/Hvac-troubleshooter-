
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
  // ===== CSV (v8.2 learning-ready) =====

// 1) Existing columns (unchanged order)
const BASE_ORDER = [
  "time","appVersion","refrig","systemType",
  "indoorDb","indoorWb","outdoorDb","targetSH","targetSC",
  "suctionP","suctionT","liquidP","liquidT","supplyT","returnT",
  "deltaT","evapSat","condSat","superheat","subcool",
  "suggestedDiagnosis","actualDiagnosis","confPct","learningOn",
  "testerInitials","deltaTSource","rulesFired","valveNote"
];

// 2) New learning columns (safe to be blank if not present yet)
const LEARNING_FIELDS = [
  // Identification & timing
  "caseID","snapshotLabel","timestampISO",

  // Tech & equipment
  "technicianName","brand","model","serial",

  // Operation & environment
  "mode","meteringDevice","altitudeFt","humidityPct","outdoorWB",
  "cfm","staticPressureInH2O","filterCondition","coilCondition",

  // Derived / trend-friendly
  "dSuperheat_dt","dSubcool_dt","dDeltaT_dt","chargeDeviationIndex"
];

// 3) Final CSV header order: legacy first, then learning fields
const CSV_ORDER = [...BASE_ORDER, ...LEARNING_FIELDS];

function csvEscape(v){
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}

// Normalize one history row: keep old keys, add new keys (best-effort mapping)
function normalizeRow(r){
  const out = { ...r };

  // Timestamp (ISO) for analytics
  if (!out.timestampISO) {
    // use stored time string if present, else now
    const t = (typeof out.time === "string") ? new Date(out.time) : new Date();
    out.timestampISO = isNaN(t.getTime()) ? "" : t.toISOString();
  }

  // Identification
  out.caseID        = r.caseID || r.caseId || r.case || "";
  out.snapshotLabel = r.snapshotLabel || r.snapLabel || r.snapshot || "T0";

  // Tech & equipment
  out.technicianName = r.technicianName || r.testerInitials || "";
  out.brand          = r.brand || "";
  out.model          = r.model || "";
  out.serial         = r.serial || "";

  // Operation & environment
  out.mode            = r.mode || "cool";
  // Map your systemType to a metering device label (helps analytics)
  // txv/eev/fixed → human readable
  const st = (r.systemType || "").toLowerCase();
  out.meteringDevice  = r.meteringDevice ||
                        (st === "txv" ? "TXV" : st === "eev" ? "EEV" : st === "fixed" ? "Fixed" : "");
  out.altitudeFt      = r.altitudeFt || r.altitude || "";
  out.humidityPct     = r.humidityPct || r.rh || "";
  out.outdoorWB       = r.outdoorWb || r.outdoorWB || "";

  // Air side / airflow
  out.cfm                 = r.cfm || r.airflowCFM || "";
  out.staticPressureInH2O = r.staticPressureInH2O || r.static || "";
  out.filterCondition     = r.filterCondition || ""; // e.g., clean/dirty/unknown
  out.coilCondition       = r.coilCondition || "";   // e.g., clean/dirty/iced

  // Trend placeholders (compute in analytics later)
  out.dSuperheat_dt        = r.dSuperheat_dt || "";
  out.dSubcool_dt          = r.dSubcool_dt || "";
  out.dDeltaT_dt           = r.dDeltaT_dt || "";
  out.chargeDeviationIndex = r.chargeDeviationIndex || "";

  // High-side naming helper (optional): if you prefer discharge terms
  // You already store liquidP/liquidT. If you also log dischargeP/T in future, leave both.
  // out.dischargeP = r.dischargeP || r.liquidP || "";
  // out.dischargeT = r.dischargeT || r.liquidT || "";

  return out;
}

function buildCSV(rows){
  const header = CSV_ORDER.join(",") + "\n";
  if (!rows || !rows.length) return header;

  // Normalize then serialize
  const lines = rows.map(r => {
    const n = normalizeRow(r);
    return CSV_ORDER.map(k => csvEscape(n[k])).join(",");
  });

  return header + lines.join("\n") + "\n";
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
    const rows  = loadHist();
    const csv   = buildCSV(rows); // <-- this is plain text
    const blob  = new Blob([csv], { type: "text/csv" });

    const meta = {
      rowCount: rows.length,
      latest: rows[0] || null,
      userAgent: navigator.userAgent,
      origin: location.origin,
      path: location.pathname + location.search
    };

    // 1) Try relay with JSON (matches your server)
    try {
      await sendViaRelay(csv, CSV_FILENAME, meta);  // <-- pass csvText here
      alert("Report sent successfully via relay.");
      return;
    } catch (e) {
      console.warn("[send-report] Relay failed, falling back. Reason:", e);
    }

    // 2) Try Web Share (Android/TWA)
    try {
      const file = new File([blob], CSV_FILENAME, { type: "text/csv" });
      if (await webShareFile(file)) return;
    } catch (_) {}

    // 3) Fallbacks: download + mailto
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

