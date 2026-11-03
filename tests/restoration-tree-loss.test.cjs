const test=require('node:test'),assert=require('node:assert/strict');
const square={type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]]]};
test('native pixel-center scanlines respect polygon holes and window limits',async()=>{
  const {intervals}=await import('../scripts/extract-restoration-tree-loss.mjs');
  assert.deepEqual(intervals(square,.5,0,1,0,4),[[0,4]]);
  const hole=structuredClone(square);hole.coordinates.push([[1,1],[1,3],[3,3],[3,1],[1,1]]);
  assert.deepEqual(intervals(hole,1.5,0,1,0,4),[[0,1],[3,4]]);
  assert.deepEqual(intervals(hole,1.5,0,1,1,3),[]);
});
test('multipolygon scanlines merge overlapping intervals instead of double counting pixels',async()=>{
  const {intervals}=await import('../scripts/extract-restoration-tree-loss.mjs');
  assert.deepEqual(intervals({type:'MultiPolygon',coordinates:[square.coordinates,square.coordinates]},.5,0,1,0,4),[[0,4]]);
});
test('datamask missingness is separate from mapped zero-loss, water and invalid codes',async()=>{
  const {tally,emptyCounts}=await import('../scripts/extract-restoration-tree-loss.mjs');
  const counts=emptyCounts();tally(counts,new Uint8Array([0,5,25,0,26,4]),new Uint8Array([1,1,1,0,1,2]),[[0,6]]);
  assert.equal(counts.insidePixels,6);assert.equal(counts.mappedLandPixels,3);
  assert.equal(counts.noDataPixels,1);assert.equal(counts.waterPixels,1);assert.equal(counts.invalidValuePixels,1);
  assert.equal(counts.lossYearCounts[0],1);assert.equal(counts.lossYearCounts[5],1);assert.equal(counts.lossYearCounts[25],1);
});
test('subwindow offsets select the correct native raster rows',async()=>{
  const {tally,emptyCounts}=await import('../scripts/extract-restoration-tree-loss.mjs');
  const counts=emptyCounts();tally(counts,new Uint8Array([1,2,3,4]),new Uint8Array([1,1,1,1]),[[0,2]],2);
  assert.equal(counts.lossYearCounts[1],0);assert.equal(counts.lossYearCounts[3],1);assert.equal(counts.lossYearCounts[4],1);
});
