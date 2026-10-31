const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/dayun-public.js','utf8');
test('selecting the current but hidden areal layer activates it and still fits its bounds',()=>{const fn=source.match(/function switchLayer\(id\)[^\n]+/)[0];let added=0,rendered=0,fit=0;const group={addTo(){added++},getBounds(){return{}}},context={groups:{agro:group},active:'agro',map:{removeLayer(){},fitBounds(){fit++}},renderLegend(){rendered++},ethrelController:null};const run=vm.runInNewContext('('+fn+')',context);run('agro');assert.equal(added,1);assert.equal(rendered,1);assert.equal(fit,1);run('missing');assert.equal(added,1);});
test('village HKm blocks and agroforestry are active when Dayun opens',()=>{
 assert.match(source,/contextLayers\[p.contextId\]=layer;layer.addTo\(map\)/);
 assert.match(source,/blockLayer=L.featureGroup\(\[blockHalo,blockLines\]\).addTo\(map\)/);
 assert.match(source,/groups\[active\]\.addTo\(map\);renderLegend\(\);map.fitBounds\(groups\[active\]\.getBounds\(\),\{padding:\[24,24\]\}\);setTimeout/);
 assert.match(source,/layerControl.addOverlay\(groups\[layer.id\]/);
 assert.match(fs.readFileSync('js/dayun-mpts.js','utf8'),/visible = false/);
 assert.match(fs.readFileSync('js/dayun-tree-imports.js','utf8'),/MPTS:false,Sorean:false/);
 assert.doesNotMatch(fs.readFileSync('js/dayun-agro-live.js','utf8'),/layer\.addTo\(map\);control.addOverlay/);
 assert.match(fs.readFileSync('js/dayun-horti-boundary.js','utf8'),/initialVisible:false/);
 const nanas=fs.readFileSync('js/dayun-nanas.js','utf8');assert.match(nanas,/visible = false/);assert.doesNotMatch(nanas,/\}\)\.addTo\(map\)/);
});
test('touch layer chooser remains scrollable within a short screen and category clicks activate hidden geometry',()=>{assert.match(fs.readFileSync('css/dayun.css','utf8'),/max-height:calc\(100dvh - 100px\);overflow:auto/);assert.match(source,/groups\[active\]\.addTo\(map\);map.fitBounds\(bounds/);assert.match(source,/if\(selected\)\{selected.addTo\(map\);map.fitBounds\(selected.getBounds/);});
