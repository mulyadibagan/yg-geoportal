import sys,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from refine_dayun_candidates import refine


class RefineCandidatesTests(unittest.TestCase):
    def test_unknown_context_is_retained_and_frozen_resume_cannot_mix_models(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=root/'source';source.mkdir();out=root/'out'
            a={'block':'A','source_label':'Agro_ABC','candidate_count':3,'native_tiles':[{'file':'native/x0_y0.tif'}],'zones':[{'id':'GT-A-01','kind':'active_source'}],'full_block_count':{'processed_tiles':1},'method':'radial','limitations':[]}
            features=[{'type':'Feature','geometry':{'type':'Point','coordinates':[102+i*.00001,.58]},'properties':{'id':f'A-radial-x{i}-y0','native_tile':'native/x0_y0.tif','source_pixel':[i,0],'zones':['GT-A-01']}} for i in range(3)]
            zones={'type':'FeatureCollection','features':[{'properties':{'id':'GT-A-01'}}]}
            model={'threshold':4,'signature':'frozen','threshold_rule':'train_only','provenance':{},'evaluation':{'1_heldout':{'samples':7,'retained':7},'0_heldout':{'samples':600,'retained_fraction':.02}}}
            for name,value in [('analysis.json',a),('candidates.geojson',{'features':features}),('zones.geojson',zones)]: (source/name).write_text(json.dumps(value))
            mp=root/'model.json';mp.write_text(json.dumps(model));before={p.name:p.read_bytes() for p in source.iterdir()}
            with patch('refine_dayun_candidates.NativePatches') as reader,patch('refine_dayun_candidates.descriptor',side_effect=[np.ones(35),np.ones(35),None]),patch('refine_dayun_candidates.score',side_effect=[5,3]):
                result=refine(source,source,mp,out,[.01,.01])
            actual=json.loads((out/'candidates.geojson').read_text())['features']
            self.assertEqual([f['properties']['id'] for f in actual],['A-radial-x0-y0','A-radial-x2-y0'])
            self.assertEqual(result['negative_comparison']['unknown_context_retained'],1)
            self.assertEqual(result['zones'][0]['candidate_crowns'],2)
            self.assertEqual({p.name:p.read_bytes() for p in source.iterdir()},before)
            model['threshold']=7;mp.write_text(json.dumps(model))
            with self.assertRaisesRegex(ValueError,'negative_filter_resume_mismatch'):refine(source,source,mp,out,[.01,.01])

    def test_negative_control_validation_gate_prevents_unchecked_publication(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'analysis.json').write_text(json.dumps({'block':'A','source_label':'Agro_ABC','candidate_count':0}));(root/'candidates.geojson').write_text('{"features":[]}');(root/'model.json').write_text('{"evaluation":{}}')
            with self.assertRaisesRegex(ValueError,'negative_filter_validation_gate_failed'):refine(root,root,root/'model.json',root/'out',[.01,.01])


if __name__=='__main__':unittest.main()
