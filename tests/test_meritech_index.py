import importlib.util, io, unittest
from pathlib import Path
from PIL import Image

spec=importlib.util.spec_from_file_location('builder',Path(__file__).parents[1]/'scripts/build-meritech-index.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Classification(unittest.TestCase):
    def png(self, im):
        b=io.BytesIO();im.save(b,format='PNG');return b.getvalue()
    def test_solid_placeholders_are_not_coverage(self):
        for color in ['black','white','#777777']:
            self.assertEqual(m.classify_image(self.png(Image.new('RGB',(256,256),color))),'blank')
    def test_transparent_is_not_coverage(self):
        self.assertEqual(m.classify_image(self.png(Image.new('RGBA',(256,256),(0,0,0,0)))),'blank')
    def test_decode_failure_is_not_no_coverage(self):
        self.assertEqual(m.classify_image(b'upstream timeout'),'error')
    def test_textured_image_is_candidate(self):
        self.assertEqual(m.classify_image(self.png(Image.effect_noise((256,256),40))),'imagery')
    def test_coordinate_order(self):
        self.assertEqual(m.tile(102.12,1.48),(102716,64997))

if __name__=='__main__':unittest.main()
