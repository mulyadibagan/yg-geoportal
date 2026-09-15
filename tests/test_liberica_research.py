import json
from pathlib import Path
import unittest
from PIL import Image

from scripts.extract_liberica_research import source_image_numbers


ROOT = Path(__file__).resolve().parents[1]


class LibericaResearchDatasetTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "data/liberica-morphology-2026.json").read_text(encoding="utf-8"))

    def test_complete_observation_sequence(self):
        observations = self.data["observations"]
        self.assertEqual(len(observations), 60)
        self.assertEqual([row["sample_number"] for row in observations], list(range(1, 61)))
        self.assertEqual(len({row["observation_id"] for row in observations}), 60)

    def test_population_distribution(self):
        counts = {}
        for row in self.data["observations"]:
            counts[row["population_code"]] = counts.get(row["population_code"], 0) + 1
        self.assertEqual(counts, {"KB1": 10, "KB2": 10, "BT": 10, "PN": 10, "PK1": 10, "PK2": 10})

    def test_photos_are_replaceable_and_present(self):
        for row in self.data["observations"]:
            self.assertEqual(len(row["photos"]), 2)
            for photo in row["photos"]:
                self.assertEqual(photo["observation_id"], row["observation_id"])
                self.assertTrue(photo["temporary"])
                self.assertTrue((ROOT / photo["src"]).exists())

    def test_pdf_photo_order_and_plant_orientation(self):
        self.assertEqual(source_image_numbers(1), (17, 18))
        self.assertEqual(source_image_numbers(2), (15, 16))
        self.assertEqual(source_image_numbers(3), (25, 26))
        self.assertEqual(source_image_numbers(6), (19, 20))
        self.assertEqual(source_image_numbers(59), (133, 134))
        self.assertEqual(source_image_numbers(60), (131, 132))
        for path in sorted((ROOT / "assets/liberica-research/observations").glob("*-plant.png")):
            with Image.open(path) as image:
                self.assertGreater(image.height, image.width, path.name)

    def test_statistics_are_recomputed_from_individual_rows(self):
        rows = self.data["observations"]
        self.assertEqual(sum(row["leaf_colour"] == "Hijau pekat" for row in rows), 53)
        self.assertEqual(self.data["statistics"]["categorical"]["leaf_colour"][0]["percent"], 88.33)
        heights = [row["height_cm"] for row in rows]
        self.assertEqual((min(heights), max(heights)), (155, 700))


if __name__ == "__main__":
    unittest.main()
