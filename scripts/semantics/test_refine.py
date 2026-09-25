"""Publication-boundary checks without loading a model or making network calls."""
import unittest
import json
from pathlib import Path
from unittest.mock import patch

from refine import digest, final_grammar, lexical_domain, parse_response, query_model, render_messages


class ContextualInferenceTests(unittest.TestCase):
    def test_frozen_asset_and_policy_pins_agree(self):
        directory = Path(__file__).parent
        spec = json.loads((directory / "contextual-model.json").read_text())
        assets = json.loads((directory / "contextual-assets.json").read_text())
        self.assertEqual(digest(spec["policy"]), spec["manifest"]["policyDigest"])
        self.assertEqual(digest(spec["prompt"]), spec["manifest"]["promptDigest"])
        self.assertEqual(assets["model"]["sha256"], spec["manifest"]["modelDigest"])
        self.assertEqual(assets["model"]["revision"], spec["manifest"]["modelRevision"])
        self.assertEqual(assets["runtime"]["build"], spec["policy"]["runtimeBuild"])
        self.assertEqual(assets["model"]["conversionRevision"], spec["policy"]["quantizationRevision"])

    def setUp(self):
        self.spec = {
            "prompt": {"system": "Use source meanings.", "examples": [],
                       "userTemplate": "{meaningGroups}\n{numberedLemmaPosLexicalDomainDefinitions}"},
            "policy": {"meaningGroups": {"TEST": [
                {"label": "HEAT", "relation": "similar", "concepts": ["heat"]},
                {"label": "COLD", "relation": "opposite", "concepts": ["cold"]},
                {"label": "LIGHT", "relation": "neutral", "concepts": ["illumination"]},
            ]}},
        }
        self.payload = {"enemyWord": "TEST", "qualifiedSenses": [
            {"id": "oewn-warm__3.00.00..", "lemma": "warm", "partOfSpeech": "adjective",
             "definition": "having moderate heat"},
            {"id": "oewn-freeze__2.30.00..", "lemma": "freeze", "partOfSpeech": "verb",
             "definition": "make very cold"},
        ]}

    def test_polarity_comes_from_frozen_group_and_source_index(self):
        result = parse_response(self.spec, self.payload, "Making cold directly denotes cooling. FINAL COLD 1")
        self.assertEqual(result["relation"], "opposite")
        self.assertEqual(result["selectedSenseId"], self.payload["qualifiedSenses"][1]["id"])

    def test_neutral_distractor_is_not_enemy_reinforcement(self):
        result = parse_response(self.spec, self.payload, "The meaning is illumination. FINAL LIGHT 0")
        self.assertEqual(result["relation"], "neutral")

    def test_ambiguous_or_unverifiable_outputs_fail(self):
        for response in (
            "First thought. FINAL HEAT 0\nSecond thought. FINAL COLD 1",
            "A fabricated class. FINAL SAFETY 0",
            "An absent source. FINAL COLD 99",
            "No source index. FINAL COLD",
            "FINAL COLD 1",
            "Explanation. FINAL COLD 1 unfinished reasoning",
        ):
            with self.subTest(response=response), self.assertRaises(ValueError):
                parse_response(self.spec, self.payload, response)

    def test_prompt_preserves_source_identity_and_domain(self):
        message = render_messages(self.spec, self.payload)[-1]["content"]
        self.assertIn("freeze (verb; dictionary domain verb.change): make very cold", message)
        self.assertIn("0: warm", message)
        self.assertEqual(lexical_domain("oewn-gloomy__5.00.00.dejected.00"),
                         "adj.all; adjective head: dejected")

    def test_shared_input_digest_ignores_object_key_order_only(self):
        self.assertEqual(digest({"a": 1, "b": "c"}), digest({"b": "c", "a": 1}))
        self.assertNotEqual(digest(self.payload), digest({**self.payload, "enemyWord": "OTHER"}))

    def test_constrained_format_admits_only_supplied_groups_and_indices(self):
        grammar = final_grammar(self.spec, self.payload)
        self.assertIn('group ::= "HEAT" | "COLD" | "LIGHT" | "OTHER"', grammar)
        self.assertIn('index ::= "0" | "1"', grammar)
        self.assertNotIn('"WINTER"', grammar)
        self.assertNotIn('"2"', grammar)

    def test_validation_retry_preserves_error_and_uses_supplied_labels(self):
        self.spec["policy"].update(maxAttempts=3, temperature=0, seed=123, maxTokens=100,
                                   thinking=False, validationRetryPrompt="{error}; {allowedGroups}; {maximumIndex}")
        replies = ["Unexpected group. FINAL WINTER 0", "Making cold denotes cooling. FINAL COLD 1"]
        with patch("refine.http_json", side_effect=[
            {"choices": [{"message": {"content": text}}]} for text in replies
        ]) as http:
            result = query_model("http://127.0.0.1", self.spec, self.payload)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(len(result["attempts"]), 2)
        self.assertIn("outside the frozen policy", result["attempts"][0]["error"])
        self.assertIn("HEAT, COLD, LIGHT, OTHER", http.call_args.args[2]["messages"][-1]["content"])

    def test_valid_neutral_is_not_retried_and_invalid_never_falls_back(self):
        self.spec["policy"].update(maxAttempts=2, temperature=0, seed=123, maxTokens=100,
                                   thinking=False, validationRetryPrompt="{error}; {allowedGroups}; {maximumIndex}")
        with patch("refine.http_json", return_value={"choices": [{"message": {
            "content": "The definition belongs to no supplied group. FINAL OTHER 0"}}]}) as http:
            result = query_model("http://127.0.0.1", self.spec, self.payload)
            self.assertEqual(result["relation"], "neutral")
            self.assertEqual(http.call_count, 1)
        with patch("refine.http_json", return_value={"choices": [{"message": {"content": "Broken output"}}]}):
            result = query_model("http://127.0.0.1", self.spec, self.payload)
            self.assertEqual(result["status"], "error")
            self.assertEqual(len(result["attempts"]), 2)
            self.assertNotIn("relation", result)


if __name__ == "__main__":
    unittest.main()
