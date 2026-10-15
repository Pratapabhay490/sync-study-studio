"""Run with: python3 -m unittest discover -s tests -p '*_test.py'."""
import json
from pathlib import Path
import unittest


class AvatarAssetBudgetTests(unittest.TestCase):
    def test_all_five_characters_have_eight_moods(self):
        folder = Path(__file__).resolve().parents[1] / "src/assets/avatar-anims"
        expected = {
            f"{character}-{mood}.webp.asset.json"
            for character in ("fox", "panda", "astronaut", "cat", "owl")
            for mood in ("idle", "happy", "cheering", "studying", "sleepy", "dancing", "waving", "sad")
        }
        self.assertEqual({p.name for p in folder.glob("*.asset.json")}, expected)

    def test_every_animation_stays_lightweight(self):
        folder = Path(__file__).resolve().parents[1] / "src/assets/avatar-anims"
        for pointer in folder.glob("*.asset.json"):
            with self.subTest(clip=pointer.name):
                asset = json.loads(pointer.read_text())
                self.assertGreater(asset["size"], 0)
                self.assertLessEqual(asset["size"], 150_000)
                self.assertEqual(asset["content_type"], "image/webp")


if __name__ == "__main__":
    unittest.main()