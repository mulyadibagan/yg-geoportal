import hashlib,json,sys,tempfile,unittest
from pathlib import Path
import cv2,numpy as np,rasterio
from rasterio.transform import from_origin
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from calibrate_dayun_review import split_labels,calibrate
from select_dayun_calibrated_result import select_result
from propose_dayun_candidates import suppress


class ReviewCalibrationTests(unittest.TestCase):
    def test_fast_suppression_matches_original_greedy_decisions(self):
        rng=np.random.default_rng(17);points=[(float(s),int(x),int(y)) for s,x,y in rng.random((300,3))*[1,400,400]];expected=[]
        for p in sorted(points,reverse=True):
            if all((p[1]-q[1])**2+(p[2]-q[2])**2>=24**2 for q in expected):expected.append(p)
            if len(expected)==100:break
        self.assertEqual(suppress(points,24,100),expected)

    def test_spatial_holdout_is_separated_and_calibration_does_not_write_labels_or_source(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=root/'source.tif';rgb=np.full((850,900,3),35,dtype='uint8');pixels=[[150+100*x,150+100*y] for y in range(5) for x in range(6)]
            for x,y in pixels:
                for angle in np.linspace(0,2*np.pi,10,endpoint=False):cv2.line(rgb,(x,y),(round(x+22*np.cos(angle)),round(y+22*np.sin(angle))),(110,160,110),3)
            transform=from_origin(102,.6,.000001,.000001)
            with rasterio.open(source,'w',driver='GTiff',width=900,height=850,count=3,dtype='uint8',crs=4326,transform=transform) as ds:ds.write(np.moveaxis(rgb,-1,0))
            labels=[{'type':'Feature','geometry':{'type':'Point','coordinates':list(transform*(x+.5,y+.5))},'properties':{'id':f'A-manual-test-{i:08d}','origin':'manual_addition','status':'accepted','zones':['GT-A-07']}} for i,(x,y) in enumerate(pixels)]
            head={'analysis_path':'block/analysis.json','revision':4,'version':'private/version.json','review':{'source_run':'fixture','changes':labels}};before=json.dumps(head);sha=hashlib.sha256(source.read_bytes()).hexdigest()
            with rasterio.open(source) as ds:model=calibrate(ds,head,'block/analysis.json',root/'out')
            self.assertEqual(json.dumps(head),before);self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),sha);self.assertFalse(model['census_changed']);self.assertIsNone(model['metrics']['spatial_holdout']['precision']);self.assertEqual(model['label_count'],30)
            train,test,guard=split_labels(model['label_pixels']);self.assertEqual(set(train)|set(test)|set(guard),set(range(30)))
            self.assertTrue(all(np.linalg.norm(np.subtract(pixels[i],pixels[j]))>168 for i in train for j in test));self.assertTrue(set(model['prototype_label_indices']).issubset(train));self.assertTrue((root/'out/calibration-label-preview.png').exists())
            self.assertRaisesRegex(ValueError,'source_mismatch',calibrate,None,head,'other/analysis.json',root/'bad')

    def test_selection_uses_training_median_and_excludes_manual_matches_without_injecting_them(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);out=root/'out';point=lambda x,score,manual=False:{'type':'Feature','geometry':{'type':'Point','coordinates':[x,x]},'properties':{'id':f'candidate-{x}','zones':['GT-A-01'],'source_pixel':[x,x],'similarity':score,'boundary_conflict':False,'excluded_by_owner_rejection':False,'represented_by_manual_point':manual}}
            pool={'features':[point(10,.9),point(20,.7,True),point(40,.2)]};raw=json.dumps(pool);(root/'candidate-sensitivity.geojson').write_text(raw)
            analysis={'source_run':'fixture','candidate_count':3,'native_tiles':[{}],'full_block_count':{'processed_tiles':1},'zones':[]};(root/'analysis.json').write_text(json.dumps(analysis));(root/'zones.geojson').write_text(json.dumps({'features':[{'properties':{'id':'GT-A-01'}}]}));(root/'count-provenance.json').write_text(json.dumps({'model_signature':'raw'}))
            model={'source_run':'fixture','model_signature':'raw','threshold':.2,'labels':[],'label_pixels':[[10.5,10.5],[20.5,20.5],[40.5,40.5]],'split':{'train':[0],'heldout':[1],'guard_unused':[2]},'metrics':{},'label_count':3,'training_review_version':'private/version.json','limitations':['Positive-only labels; precision unknown.']}
            result=select_result(root,model,[.8,.6,.7],{'features':[]},out);self.assertEqual(result['full_block_count']['threshold'],.7);self.assertEqual(result['candidate_count'],1);self.assertEqual(result['full_block_count']['model_proposals_represented_by_manual'],1);self.assertEqual(result['model_calibration']['metrics']['spatial_holdout']['calibrated_matched_within_12px'],1);self.assertEqual((root/'candidate-sensitivity.geojson').read_text(),raw)
            model['source_run']='different';self.assertRaisesRegex(ValueError,'different_calibrated_pool',select_result,root,model,[.7],{'features':[]},root/'bad')


if __name__=='__main__':unittest.main()
