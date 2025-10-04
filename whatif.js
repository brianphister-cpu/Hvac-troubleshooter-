// whatif.js — hooks for forthcoming What-If Simulator (no-op for now)
(function(){
  function simulateChange(opts){
    // placeholder: returns structure but no real simulation yet
    // opts: { d: inputs, deltaChargeOz, deltaCfmPct, deltaOAT }
    return {
      predicted: { superheat: null, subcool: null, suctionP: null, liquidP: null },
      note: 'Simulator coming soon — hooks wired.',
    };
  }
  window.simulateChange = simulateChange;
})();