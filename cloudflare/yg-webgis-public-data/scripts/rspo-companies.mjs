import { createHash } from 'node:crypto';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
// Remove an explicit ownership suffix; never infer an entity from its parent.
export const companyName = value => clean(value).replace(/\s+subsidiary\s+of\b.*$/i, '').replace(/^PT\.\s*/i, 'PT ').trim();
export function companyBoundaries(features) {
  const companies = new Map();
  for (const feature of features) {
    const p = feature.properties || {};
    const parent = clean(p.Parent), company = companyName(p.Subsidiary);
    if (!feature.geometry || !parent) continue;
    // Missing entity names stay separate and explicitly unidentified.
    const identity = [parent.toLowerCase(), company.toLowerCase() || 'unidentified:' + p.FID];
    const id = 'GEORSPO-' + createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0,16);
    if (!companies.has(id)) companies.set(id, { id, parent, company, names:new Set(), units:new Set(), supplies:new Set(), pieces:[] });
    const row = companies.get(id);
    row.names.add(clean(p.Subsidiary));
    if (clean(p.ManageUnit)) row.units.add(clean(p.ManageUnit));
    if (clean(p.SupplyBase)) row.supplies.add(clean(p.SupplyBase));
    row.pieces.push(feature);
  }
  return {
    type:'FeatureCollection', visibility:'internal', generatedAt:new Date().toISOString(),
    source:'GeoRSPO concessions: Province=Riau; original unsimplified geometry',
    companyCount:companies.size,
    features:Array.from(companies.values()).flatMap(row => row.pieces.map(f => ({
      type:'Feature', geometry:f.geometry,
      properties:{ COMPANY_ID:row.id, PO_COMPANY:row.company || 'Nama perusahaan belum tercantum',
        RSPO_GROUP:row.parent, Parent:row.parent, SUPPLY_BASE:Array.from(row.supplies).sort().join(' · '),
        MANAGEMENT_UNITS:Array.from(row.units).sort().join(' · '),
        SOURCE_SUBSIDIARIES:Array.from(row.names).filter(Boolean).sort(),
        NAME_STATUS:row.company ? 'source-recorded' : 'unidentified', SOURCE_FID:f.properties.FID }
    })))
  };
}
