"""Direction and scope safeguards for source-backed semantic classification."""
import unittest

from infer import directional_proofs


class DirectionalProofTests(unittest.TestCase):
    def make_source(self):
        source = {
            "senseSynsets": {
                "calm": "calm-state", "pacify": "pacifying", "anger": "angry-state",
                "composure": "composed-state", "deep": "deep-state",
                "middle": "middle-state", "soft": "physical-softness", "descendant": "descendant-state",
            },
            "synsets": {
                "calm-state": {"relations": [{"type": "hypernym", "target": "emotion"}]},
                "pacifying": {"relations": [{"type": "causes", "target": "calm-state"}]},
                "angry-state": {"relations": [{"type": "hypernym", "target": "emotion"}]},
                "composed-state": {"relations": [{"type": "hypernym", "target": "calm-state"}]},
                "deep-state": {"relations": [{"type": "hypernym", "target": "middle-state"}]},
                "middle-state": {"relations": [{"type": "hypernym", "target": "composed-state"}]},
                "physical-softness": {"relations": [{"type": "hypernym", "target": "calm-state"}]},
                "descendant-state": {"relations": [{"type": "hypernym", "target": "physical-softness"}]},
                "emotion": {"relations": []},
            },
        }
        profile = {"roots": [{"senseId": "calm", "relation": "opposite"}], "relations": {},
                   "excludedSenseIds": [], "reviewedExclusions": {}}
        return source, profile

    def test_shared_ancestor_is_not_opposition_but_explicit_cause_is_evidence(self):
        source, profile = self.make_source()
        proofs = directional_proofs(source, profile, list(source["senseSynsets"]))
        self.assertNotIn("anger", proofs)
        self.assertEqual(proofs["pacify"][0]["relation"], "opposite")
        self.assertEqual(proofs["pacify"][0]["path"][0]["type"], "causes")
        self.assertEqual(proofs["composure"][0]["path"][0]["type"], "hypernym")
        self.assertNotIn("deep", proofs, "Three edges exceed the declared proof scope")

    def test_excluded_concepts_block_intermediate_paths(self):
        source, profile = self.make_source()
        profile["reviewedExclusions"] = {"soft": "Physical softness is not emotional calm."}
        profile["excludedSenseIds"] = ["soft"]
        proofs = directional_proofs(source, profile, list(source["senseSynsets"]))
        self.assertNotIn("soft", proofs)
        self.assertNotIn("descendant", proofs)
        self.assertIn("pacify", proofs)

    def test_spelling_specific_exclusion_does_not_remove_other_synonyms(self):
        source, profile = self.make_source()
        source["senseSynsets"].update({"rare-reading": "calm-state", "ordinary-reading": "calm-state"})
        profile["excludedSenseIds"] = ["rare-reading"]
        proofs = directional_proofs(source, profile, list(source["senseSynsets"]))
        self.assertNotIn("rare-reading", proofs)
        self.assertIn("ordinary-reading", proofs)

    def test_explicit_event_role_counts_toward_the_two_edge_limit(self):
        source, profile = self.make_source()
        source["senseSynsets"].update({"event-action": "unconnected", "deep-action": "unconnected",
                                      "agent-action": "unconnected"})
        source["synsets"]["unconnected"] = {"relations": []}
        source["senseRoles"] = {
            "event-action": [{"type": "other", "qualifier": "event", "target": "composure"}],
            "deep-action": [{"type": "other", "qualifier": "state", "target": "middle"}],
            "agent-action": [{"type": "other", "qualifier": "agent", "target": "calm"}],
        }
        proofs = directional_proofs(source, profile, list(source["senseSynsets"]))
        path = proofs["event-action"][0]["path"]
        self.assertEqual(len(path), 2)
        self.assertEqual(path[0], {"type": "other", "qualifier": "event",
                                   "from": "event-action", "to": "composure"})
        self.assertNotIn("deep-action", proofs, "A role plus two concept edges is out of scope")
        self.assertNotIn("agent-action", proofs, "Agents are not their associated states or events")


if __name__ == "__main__":
    unittest.main()
