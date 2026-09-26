#!/usr/bin/env python3
"""Review exported puzzle inputs on a pinned localhost model; never run in play.

The TypeScript exporter supplies spelling-specific baseline hashes. Inference
is shared by exact source-input digest, and every response (including errors)
is saved before producing the per-word publication memos.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import fcntl
import hashlib
import json
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request

LEXNAMES = [
    "adj.all", "adj.pert", "adv.all", "noun.Tops", "noun.act", "noun.animal",
    "noun.artifact", "noun.attribute", "noun.body", "noun.cognition",
    "noun.communication", "noun.event", "noun.feeling", "noun.food", "noun.group",
    "noun.location", "noun.motive", "noun.object", "noun.person", "noun.phenomenon",
    "noun.plant", "noun.possession", "noun.process", "noun.quantity", "noun.relation",
    "noun.shape", "noun.state", "noun.substance", "noun.time", "verb.body",
    "verb.change", "verb.cognition", "verb.communication", "verb.competition",
    "verb.consumption", "verb.contact", "verb.creation", "verb.emotion", "verb.motion",
    "verb.perception", "verb.possession", "verb.social", "verb.stative", "verb.weather",
    "adj.ppl",
]
PIN_FIELDS = ("modelId", "modelRevision", "modelDigest", "promptDigest", "policyDigest", "sourceDigest")


def canonical(value):
    # Input and prompt payloads contain strings, booleans and small exact
    # integers. Spelling-specific float hashes are supplied by TypeScript.
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".partial")
    temporary.write_text(canonical(value) + "\n")
    temporary.replace(path)


def lexical_domain(sense_id, lexnames=LEXNAMES):
    parts = sense_id.split("__")[-1].split(".")
    if len(parts) > 3 and parts[1].isdigit() and int(parts[1]) < len(lexnames):
        name = lexnames[int(parts[1])]
        if parts[0] == "5":
            name += "; adjective head: " + parts[3].replace("_", " ")
        return name
    return "function word"


def render_messages(spec, payload):
    prompt, policy = spec["prompt"], spec["policy"]
    groups = policy["meaningGroups"][payload["enemyWord"]]
    meanings = "\n".join(group["label"] + " = " + "; ".join(group["concepts"]) for group in groups)
    definitions = "\n".join(
        f"{index}: {sense['lemma']} ({sense['partOfSpeech']}; dictionary domain "
        f"{lexical_domain(sense['id'], prompt.get('lexnames', LEXNAMES))}): {sense['definition']}"
        for index, sense in enumerate(payload["qualifiedSenses"])
    )
    user = prompt["userTemplate"].replace("{meaningGroups}", meanings).replace(
        "{numberedLemmaPosLexicalDomainDefinitions}", definitions)
    user = user.replace("{enemyWord}", payload["enemyWord"]).replace(
        "{enemyDefinition}", payload.get("enemyDefinition", ""))
    admitted = payload.get("proposedCategories", policy.get("senseCategories", {}))
    user = user.replace("{senseCategories}", "\n".join(
        name + " = " + definition for name, definition in policy.get("senseCategories", {}).items() if name in admitted))
    user = user.replace("{sourceSenseJSON}", json.dumps(payload["qualifiedSenses"][0]
        if len(payload["qualifiedSenses"]) == 1 else payload["qualifiedSenses"], sort_keys=True))
    if re.search(r"\{\w+\}", user):
        raise ValueError("Unsupported prompt template field")
    messages = [{"role": "system", "content": prompt["system"]}]
    for question, answer in prompt["examples"]:
        messages.extend([{"role": "user", "content": question}, {"role": "assistant", "content": answer}])
    messages.append({"role": "user", "content": user})
    return messages


def parse_response(spec, payload, response):
    if spec["policy"].get("independentSenseInference") and len(payload["qualifiedSenses"]) == 1:
        body = json.loads(response)
        if not isinstance(body, dict) or set(body) != {"categories"}:
            raise ValueError("Return only a categories JSON object for the supplied source sense")
        validate_categories(spec["policy"], body["categories"])
        if "proposedCategories" in payload and any(category not in [*payload["proposedCategories"], "OTHER"] for category in body["categories"]):
            raise ValueError("Verification may retain only proposed scoring categories, or OTHER")
        return {"status": "ok", "categories": body["categories"]}
    if spec["policy"].get("senseCategories"):
        return parse_sense_categories(spec, payload, response)
    if len(re.findall(r"\bFINAL\b", response)) != 1:
        raise ValueError("Model must emit exactly one final decision across the supplied senses")
    match = re.search(r"\bFINAL\s*[:\-]?\s*([A-Z_]+)\s*[,;:]?\s*"
                      r"(?:(?:[Ss][Oo][Uu][Rr][Cc][Ee]\s+)?[Ii][Nn][Dd][Ee][Xx]\s*:\s*)?"
                      r"(\d+)\s*\.?\s*$", response)
    if not match:
        raise ValueError("Model response has no complete final group and source index")
    groups = {group["label"]: group["relation"] for group in spec["policy"]["meaningGroups"][payload["enemyWord"]]}
    groups["OTHER"] = "neutral"
    if match[1] not in groups:
        raise ValueError("Model selected a group outside the frozen policy")
    index = int(match[2])
    senses = payload["qualifiedSenses"]
    if not 0 <= index < len(senses):
        raise ValueError("Model selected a source index outside the admitted input")
    explanation = response[:match.start()].strip()
    if spec["policy"].get("requireQuotedDefinition"):
        quote = re.search(r"^DEFINITION:\s*(.+)$", explanation, re.MULTILINE)
        def quotes_for(source_index):
            sense = senses[source_index]
            source_line = (f"{sense['lemma']} ({sense['partOfSpeech']}; dictionary domain "
                           f"{lexical_domain(sense['id'], spec['prompt'].get('lexnames', LEXNAMES))}): {sense['definition']}")
            return {" ".join(value.split()) for value in (sense["definition"], source_line, f"{source_index}: {source_line}")}
        quoted = " ".join(quote[1].split()) if quote else ""
        if quoted not in quotes_for(index):
            matches = [i for i in range(len(senses)) if quoted in quotes_for(i)]
            detail = (f" Your quoted definition belongs to source index {matches}, not {index}."
                      if matches else " The quotation is missing or does not exactly match any supplied definition.")
            raise ValueError("DEFINITION must copy the selected source index's exact definition." + detail)
        explanation = (explanation[:quote.start()] + explanation[quote.end():]).strip()
    if not explanation:
        raise ValueError("Model did not explain its semantic decision")
    return {"status": "ok", "relation": groups[match[1]], "selectedSenseId": senses[index]["id"],
            "selectedGroup": match[1], "explanation": explanation}


def validate_categories(policy, categories):
    if (not isinstance(categories, list) or not 1 <= len(categories) <= 4
            or any(not isinstance(category, str) or category not in policy["senseCategories"] for category in categories)
            or len(set(categories)) != len(categories)
            or ("OTHER" in categories and len(categories) != 1)):
        raise ValueError("Use distinct supplied categories, or OTHER alone")


def parse_sense_categories(spec, payload, response):
    """Require a source-checked decision for every sense, then map categories to the target."""
    body = json.loads(response)
    senses = payload["qualifiedSenses"]
    if not isinstance(body, dict) or set(body) != {"senses"} or not isinstance(body["senses"], list) or len(body["senses"]) != len(senses):
        raise ValueError("Return exactly one entry for every supplied source sense")
    policy = spec["policy"]
    candidates = []
    for index, (row, sense) in enumerate(zip(body["senses"], senses)):
        expected_keys = {"index", "definition", "categories"}
        if policy.get("independentSenseInference"):
            expected_keys |= {"response", "inputDigest"}
        if policy.get("verification"):
            expected_keys |= {"proposal", "verified"}
            if policy["verification"].get("cuePatterns"):
                expected_keys.add("cueCategories")
        if (not isinstance(row, dict) or set(row) != expected_keys
                or type(row["index"]) is not int or row["index"] != index or row["definition"] != sense["definition"]):
            raise ValueError(f"Source index {index} must retain its exact dictionary definition")
        categories = row["categories"]
        validate_categories(policy, categories)
        if policy.get("independentSenseInference"):
            if json.loads(row["response"]) != {"categories": categories} or row["inputDigest"] != digest(sense_input(spec, sense)):
                raise ValueError("Per-sense categories or source input differ from the actual individual model response")
        if policy.get("verification"):
            validate_verification_trace(spec, sense, row)
        for category in categories:
            relation = policy["categoryRelations"][payload["enemyWord"]].get(category, "neutral")
            if relation != "neutral":
                candidates.append((relation, index, category))
    # The game admits any directly supported scoring sense. A fixed preference
    # makes genuinely ambivalent words reproducible; all per-sense evidence remains.
    if candidates:
        def source_rank(index):
            sense = senses[index]
            domain = lexical_domain(sense["id"], spec["prompt"].get("lexnames", LEXNAMES)).split(";")[0]
            return policy.get("sourceDomainPriority", {}).get(domain, 5)
        relation, index, category = min(candidates, key=lambda item: (
            policy["relationPriority"].index(item[0]),
            int(senses[item[1]]["id"] != payload.get("preferredSenseId")) if policy.get("sourceSelection") else 0,
            source_rank(item[1]) if policy.get("sourceSelection") else 0, item[1], item[2]))
        explanation = f"This sense expresses {policy['categoryNames'][category]}, which {'counters' if relation == 'opposite' else 'reinforces'} {payload['enemyWord']}."
    else:
        index = next((i for i, sense in enumerate(senses) if policy.get("sourceSelection") and sense["id"] == payload.get("preferredSenseId")), 0)
        relation, category = "neutral", "OTHER"
        explanation = f"None of the reviewed dictionary senses directly counters or reinforces {payload['enemyWord']}."
    return {"status": "ok", "relation": relation, "selectedSenseId": senses[index]["id"],
            "selectedGroup": category, "explanation": explanation, "senseDecisions": body["senses"]}


def sense_input(spec, sense):
    return {"sense": sense, **{field: spec["manifest"][field] for field in ("promptDigest", "policyDigest", "sourceDigest")}}


def source_category_cues(spec, sense):
    """Recall suggestions only: an actual verifier response is still required."""
    text = sense["lemma"] + "\n" + sense["definition"]
    return sorted(category for category, pattern in spec["policy"].get("verification", {}).get("cuePatterns", {}).items()
                  if re.search(pattern, text, re.IGNORECASE | re.ASCII))


def validate_verification_trace(spec, sense, row):
    proposal = row["proposal"]
    if not isinstance(proposal, dict) or set(proposal) != {"response", "inputDigest"}:
        raise ValueError("Verification must preserve the original proposal response and input digest")
    if proposal["inputDigest"] != digest(sense_input(spec["proposal"], sense)):
        raise ValueError("Verification proposal belongs to another source or classifier")
    body = json.loads(proposal["response"])
    if not isinstance(body, dict) or set(body) != {"categories"}:
        raise ValueError("Invalid proposal response")
    validate_categories(spec["proposal"]["policy"], body["categories"])
    scoring = [category for category in body["categories"] if category in spec["policy"]["verification"]["scoringCategories"]]
    if spec["policy"]["verification"].get("cuePatterns"):
        cues = source_category_cues(spec, sense)
        if row.get("cueCategories") != cues:
            raise ValueError("Source-text category proposals differ from the frozen cue policy")
        scoring = sorted(set(scoring + cues))
    if type(row["verified"]) is not bool or row["verified"] != bool(scoring):
        raise ValueError("Every proposed scoring sense requires independent verification")
    if scoring:
        if any(category not in [*scoring, "OTHER"] for category in row["categories"]):
            raise ValueError("Verification introduced an unproposed category")
    elif row["response"] != proposal["response"]:
        raise ValueError("Unverified non-scoring response was changed")


def independent_source_requests(spec, pending):
    """Schedule distinct senses before word aggregation, avoiding inflection lock queues."""
    if any(field in spec["prompt"]["userTemplate"] for field in ("{enemyWord}", "{enemyDefinition}", "{meaningGroups}")):
        raise ValueError("Shared source classification must not depend on the target enemy")
    sources = {}
    for payload, _previous in pending.values():
        for sense in payload["qualifiedSenses"]:
            key = digest(sense_input(spec, sense))
            sources.setdefault(key, {**payload, "qualifiedSenses": [sense]})
    return sources


def http_json(endpoint, route, body=None):
    request = urllib.request.Request(endpoint + route,
                                    data=None if body is None else json.dumps(body).encode(),
                                    headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.load(response)


def final_grammar(spec, payload, repair_categories=False):
    if spec["policy"].get("independentSenseInference"):
        categories = [*payload["proposedCategories"], "OTHER"] if "proposedCategories" in payload else spec["policy"]["senseCategories"]
        if repair_categories:
            return ('root ::= "{\\\"categories\\\":[" choices "]}"\n'
                    + 'choices ::= ' + json.dumps(json.dumps('OTHER')) + ' | category ("," category)? ("," category)? ("," category)?\n'
                    + 'category ::= ' + ' | '.join(json.dumps(json.dumps(name)) for name in categories if name != 'OTHER') + '\n')
        return ('root ::= "{\\\"categories\\\":[" category ("," category)? ("," category)? ("," category)? "]}"\n'
                + 'category ::= ' + ' | '.join(json.dumps(json.dumps(name)) for name in categories) + '\n')
    if spec["policy"].get("senseCategories"):
        literal = lambda value: json.dumps(value, ensure_ascii=False)
        rows = []
        for index, sense in enumerate(payload["qualifiedSenses"]):
            prefix = '{"index":' + str(index) + ',"definition":' + json.dumps(sense["definition"], ensure_ascii=False) + ',"categories":'
            rows.append(f'sense{index} ::= {literal(prefix)} categories "}}"')
        sequence = (' ' + literal(',') + ' ').join(f'sense{i}' for i in range(len(rows)))
        return ('root ::= ' + literal('{"senses":[') + ' ' + sequence + ' ' + literal(']}') + '\n'
                + '\n'.join(rows) + '\n'
                + 'categories ::= "[" category ("," category)? ("," category)? ("," category)? "]"\n'
                + 'category ::= ' + ' | '.join(literal(json.dumps(name)) for name in spec["policy"]["senseCategories"]) + '\n')
    labels = [group["label"] for group in spec["policy"]["meaningGroups"][payload["enemyWord"]]] + ["OTHER"]
    # Free explanation, followed by exactly one constrained categorical result.
    # The explanation cannot consume the sentinel itself as ordinary text.
    return ('root ::= reason "FINAL " group " " index "."? [ \\t\\n]*\n'
            'reason ::= part+\n'
            'part ::= [^F] | "F" [^I] | "FI" [^N] | "FIN" [^A] | "FINA" [^L]\n'
            'group ::= ' + ' | '.join(json.dumps(label) for label in labels) + '\n'
            'index ::= ' + ' | '.join(json.dumps(str(i)) for i in range(len(payload["qualifiedSenses"]))) + '\n')


def query_model(endpoint, spec, payload):
    """Retry invalid syntax with explicit feedback; never retry semantic labels."""
    policy = spec["policy"]
    messages = render_messages(spec, payload)
    attempts = []
    for _ in range(policy["maxAttempts"]):
        attempt = {"requestDigest": digest(messages), "rawResponse": ""}
        try:
            request = {
                "messages": messages, "temperature": policy["temperature"], "seed": policy["seed"],
                "max_tokens": policy["maxTokens"], "chat_template_kwargs": {"enable_thinking": policy["thinking"]},
                "cache_prompt": True,
            }
            for frozen, parameter in (("topP", "top_p"), ("topK", "top_k"), ("minP", "min_p"),
                                      ("presencePenalty", "presence_penalty"), ("repeatPenalty", "repeat_penalty")):
                if frozen in policy:
                    request[parameter] = policy[frozen]
            if policy.get("constrainedFinalLabel"):
                repair_categories = bool(attempts and policy.get("independentSenseInference")
                                         and attempts[-1].get("error") == "Use distinct supplied categories, or OTHER alone")
                request["grammar"] = final_grammar(spec, payload, repair_categories)
                if repair_categories:
                    attempt["syntaxRepair"] = "standalone-other-v1"
                attempt["grammarDigest"] = digest(request["grammar"])
            response = http_json(endpoint.rstrip("/"), "/v1/chat/completions", request)
            if "usage" in response:
                attempt["usage"] = response["usage"]
            if "timings" in response:
                attempt["timings"] = response["timings"]
            message = response["choices"][0]["message"]
            if message.get("reasoning_content"):
                attempt["reasoningContent"] = message["reasoning_content"]
            attempt["rawResponse"] = message["content"] or ""
            decision = parse_response(spec, payload, attempt["rawResponse"])
        except Exception as error:
            attempt["error"] = str(error)
            attempts.append(attempt)
            labels = [group["label"] for group in policy["meaningGroups"][payload["enemyWord"]]] + ["OTHER"]
            feedback = policy["validationRetryPrompt"].format(
                error=str(error), allowedGroups=", ".join(labels),
                maximumIndex=len(payload["qualifiedSenses"]) - 1)
            messages.extend([{"role": "assistant", "content": attempt["rawResponse"]},
                             {"role": "user", "content": feedback}])
        else:
            attempts.append(attempt)
            return {**decision, "rawResponse": attempt["rawResponse"], "attempts": attempts}
    return {"status": "error", "error": attempts[-1]["error"],
            "rawResponse": attempts[-1]["rawResponse"], "attempts": attempts}


def validate_server(endpoint, spec):
    parsed = urllib.parse.urlparse(endpoint)
    if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost", "::1"):
        raise ValueError("Offline semantic refinement requires a localhost inference server")
    props = http_json(endpoint, "/props")
    expected_build = spec["policy"]["runtime"].removeprefix("llama.cpp-")
    if (not props["build_info"].startswith(expected_build + "-")
            or props["build_info"] != spec["policy"]["runtimeBuild"]):
        raise ValueError("Local inference runtime differs from the frozen build")
    sha = hashlib.sha256()
    with Path(props["model_path"]).open("rb") as model:
        for chunk in iter(lambda: model.read(1024 * 1024), b""):
            sha.update(chunk)
    if sha.hexdigest() != spec["manifest"]["modelDigest"]:
        raise ValueError("Local server loaded a different model file")
    return props["total_slots"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("requests", type=Path)
    parser.add_argument("output", type=Path, help="Per-enemy WORD memo JSON for package-semantic-refinement.ts")
    parser.add_argument("--endpoint", default="http://127.0.0.1:8088")
    parser.add_argument("--cache", type=Path, default=Path("/tmp/wyrmle-contextual-memos"))
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--execution-manifest", type=Path,
                        help="Optional backend/device provenance, stored without changing model decisions")
    parser.add_argument("--retry-errors", action="store_true")
    args = parser.parse_args()
    if args.workers < 1:
        parser.error("--workers must be positive")
    spec = json.loads(args.manifest.read_text())
    manifest, policy = spec["manifest"], spec["policy"]
    execution = json.loads(args.execution_manifest.read_text()) if args.execution_manifest else None
    if execution and (execution["modelDigest"] != manifest["modelDigest"]
                      or execution["runtimeBuild"] != policy["runtimeBuild"]):
        raise SystemExit("Backend provenance differs from the pinned model/runtime")
    if digest(spec["prompt"]) != manifest["promptDigest"] or digest(policy) != manifest["policyDigest"]:
        raise SystemExit("Frozen prompt or policy digest does not match")
    if policy.get("verification"):
        proposal = spec["proposal"]
        if (digest(proposal) != policy["verification"]["proposalSpecDigest"]
                or proposal["policy"].get("verification") or not proposal["policy"].get("independentSenseInference")
                or digest(proposal["policy"]) != proposal["manifest"]["policyDigest"]
                or digest(proposal["prompt"]) != proposal["manifest"]["promptDigest"]
                or any(proposal["manifest"][key] != manifest[key] for key in ("modelId", "modelRevision", "modelDigest", "sourceDigest"))):
            raise SystemExit("Verification proposal specification changed")
    bundle = json.loads(args.requests.read_text())
    if bundle["version"] != "wyrmle-refinement-requests-1":
        raise SystemExit("Unsupported refinement request format")
    if any(bundle["manifest"][field] != manifest[field] for field in PIN_FIELDS):
        raise SystemExit("Requests were exported for another source, model or policy")
    scope = bundle["scopeWords"]
    if digest(scope) != bundle["scopeDigest"] or scope != sorted(set(scope)):
        raise SystemExit("Puzzle inventory scope changed")
    inputs, requests = {}, bundle["requests"]
    if len({request["word"] for request in requests}) != len(requests):
        raise SystemExit("Request scope contains duplicate spellings")
    for request in requests:
        payload, key = request["input"], request["inputDigest"]
        if request["word"] not in scope or digest(payload) != key:
            raise SystemExit("Request input or spelling differs from its exported digest")
        if (payload["enemyWord"] != bundle["enemyWord"] or not payload["qualifiedSenses"]
                or [s["id"] for s in payload["qualifiedSenses"]] != sorted({s["id"] for s in payload["qualifiedSenses"]})
                or any(payload[field] != manifest[field] for field in ("sourceDigest", "policyDigest", "promptDigest"))):
            raise SystemExit("Request contains inconsistent or unsorted source senses")
        inputs[key] = payload
    cache = args.cache / manifest["policyDigest"]
    results, pending = {}, {}

    def read_cached(key, payload):
        path = cache / f"{key}.json"
        previous = json.loads(path.read_text()) if path.exists() else None
        if previous:
            if (previous["input"] != payload or any(previous[field] != manifest[field] for field in PIN_FIELDS)
                    or previous["requestDigest"] != digest(render_messages(spec, payload))):
                raise ValueError(f"Changed inference memo {key}")
            if previous["status"] == "ok":
                parsed = (parse_sense_categories if policy.get("independentSenseInference") else parse_response)(spec, payload, previous["rawResponse"])
                if any(previous[field] != value for field, value in parsed.items()):
                    raise ValueError(f"Changed categorical decision in inference memo {key}")
            else:
                # A parser correction can recover an unambiguous saved response
                # without sampling the model again or changing its chosen label.
                try:
                    parsed = (parse_sense_categories if policy.get("independentSenseInference") else parse_response)(spec, payload, previous["rawResponse"])
                except ValueError:
                    pass
                else:
                    previous["previousValidationError"] = previous.pop("error", None)
                    previous.update(parsed)
        return previous

    for key, payload in inputs.items():
        previous = read_cached(key, payload)
        if previous and previous.get("previousValidationError") and previous["status"] == "ok":
            with (cache / f"{key}.lock").open("a") as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                previous = read_cached(key, payload)
                write_json(cache / f"{key}.json", previous)
        if previous:
            if previous["status"] == "ok" or not args.retry_errors:
                results[key] = previous
                continue
        pending[key] = (payload, previous)

    def infer_source(item):
        source_key, source_payload = item
        sense = source_payload["qualifiedSenses"][0]
        source_input = sense_input(spec, sense)
        proposal_record, scoring = None, []
        if policy.get("verification"):
            proposal_spec = spec["proposal"]
            proposal_input = sense_input(proposal_spec, sense)
            proposal_key = digest(proposal_input)
            proposal_path = args.cache / proposal_spec["manifest"]["policyDigest"] / "senses" / f"{proposal_key}.json"
            proposal_path.parent.mkdir(parents=True, exist_ok=True)
            with proposal_path.with_suffix(".lock").open("a") as proposal_lock:
                fcntl.flock(proposal_lock, fcntl.LOCK_EX)
                proposal_record = json.loads(proposal_path.read_text()) if proposal_path.exists() else None
                if not proposal_record or (proposal_record.get("status") == "error" and args.retry_errors):
                    older_proposal = proposal_record
                    proposal_record = {**{field: proposal_spec["manifest"][field] for field in PIN_FIELDS},
                                       "input": proposal_input, "inputDigest": proposal_key,
                                       "requestDigest": digest(render_messages(proposal_spec, source_payload)),
                                       **query_model(args.endpoint, proposal_spec, source_payload)}
                    if older_proposal:
                        proposal_record["previousAttempts"] = older_proposal.get("previousAttempts", []) + [older_proposal]
                    write_json(proposal_path, proposal_record)
            if (proposal_record.get("status") != "ok" or proposal_record["input"] != proposal_input
                    or proposal_record["inputDigest"] != proposal_key
                    or proposal_record["requestDigest"] != digest(render_messages(proposal_spec, source_payload))
                    or any(proposal_record[field] != proposal_spec["manifest"][field] for field in PIN_FIELDS)
                    or parse_response(proposal_spec, source_payload, proposal_record["rawResponse"])["categories"] != proposal_record["categories"]):
                raise ValueError("Missing, failed or changed first-pass source classification")
            scoring = [category for category in proposal_record["categories"] if category in policy["verification"]["scoringCategories"]]
            if policy["verification"].get("cuePatterns"):
                scoring = sorted(set(scoring + source_category_cues(spec, sense)))
            source_payload = {**source_payload, "proposedCategories": scoring}
        source_directory = cache / "senses"
        source_directory.mkdir(parents=True, exist_ok=True)
        source_path = source_directory / f"{source_key}.json"
        with (source_directory / f"{source_key}.lock").open("a") as source_lock:
            fcntl.flock(source_lock, fcntl.LOCK_EX)
            source_record = json.loads(source_path.read_text()) if source_path.exists() else None
            request_digest = digest(render_messages(spec, source_payload))
            if source_record:
                if (source_record["input"] != source_input or source_record["requestDigest"] != request_digest
                        or any(source_record[field] != manifest[field] for field in PIN_FIELDS)):
                    raise ValueError("Changed individual source-sense inference input")
                if source_record["status"] == "ok":
                    parsed = parse_response(spec, source_payload if scoring or not proposal_record else {k: v for k, v in source_payload.items() if k != "proposedCategories"}, source_record["rawResponse"])
                    if parsed["categories"] != source_record["categories"]:
                        raise ValueError("Changed individual source-sense categories")
                    if proposal_record and (source_record.get("proposal") != proposal_record or source_record.get("verified") != bool(scoring)):
                        raise ValueError("Changed verification provenance")
                    if policy.get("verification", {}).get("cuePatterns") and source_record.get("cueCategories") != source_category_cues(spec, sense):
                        raise ValueError("Changed source-text category proposals")
            if not source_record or (source_record["status"] == "error" and args.retry_errors):
                older = source_record
                decision = ({"status": "ok", "categories": proposal_record["categories"], "rawResponse": proposal_record["rawResponse"]}
                            if proposal_record and not scoring else query_model(args.endpoint, spec, source_payload))
                source_record = {**{field: manifest[field] for field in PIN_FIELDS},
                                 "input": source_input, "inputDigest": source_key, "requestDigest": request_digest,
                                 **decision}
                if proposal_record:
                    source_record.update(proposal=proposal_record, verified=bool(scoring))
                    if policy["verification"].get("cuePatterns"):
                        source_record["cueCategories"] = source_category_cues(spec, sense)
                if execution:
                    source_record["execution"] = execution
                if older:
                    source_record["previousAttempts"] = older.get("previousAttempts", []) + [older]
                write_json(source_path, source_record)
        return source_key, source_record

    source_results = {}

    def infer(item):
        key, (payload, previous) = item
        cache.mkdir(parents=True, exist_ok=True)
        # Benchmark and puzzle runners can encounter the same input. One model
        # response is authoritative, independent of which caller reaches it first.
        with (cache / f"{key}.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            previous = read_cached(key, payload)
            if previous and (previous["status"] == "ok" or not args.retry_errors):
                return key, previous
            messages = render_messages(spec, payload)
            record = {field: manifest[field] for field in PIN_FIELDS}
            if execution:
                record["execution"] = execution
            record.update(input=payload, inputDigest=key, requestDigest=digest(messages), rawResponse="")
            if policy.get("independentSenseInference"):
                decisions = []
                for index, sense in enumerate(payload["qualifiedSenses"]):
                    source_key = digest(sense_input(spec, sense))
                    source_record = source_results[source_key]
                    if source_record["status"] != "ok":
                        record.update(status="error", error=f"Source sense {sense['id']}: {source_record['error']}", rawResponse=source_record["rawResponse"])
                        break
                    decisions.append({"index": index, "definition": sense["definition"], "categories": source_record["categories"],
                                      "response": source_record["rawResponse"], "inputDigest": source_key,
                                      **({"proposal": {"response": source_record["proposal"]["rawResponse"],
                                                       "inputDigest": source_record["proposal"]["inputDigest"]},
                                          "verified": source_record["verified"]} if policy.get("verification") else {})})
                    if policy.get("verification", {}).get("cuePatterns"):
                        decisions[-1]["cueCategories"] = source_record["cueCategories"]
                else:
                    response = canonical({"senses": decisions})
                    record.update(rawResponse=response, **parse_sense_categories(spec, payload, response))
            else:
                record.update(query_model(args.endpoint, spec, payload))
            if previous:
                record["previousAttempts"] = previous.get("previousAttempts", []) + [{
                    key: previous.get(key) for key in ("status", "error", "rawResponse", "requestDigest", "attempts") }]
            write_json(cache / f"{key}.json", record)
        return key, record

    existing_words = json.loads(args.output.read_text())["records"] if args.output.exists() else {}
    if any(any(memo[field] != manifest[field] for field in PIN_FIELDS) for memo in existing_words.values()):
        raise SystemExit("Output contains records from another frozen policy; use a new output path")

    def checkpoint():
        words = dict(existing_words)
        for request in requests:
            result = results.get(request["inputDigest"])
            if result is None:
                continue
            memo = {field: manifest[field] for field in PIN_FIELDS}
            memo.update(inputDigest=request["inputDigest"], baseWordDigest=request["baseWordDigest"],
                        rawResponse=result["rawResponse"], status=result["status"])
            if result["status"] == "ok":
                memo.update(relation=result["relation"], explanation=result["explanation"],
                            senseId=request["baselineSenseId"] if result["relation"] == "neutral"
                            and manifest.get("reviewScope") != "all-source-senses" else result["selectedSenseId"])
            else:
                memo["error"] = result["error"]
            words[request["word"]] = memo
        write_json(args.output, {"records": words})

    checkpoint()
    if pending:
        slots = validate_server(args.endpoint.rstrip("/"), spec)
        if policy.get("independentSenseInference"):
            sources = independent_source_requests(spec, pending)
            with ThreadPoolExecutor(max_workers=min(args.workers, slots)) as executor:
                futures = [executor.submit(infer_source, item) for item in sources.items()]
                for count, future in enumerate(as_completed(futures), 1):
                    key, record = future.result()
                    source_results[key] = record
                    if count % 200 == 0 or count == len(sources):
                        print(json.dumps({"reviewedSenses": count, "requiredSenses": len(sources),
                                          "errors": sum(r["status"] != "ok" for r in source_results.values())}), flush=True)
        with ThreadPoolExecutor(max_workers=min(args.workers, slots)) as executor:
            futures = [executor.submit(infer, item) for item in pending.items()]
            for count, future in enumerate(as_completed(futures), 1):
                key, record = future.result()
                results[key] = record
                if count % 20 == 0 or count == len(pending):
                    checkpoint()
                    print(json.dumps({"reviewed": count, "pendingInputs": len(pending),
                                      "errors": sum(r["status"] != "ok" for r in results.values())}), flush=True)
    checkpoint()
    errors = sum(record["status"] != "ok" for record in results.values())
    print(json.dumps({"output": str(args.output), "eligibleWords": len(requests), "distinctInputs": len(inputs),
                      "cachedInputs": len(inputs) - len(pending), "errors": errors}))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
