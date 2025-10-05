<script>
/*!
 * HVAC Troubleshooter Pro — Send Report v8.1
 * - Web Share API (files) on Android/TWA with graceful fallbacks
 * - CSV column alignment identical to app history export
 * - Zero external deps; safe for GitHub Pages subpath
 */
(function () {
  // ==== CONFIG ====
  const SUPPORT_EMAIL = "Brian.phister@harrisairsystems.com";
  const CSV_FILENAME  = "hvac_report.csv";
  const HIST_KEY      = "hvac_hist_v7_4b"; // keep storage key for continuity
  const BUTTON_ID     = "sendReportBtn";

  // ==== UTIL: History ====
  function loadHist() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); }
    catch { return []; }
  }

  // ==== UTIL: CSV ====
  // Order matches your v7.4+ exports (incl. deltaTSource, rulesFired, valveNote)
  const CSV_ORDER = [
    "time","appVersion","refrig","systemType",
    "indoorDb","indoorWb","outdoorDb","targetSH","targetSC",
    "suctionP","suctionT","liquidP","liquidT","supplyT","returnT",
    "deltaT","evapSat","condSat","superheat","subcool",
    "suggestedDiagnosis","actualDiagnosis","confPct","learningOn",
    "testerInitials","deltaTSource","rulesFired","valveNote"
  ];

  function csvEscape(v) {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildCSV(rows) {
    const header = CSV_ORDER.join(",") + "\n";
    if (!rows || !rows.length) return header; // empty log but valid CSV
    const body = rows.map(r => CSV_ORDER.map(k => csvEscape(r[k])).join(",")).join("\n");
    return header + body + "\n";
  }

  // ==== SHARE / SEND FLOW ====
  async function doWebShareWithFile(file) {
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

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 300);
  }

  function openMailtoFallback(filename) {
    // mailto: cannot attach files — we prefill instructions instead
    const subject = encodeURIComponent("HVAC Troubleshooter Report");
    const body = encodeURIComponent(
      "The CSV (" + filename + ") was downloaded. Please attach it to this email.\n\n" +
      "If you don’t see it in the share sheet, check your Downloads folder."
    );
    const href = `mailto:${encodeURIComponent(SUPPORT_EMAIL)}?subject=${subject}&body=${body}`;
    // target _self avoids being blocked in TWA
    window.location.href = href;
  }

  async function sendReport() {
    try {
      const rows = loadHist();
      const csv = buildCSV(rows);
      const blob = new Blob([csv], { type: "text/csv" });
      const file = new File([blob], CSV_FILENAME, { type: "text/csv" });

      // Try Web Share (Android/TWA happy path)
      try {
        const shared = await doWebShareWithFile(file);
        if (shared) return;
      } catch (_) {
        // fall through to download + mailto
      }

      // Fallbacks: 1) download csv, 2) open mailto with instructions
      triggerDownload(blob, CSV_FILENAME);
      openMailtoFallback(CSV_FILENAME);
    } catch (err) {
      // As a last resort, show a simple alert with next steps
      alert("Could not generate or share the report. Please export history CSV and email it manually.");
      console.error("[send-report] error:", err);
    }
  }

  // ==== WIRE UP ====
  function ready(fn){ document.readyState !== "loading" ? fn() : document.addEventListener("DOMContentLoaded", fn); }
  ready(() => {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    // ensure single handler
    btn.replaceWith(btn.cloneNode(true));
    const freshBtn = document.getElementById(BUTTON_ID) || document.querySelector("#" + BUTTON_ID);
    freshBtn.addEventListener("click", (e) => {
      e.preventDefault();
      sendReport();
    }, { passive: false });
    // Optional: small console breadcrumb for verification
    console.log("[send-report.v81] wired to #"+BUTTON_ID);
  });
})();
</script>
