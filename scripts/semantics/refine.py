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
    if re.search(r"\{\w+\}", user):
        raise ValueError("Unsupported prompt template field")
    messages = [{"role": "system", "content": prompt["system"]}]
    for question, answer in prompt["examples"]:
        messages.extend([{"role": "user", "content": question}, {"role": "assistant", "content": answer}])
    messages.append({"role": "user", "content": user})
    return messages


def parse_response(spec, payload, response):
    if len(re.findall(r"\bFINAL\b", response)) != 1:
        raise ValueError("Model must emit exactly one final decision across the supplied senses")
    match = re.search(r"\bFINAL\s*[:\-]?\s*([A-Z_]+)\s*[,;:]?\s*(\d+)\s*\.?\s*$", response)
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
    if not explanation:
        raise ValueError("Model did not explain its semantic decision")
    return {"status": "ok", "relation": groups[match[1]], "selectedSenseId": senses[index]["id"],
            "selectedGroup": match[1], "explanation": explanation}


def http_json(endpoint, route, body=None):
    request = urllib.request.Request(endpoint + route,
                                    data=None if body is None else json.dumps(body).encode(),
                                    headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.load(response)


def final_grammar(spec, payload):
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
            if policy.get("constrainedFinalLabel"):
                request["grammar"] = final_grammar(spec, payload)
                attempt["grammarDigest"] = digest(request["grammar"])
            response = http_json(endpoint.rstrip("/"), "/v1/chat/completions", request)
            if "usage" in response:
                attempt["usage"] = response["usage"]
            if "timings" in response:
                attempt["timings"] = response["timings"]
            attempt["rawResponse"] = response["choices"][0]["message"]["content"]
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
                parsed = parse_response(spec, payload, previous["rawResponse"])
                if any(previous[field] != value for field, value in parsed.items()):
                    raise ValueError(f"Changed categorical decision in inference memo {key}")
        return previous

    for key, payload in inputs.items():
        previous = read_cached(key, payload)
        if previous:
            if previous["status"] == "ok" or not args.retry_errors:
                results[key] = previous
                continue
        pending[key] = (payload, previous)

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
                            senseId=request["baselineSenseId"] if result["relation"] == "neutral" else result["selectedSenseId"])
            else:
                memo["error"] = result["error"]
            words[request["word"]] = memo
        write_json(args.output, {"records": words})

    checkpoint()
    if pending:
        slots = validate_server(args.endpoint.rstrip("/"), spec)
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
