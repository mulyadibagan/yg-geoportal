import data from '../../../data/aramco-phase3-final.json' with { type: 'json' };
import '../../../js/aramco-phase3-reconciliation.js';

// Preserve this reviewed programme correction when Apps Script refreshes snapshots.
export function reconcileAramcoObjects(objects) {
  return globalThis.YG_ARAMCO_PHASE3.applyObjects(objects, data);
}
