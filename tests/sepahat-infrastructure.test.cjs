const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const inventory=require('../js/planting-inventory.js');
const source=fs.readFileSync(require.resolve('../js/village-profile.js'),'utf8');
const segment=source.slice(source.indexOf('  function mergeFeatureCollections('),source.indexOf('  function ringArea('));
const scope={number:v=>v==null||String(v).trim()===''?null:Number(v)}; vm.createContext(scope);vm.runInContext(segment,scope);
const canals=JSON.parse(fs.readFileSync(require.resolve('../data/sekat_kanal.geojson'),'utf8'));
const fdrs=JSON.parse(fs.readFileSync(require.resolve('../data/fdrs.geojson'),'utf8'));
function count(snapshot){const features=scope.mergeFeatureCollections(snapshot,[canals,fdrs]).filter(f=>!scope.isActivityFeature(f)&&inventory.featureMatchesPlace(f,'Sepahat','Bandar Laksamana','Bengkalis',null));return {canals:features.filter(f=>scope.layerId(f)==='sekat_kanal').length,fdrs:features.filter(f=>scope.layerId(f)==='fdrs').length};}
test('Sepahat retains two canal blocks and one FDRS when recent snapshot omits base assets',()=>{assert.deepEqual(count({features:[]}),{canals:2,fdrs:1});});
test('snapshot assets and canonical inventories are deduplicated by Object_ID',()=>{assert.deepEqual(count({features:[...canals.features,...fdrs.features]}),{canals:2,fdrs:1});});
test('infrastructure inventories participate in initial load and live refresh',()=>{assert.match(source,/optionalJson\("data\/sekat_kanal\.geojson/);assert.match(source,/optionalJson\("data\/fdrs\.geojson/);assert.equal(source.split('[pair[5],pair[6],pair[7],pair[10],pair[11]]').length-1,2);});
