// normalize.js — Ambient normalization & psychro-lite targets
(function(){
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  // Very small heuristic model: adjust nominal targets by ambient
  // Inputs: d.indoorDb, d.indoorWb (optional), d.outdoorDb
  // Outputs: { deltaTTarget, shTargetAdj, scTargetAdj, badge }
  function normalizeTargets(d){
    const OAT = Number(d.outdoorDb ?? 95);
    const IDB = Number(d.indoorDb ?? 75);
    const IWB = d.indoorWb==null ? null : Number(d.indoorWb);

    // ΔT target: start at 20°F and tilt with humidity & OA
    let deltaTTarget = 20;
    const mild = OAT < 80 ? (80 - OAT)*0.15 : 0;     // lower ΔT on mild days
    const hot  = OAT > 100 ? (OAT - 100)*0.10 : 0;   // raise ΔT on very hot days
    deltaTTarget = clamp(deltaTTarget - mild + hot, 12, 26);

    // If wet-bulb is provided, adjust ΔT toward latent load (higher WB -> lower ΔT sensible)
    if (IWB!=null && IDB!=null){
      const RHish = clamp( (IWB - 55) * 2, 0, 20 ); // rough proxy
      deltaTTarget = clamp(deltaTTarget - RHish*0.2, 12, 26);
    }

    // SH/SC tweaks
    // Slightly increase SC at mild ambients (less heat rejection) and at very hot (flooding protection)
    let scTargetAdj = 0;
    if (OAT < 80) scTargetAdj += 1.5;
    if (OAT > 100) scTargetAdj += 1.5;
    scTargetAdj = clamp(scTargetAdj, -2, 4);

    // SH tends to run a hair higher in very dry indoor conditions (proxy via IWB)
    let shTargetAdj = 0;
    if (IWB!=null && IWB < 60) shTargetAdj += 1.0;
    shTargetAdj = clamp(shTargetAdj, -2, 4);

    const badge = `Targets normalized for ambient (ΔT≈${deltaTTarget}°F, SH adj ${shTargetAdj}°, SC adj ${scTargetAdj}°)`;
    return { deltaTTarget, shTargetAdj, scTargetAdj, badge };
  }

  window.normalizeTargets = normalizeTargets;
})();