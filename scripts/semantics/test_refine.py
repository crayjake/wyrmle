"""Publication-boundary checks without loading a model or making network calls."""
import unittest
import json
from pathlib import Path
from unittest.mock import patch

from refine import digest, final_grammar, independent_source_requests, lexical_domain, parse_response, query_model, render_messages, sense_input, source_category_cues, validate_verification_trace


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

    def test_explicit_source_index_can_follow_the_final_group_on_a_new_line(self):
        for final in ("FINAL: COLD\nINDEX: 1", "FINAL COLD\nSource Index: 1"):
            result = parse_response(self.spec, self.payload, "The action makes things cold.\n" + final)
            self.assertEqual(result["relation"], "opposite")
            self.assertEqual(result["selectedSenseId"], self.payload["qualifiedSenses"][1]["id"])
        with self.assertRaises(ValueError):
            parse_response(self.spec, self.payload, "Cold action. FINAL COLD\nSource Index: 1 or 0")

    def test_quoted_definition_must_match_the_selected_source_index(self):
        self.spec["policy"]["requireQuotedDefinition"] = True
        text = "DEFINITION: make very cold\nThis action causes cold. FINAL COLD 1"
        result = parse_response(self.spec, self.payload, text)
        self.assertEqual(result["explanation"], "This action causes cold.")
        labeled = text.replace("DEFINITION: make very cold", "DEFINITION: freeze (verb; dictionary domain verb.change): make very cold")
        self.assertEqual(parse_response(self.spec, self.payload, labeled), result)
        for invalid in (text.replace("COLD 1", "COLD 0"), text.replace("make very cold", "cool things down")):
            with self.assertRaises(ValueError):
                parse_response(self.spec, self.payload, invalid)

    def test_every_source_sense_requires_its_own_grounded_category_decision(self):
        self.spec["policy"].update(senseCategories={"COLD": "cold", "HEAT": "heat", "OTHER": "other"},
                                  categoryNames={"COLD": "cold", "HEAT": "heat", "OTHER": "other"},
                                  categoryRelations={"TEST": {"COLD": "opposite", "HEAT": "similar"}},
                                  relationPriority=["opposite", "similar"])
        body = {"senses": [{"index": 0, "definition": "having moderate heat", "categories": ["HEAT"]},
                           {"index": 1, "definition": "make very cold", "categories": ["COLD"]}]}
        result = parse_response(self.spec, self.payload, json.dumps(body))
        self.assertEqual(result["selectedSenseId"], self.payload["qualifiedSenses"][1]["id"])
        self.assertEqual(result["relation"], "opposite")
        self.assertEqual(len(result["senseDecisions"]), 2)
        for mutate in (lambda b: b["senses"].pop(),
                       lambda b: b["senses"][1].update(index=0),
                       lambda b: b["senses"][1].update(definition="invented"),
                       lambda b: b["senses"][1].update(categories=["FOREIGN"]),
                       lambda b: b["senses"][1].update(categories=["OTHER", "COLD"])):
            invalid = json.loads(json.dumps(body))
            mutate(invalid)
            with self.assertRaises(ValueError):
                parse_response(self.spec, self.payload, json.dumps(invalid))
        grammar = final_grammar(self.spec, self.payload)
        self.assertIn("sense0", grammar)
        self.assertIn("sense1", grammar)
        self.assertIn("make very cold", grammar)

    def test_independent_sense_inference_has_no_model_selected_source_index(self):
        self.spec["policy"].update(independentSenseInference=True,
                                  senseCategories={"COLD": "cold", "HEAT": "heat", "OTHER": "other"})
        payload = {**self.payload, "qualifiedSenses": self.payload["qualifiedSenses"][:1]}
        self.assertEqual(parse_response(self.spec, payload, '{"categories":["HEAT"]}'),
                         {"status": "ok", "categories": ["HEAT"]})
        for text in ('{"categories":["OTHER","HEAT"]}', '{"categories":["HEAT","HEAT"]}',
                     '{"categories":["UNKNOWN"]}', '{"categories":["HEAT"],"index":1}'):
            with self.assertRaises(ValueError):
                parse_response(self.spec, payload, text)
        self.assertIn("categories", final_grammar(self.spec, payload))

    def test_source_preference_requires_agreement_with_the_reviewed_relation(self):
        self.spec["policy"].update(senseCategories={"COLD": "cold", "HEAT": "heat", "OTHER": "other"},
                                  categoryNames={"COLD": "cold", "HEAT": "heat"},
                                  categoryRelations={"TEST": {"COLD": "opposite", "HEAT": "similar"}},
                                  relationPriority=["opposite", "similar"],
                                  sourceSelection="baseline-agreement-then-directness-v1",
                                  sourceDomainPriority={"adj.all": 0, "verb.change": 1})
        self.payload["preferredSenseId"] = self.payload["qualifiedSenses"][0]["id"]
        body = {"senses": [{"index": 0, "definition": "having moderate heat", "categories": ["HEAT"]},
                           {"index": 1, "definition": "make very cold", "categories": ["COLD"]}]}
        result = parse_response(self.spec, self.payload, json.dumps(body))
        self.assertEqual(result["selectedSenseId"], self.payload["qualifiedSenses"][1]["id"])
        for row in body["senses"]:
            row["categories"] = ["COLD"]
        self.assertEqual(parse_response(self.spec, self.payload, json.dumps(body))["selectedSenseId"], self.payload["preferredSenseId"])
        for row in body["senses"]:
            row["categories"] = ["OTHER"]
        self.payload["preferredSenseId"] = self.payload["qualifiedSenses"][1]["id"]
        self.assertEqual(parse_response(self.spec, self.payload, json.dumps(body))["selectedSenseId"], self.payload["preferredSenseId"])

    def test_source_work_is_deduplicated_without_losing_any_sense(self):
        self.spec["manifest"] = {field: "test" for field in ("promptDigest", "policyDigest", "sourceDigest")}
        self.spec["prompt"]["userTemplate"] = "{senseCategories}\n{numberedLemmaPosLexicalDomainDefinitions}"
        pending = {"first": (self.payload, None), "inflection": ({**self.payload, "preferredSenseId": "other"}, None),
                   "subset": ({**self.payload, "qualifiedSenses": self.payload["qualifiedSenses"][:1]}, None)}
        requests = independent_source_requests(self.spec, pending)
        self.assertEqual(len(requests), 2)
        self.assertEqual({p["qualifiedSenses"][0]["id"] for p in requests.values()},
                         {sense["id"] for sense in self.payload["qualifiedSenses"]})
        self.spec["prompt"]["userTemplate"] += "{enemyWord}"
        with self.assertRaisesRegex(ValueError, "must not depend"):
            independent_source_requests(self.spec, pending)

    def test_verification_must_check_every_proposed_scoring_sense_and_retain_provenance(self):
        proposal = {"manifest": {field: "first-pass" for field in ("promptDigest", "policyDigest", "sourceDigest")},
                    "policy": {"senseCategories": {"HEAT": "heat", "OTHER": "other"}}}
        spec = {"proposal": proposal, "policy": {"verification": {"scoringCategories": ["HEAT"]}}}
        sense = self.payload["qualifiedSenses"][0]
        row = {"proposal": {"response": '{"categories":["HEAT"]}', "inputDigest": digest(sense_input(proposal, sense))},
               "verified": True, "categories": ["OTHER"], "response": '{"categories":["OTHER"]}'}
        validate_verification_trace(spec, sense, row)
        for changes in ({"verified": False}, {"categories": ["COLD"]}, {"proposal": {**row["proposal"], "inputDigest": "changed"}}):
            with self.assertRaises(ValueError):
                validate_verification_trace(spec, sense, {**row, **changes})
        row["proposal"]["response"] = '{"categories":["OTHER"]}'
        row["verified"] = False
        validate_verification_trace(spec, sense, row)
        with self.assertRaises(ValueError):
            validate_verification_trace(spec, sense, {**row, "response": '{"categories":["HEAT"]}'})

    def test_source_cues_require_review_even_after_a_neutral_proposal_but_do_not_award_a_label(self):
        proposal = {"manifest": {field: "first-pass" for field in ("promptDigest", "policyDigest", "sourceDigest")},
                    "policy": {"senseCategories": {"ORDER": "order", "OTHER": "other"}}}
        spec = {"proposal": proposal, "policy": {"verification": {"scoringCategories": ["ORDER"], "cuePatterns": {"ORDER": r"\btidy\b"}}}}
        sense = {"id": "fixture", "lemma": "tool", "partOfSpeech": "noun", "definition": "An object used to tidy things."}
        self.assertEqual(source_category_cues(spec, sense), ["ORDER"])
        row = {"proposal": {"response": '{"categories":["OTHER"]}', "inputDigest": digest(sense_input(proposal, sense))},
               "verified": True, "cueCategories": ["ORDER"], "categories": ["OTHER"], "response": '{"categories":["OTHER"]}'}
        validate_verification_trace(spec, sense, row)
        for changes in ({"verified": False}, {"cueCategories": []}):
            with self.assertRaises(ValueError):
                validate_verification_trace(spec, sense, {**row, **changes})

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

    def test_invalid_mixed_other_response_gets_a_grammar_repair_without_relaxing_validation(self):
        self.spec["policy"].update(independentSenseInference=True, senseCategories={"PHYSICAL": "physical", "OTHER": "other"},
                                  maxAttempts=3, temperature=0.7, seed=123, maxTokens=128, thinking=False,
                                  constrainedFinalLabel=True, validationRetryPrompt="{error}; return valid categories")
        payload = {**self.payload, "qualifiedSenses": self.payload["qualifiedSenses"][:1]}
        with patch("refine.http_json", side_effect=[{"choices": [{"message": {"content": response}}]} for response in
                  ['{"categories":["PHYSICAL","OTHER"]}', '{"categories":["PHYSICAL"]}']]) as http:
            result = query_model("http://127.0.0.1", self.spec, payload)
        self.assertEqual(result["categories"], ["PHYSICAL"])
        self.assertEqual(result["attempts"][1]["syntaxRepair"], "standalone-other-v1")
        self.assertIn("error", result["attempts"][0])
        grammar = http.call_args.args[2]["grammar"]
        self.assertIn('choices ::=', grammar)
        self.assertNotIn('OTHER', grammar.split('category ::=')[1])


if __name__ == "__main__":
    unittest.main()
