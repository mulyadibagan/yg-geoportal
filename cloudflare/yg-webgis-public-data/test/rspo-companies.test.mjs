import test from 'node:test';
import assert from 'node:assert/strict';
import {companyBoundaries} from '../scripts/rspo-companies.mjs';
const feature=(FID,Parent,Subsidiary)=>({type:'Feature',properties:{FID,Parent,Subsidiary,SupplyBase:'Estate '+FID},geometry:{type:'Polygon',coordinates:[[[101,1],[101.01,1],[101.01,1.01],[101,1.01],[101,1]]]}});
test('companies remain separate within one group and ownership suffixes normalize',()=>{
  const r=companyBoundaries([feature(1,'Group A','PT One'),feature(2,'Group A','PT. One Subsidiary of Group A'),feature(3,'Group A','PT Two')]);
  assert.equal(r.companyCount,2);assert.equal(r.features[0].properties.COMPANY_ID,r.features[1].properties.COMPANY_ID);
  assert.notEqual(r.features[0].properties.COMPANY_ID,r.features[2].properties.COMPANY_ID);
  assert.equal(r.features[0].properties.SUPPLY_BASE,'Estate 1 · Estate 2');
});
test('abbreviations are retained and unknown entities are not assigned a parent company',()=>{
  const r=companyBoundaries([feature(1,'Permata','PT. PHI'),feature(2,'Permata',''),feature(3,'Permata','')]);
  assert.equal(r.features[0].properties.PO_COMPANY,'PT PHI');assert.equal(r.companyCount,3);
  assert.equal(r.features[1].properties.NAME_STATUS,'unidentified');
  assert.notEqual(r.features[1].properties.PO_COMPANY,'Permata');
});
test('stable IDs do not depend on source order and geometry is retained',()=>{
  const a=feature(1,'Group','PT A'),b=feature(2,'Group','PT B');
  const x=companyBoundaries([a,b]),y=companyBoundaries([b,a]);
  assert.equal(x.features[0].properties.COMPANY_ID,y.features[1].properties.COMPANY_ID);
  assert.deepEqual(x.features[0].geometry,a.geometry);
});
