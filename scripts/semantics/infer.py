#!/usr/bin/env python3
"""Assess every admitted dictionary sense locally before puzzle generation.

MiniLM retrieves semantically close senses on BOTH sides of each enemy policy.
DeBERTa confirms directional entailment: cosine alone cannot distinguish
antonyms. Reviewed source senses take precedence over statistical inference.
Nothing in this module is used by the browser or downloaded during play.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import sys
import time
import urllib.request
from collections import deque

DIRECTORY = Path(__file__).resolve().parent
LOCK = json.loads((DIRECTORY / "model-lock.json").read_text())
CONFIG = {
    "version": "wyrmle-vector-nli-v1",
    "embedding": "sentence-transformers/all-MiniLM-L6-v2",
    "embeddingRevision": LOCK["models"]["embedding"]["revision"],
    "nli": "cross-encoder/nli-deberta-v3-xsmall",
    "nliRevision": LOCK["models"]["inference"]["revision"],
    "anchors": "all-reviewed-senses-deduplicated-by-definition-and-relation",
    "cosineMinimum": 0.50,
    "entailmentMinimum": 0.55,
    "retrievalPerRelation": 4,
    "premise": "definition",
    "hypothesis": "definition",
    "wordAggregation": "highest-entailment-then-cosine",
    "neutralSense": "strongest-enemy-vector-sense",
    "reviewedPolicy": "reviewed-scoring-senses-precedence-related-open-to-inference",
    "lexicalEntailment": "same-synset-or-forward-hypernym-entails-causes-up-to-two-edges",
    "sourceRolePrefix": "optional-forward-other-state-or-event-counts-as-one-of-two-edges",
    "groupHypernymPolicy": "noun.group-hypernym-paths-are-not-directional-evidence-use-neural-classifier",
    "embeddingInput": "lemma: definition",
    "embeddingMaxTokens": 256,
    "embeddingBatchSize": 64,
    "inferenceMaxTokens": 256,
    "inferenceBatchSize": 32,
    "pooling": "attention-mask-mean-l2-normalized",
}


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(value).hexdigest()


CONFIGURATION_HASH = digest(canonical(CONFIG).encode())


def report(**values):
    print(json.dumps(values), file=sys.stderr, flush=True)


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".partial")
    temporary.write_bytes(data)
    temporary.replace(path)


def model_files(cache, download):
    result = {}
    for name, specification in LOCK["models"].items():
        folder = cache / "models" / name / specification["revision"]
        folder.mkdir(parents=True, exist_ok=True)
        for filename, expected in specification["files"].items():
            target = folder / filename
            if target.exists() and digest(target.read_bytes()) == expected["sha256"]:
                continue
            if not download:
                raise SystemExit(f"Missing or changed pinned model file {target}; run with --download once.")
            url = (f"https://huggingface.co/{specification['repository']}/resolve/"
                   f"{specification['revision']}/{expected['path']}")
            report(download=url)
            with urllib.request.urlopen(url, timeout=120) as response:
                data = response.read()
            if len(data) != expected["bytes"] or digest(data) != expected["sha256"]:
                raise SystemExit(f"Checksum mismatch for {url}; model pin must not silently change.")
            atomic_write(target, data)
        result[name] = folder
    return result


class Models:
    def __init__(self, files, threads):
        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer

        self.np = np
        ort.disable_telemetry_events()
        options = ort.SessionOptions()
        options.intra_op_num_threads = threads
        options.inter_op_num_threads = 1
        options.log_severity_level = 3
        self.sessions = {}
        self.tokenizers = {}
        for name, folder in files.items():
            session = ort.InferenceSession(str(folder / "model_quint8_avx2.onnx"),
                                           sess_options=options, providers=["CPUExecutionProvider"])
            tokenizer = Tokenizer.from_file(str(folder / "tokenizer.json"))
            tokenizer.enable_truncation(max_length=CONFIG["embeddingMaxTokens" if name == "embedding" else "inferenceMaxTokens"])
            tokenizer.enable_padding()
            self.sessions[name] = session
            self.tokenizers[name] = tokenizer

    def run(self, kind, inputs):
        np = self.np
        encoding = self.tokenizers[kind].encode_batch(inputs)
        attention = np.array([item.attention_mask for item in encoding], dtype=np.int64)
        feed = {
            "input_ids": np.array([item.ids for item in encoding], dtype=np.int64),
            "attention_mask": attention,
            "token_type_ids": np.array([item.type_ids for item in encoding], dtype=np.int64),
        }
        session = self.sessions[kind]
        names = {item.name for item in session.get_inputs()}
        output = session.run(None, {key: value for key, value in feed.items() if key in names})[0]
        if kind == "embedding":
            pooled = (output * attention[:, :, None]).sum(axis=1) / attention.sum(axis=1)[:, None]
            return (pooled / np.linalg.norm(pooled, axis=1, keepdims=True)).astype(np.float32)
        probabilities = np.exp(output - output.max(axis=1, keepdims=True))
        return probabilities / probabilities.sum(axis=1, keepdims=True)

    def embed(self, texts, progress=False):
        np = self.np
        result = np.empty((len(texts), 384), dtype=np.float32)
        start = time.monotonic()
        for offset in range(0, len(texts), CONFIG["embeddingBatchSize"]):
            batch = texts[offset:offset + CONFIG["embeddingBatchSize"]]
            result[offset:offset + len(batch)] = self.run("embedding", batch)
            if progress and offset % 8192 == 0:
                report(embedded=offset + len(batch), total=len(texts), seconds=round(time.monotonic() - start, 2))
        return result


def source_vectors(source, models, cache):
    np = models.np
    ids = sorted(source["senses"])
    texts = [f"{source['senses'][sid]['lemma']}: {source['senses'][sid]['definition']}" for sid in ids]
    embedding_configuration = {key: value for key, value in CONFIG.items()
                               if key.startswith("embedding") or key == "pooling"}
    identity = digest(canonical({"configuration": embedding_configuration, "ids": ids, "texts": texts}).encode())
    path = cache / "vectors" / f"{identity}.npy"
    if path.exists():
        vectors = np.load(path, allow_pickle=False)
        if vectors.shape != (len(ids), 384) or not np.isfinite(vectors).all():
            raise SystemExit(f"Invalid vector cache {path}")
        report(vectorCache=str(path), senses=len(ids))
    else:
        vectors = models.embed(texts, progress=True)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.with_suffix(".partial").open("wb") as stream:
            np.save(stream, vectors, allow_pickle=False)
        path.with_suffix(".partial").replace(path)
        report(vectorCacheWritten=str(path), senses=len(ids))
    return ids, vectors, digest(vectors.tobytes())


def directional_proofs(source, profile, ids):
    """A source sense can entail a specific approved class; direction is vital.

    Sharing an ancestor never supplies a relation, nor does reversing an edge.
    Bounded forward causes/entails edges also cover actions producing a concept.
    """
    by_sense = source["senseSynsets"]
    synsets = source["synsets"]
    excluded = set(profile.get("excludedSenseIds", []))
    excluded_synsets = {by_sense[sid] for sid in profile.get("reviewedExclusions", {}) if sid in by_sense}
    anchors = {}
    for record in list(profile["roots"]) + list(profile["relations"].values()):
        sid = record["senseId"]
        if record["relation"] not in ("opposite", "similar") or sid in excluded:
            continue
        anchors.setdefault(by_sense[sid], []).append(record)
    result = {}
    for sid in ids:
        if sid in excluded or sid not in by_sense:
            continue
        queue = deque([(by_sense[sid], [])])
        for edge in source.get("senseRoles", {}).get(sid, []):
            target = edge["target"]
            if (edge["type"] == "other" and edge.get("qualifier") in ("state", "event")
                    and target in by_sense and target not in excluded):
                queue.append((by_sense[target], [{"type": "other", "qualifier": edge["qualifier"],
                                                "from": sid, "to": target}]))
        seen = set()
        matches = []
        while queue:
            current, path = queue.popleft()
            if current in seen or current in excluded_synsets:
                continue
            seen.add(current)
            for anchor in anchors.get(current, []):
                # The lexicographer-file number is part of the licensed sense
                # key: 1.14 is noun.group. Membership in a group or sequence
                # does not inherit its semantic polarity. A chaotic series is
                # still a series; graph taxonomy alone cannot make it orderly.
                # Keep exact reviewed meanings and same-synset evidence, but
                # send inherited group classifications through normal model
                # assessment and the existing contextual publication gate.
                noun_group = anchor["senseId"].rsplit("__", 1)[-1].startswith("1.14.")
                if noun_group and any(edge["type"] == "hypernym" for edge in path):
                    continue
                matches.append({"relation": anchor["relation"], "anchor": anchor["senseId"], "path": path})
            if len(path) >= 2:
                continue
            for edge in synsets[current]["relations"]:
                if edge["type"] in ("hypernym", "entails", "causes"):
                    target = edge["target"]
                    queue.append((target, path + [{"type": edge["type"], "from": current, "to": target}]))
        if matches:
            result[sid] = matches
    return result


def assess_enemy(source, enemy, ids, vectors, models, output, vector_digest, reuse_audits=None):
    np = models.np
    profile = source["profiles"][enemy]
    proofs = directional_proofs(source, profile, ids)
    senses = source["senses"]
    index = {sid: offset for offset, sid in enumerate(ids)}
    excluded = set(source.get("excludedSenseIds", []))
    excluded.update(profile.get("excludedSenseIds", []))
    excluded.update(profile.get("reviewedSenseExclusions", {}))
    unique_anchors = {}
    for root in list(profile["roots"]) + list(profile["relations"].values()):
        if root["relation"] not in ("opposite", "similar") or root["senseId"] in excluded:
            continue
        sense = senses[root["senseId"]]
        unique_anchors.setdefault((sense["definition"], root["relation"]),
                                  {**root, "lemma": sense["lemma"], "definition": sense["definition"]})
    anchors = list(unique_anchors.values())
    anchor_texts = []
    for anchor in anchors:
        sense = senses.get(anchor["senseId"])
        lemma = sense["lemma"] if sense else anchor.get("lemma")
        if lemma is None:
            raise SystemExit(f"Anchor {anchor['senseId']} needs its sourced lemma in the export")
        anchor_texts.append(f"{lemma}: {anchor['definition']}")
    reused = None
    inference_threads = models.sessions["embedding"].get_session_options().intra_op_num_threads
    if reuse_audits:
        previous = json.loads(gzip.decompress((reuse_audits / f"{enemy.lower()}.json.gz").read_bytes()))
        old = previous["metadata"]
        if old["vectorDigest"] != vector_digest or old["modelLockDigest"] != digest(canonical(LOCK).encode()):
            raise SystemExit(f"Cannot reuse {enemy}: source vectors or pinned models changed")
        # Proof/evidence selection can be revised without pretending that new
        # neural inference occurred. Any change to inference itself invalidates
        # reuse, including candidate retrieval and exact input framing.
        inference_keys = ("embedding", "embeddingRevision", "nli", "nliRevision", "anchors", "cosineMinimum",
                          "retrievalPerRelation", "premise", "hypothesis", "embeddingInput", "embeddingMaxTokens",
                          "embeddingBatchSize", "inferenceMaxTokens", "inferenceBatchSize", "pooling")
        if any(old["configuration"].get(key) != CONFIG.get(key) for key in inference_keys):
            raise SystemExit(f"Cannot reuse {enemy}: neural inference configuration changed")
        reused = np.load(reuse_audits / f"{enemy.lower()}-sense-audit.npz", allow_pickle=False)
        if (not np.array_equal(reused["sense_ids"], np.asarray(ids))
                or not np.array_equal(reused["anchor_ids"], np.asarray([root["senseId"] for root in anchors]))):
            raise SystemExit(f"Cannot reuse {enemy}: source or anchor identities changed")
        cosine = reused["cosine"]
        if cosine.shape != (len(ids), len(anchors)) or not np.isfinite(cosine).all():
            raise SystemExit(f"Invalid cached cosine matrix for {enemy}")
        inference_threads = old["threads"]
    else:
        anchor_vectors = models.embed(anchor_texts)
        cosine = vectors @ anchor_vectors.T
    best_entailment = np.zeros((len(ids), 2), dtype=np.float32)
    best_cosine = np.zeros((len(ids), 2), dtype=np.float32)
    selected_anchor = np.full((len(ids), 2), -1, dtype=np.int32)
    max_cosine = np.zeros((len(ids), 2), dtype=np.float32)
    candidate_counts = np.zeros(len(ids), dtype=np.int32)
    meta = []
    for relation_index, relation in enumerate(("opposite", "similar")):
        columns = np.array([j for j, root in enumerate(anchors) if root["relation"] == relation])
        if not len(columns):
            continue
        values = cosine[:, columns]
        max_cosine[:, relation_index] = values.max(axis=1)
        # Stable sorting provides deterministic ordering for tied anchor scores.
        nearest = np.argsort(-values, axis=1, kind="stable")[:, :CONFIG["retrievalPerRelation"]]
        for i, row in enumerate(nearest):
            if ids[i] in excluded:
                continue
            for relative_column in row:
                j = int(columns[relative_column])
                if cosine[i, j] >= CONFIG["cosineMinimum"]:
                    meta.append((i, j, relation_index))
                    candidate_counts[i] += 1
    # This cache includes every candidate prediction, including losing senses.
    pairs = [(senses[ids[i]]["definition"], anchors[j]["definition"]) for i, j, _ in meta]
    start = time.monotonic()
    if reused is not None:
        if not np.array_equal(reused["candidates"], np.asarray(meta, dtype=np.int32)):
            raise SystemExit(f"Cannot reuse {enemy}: retrieved definition pairs changed")
        probabilities = reused["probabilities"]
        if (probabilities.shape != (len(pairs), 3) or not np.isfinite(probabilities).all()
                or (probabilities < 0).any() or (probabilities > 1).any()
                or not np.allclose(probabilities.sum(axis=1), 1, atol=1e-6)):
            raise SystemExit(f"Invalid cached NLI predictions for {enemy}")
        report(enemy=enemy, reusedInferencePairs=len(pairs))
    else:
        probabilities = np.empty((len(pairs), 3), dtype=np.float32)
        for offset in range(0, len(pairs), CONFIG["inferenceBatchSize"]):
            batch = pairs[offset:offset + CONFIG["inferenceBatchSize"]]
            probabilities[offset:offset + len(batch)] = models.run("inference", batch)
            if offset % 4096 == 0:
                report(enemy=enemy, inferred=offset + len(batch), candidates=len(pairs), seconds=round(time.monotonic() - start, 2))
    for k, (i, j, relation_index) in enumerate(meta):
        entailment = probabilities[k, 1]
        if (entailment, cosine[i, j]) > (best_entailment[i, relation_index], best_cosine[i, relation_index]):
            best_entailment[i, relation_index] = entailment
            best_cosine[i, relation_index] = cosine[i, j]
            selected_anchor[i, relation_index] = j
    words = {}
    methods = {}
    for word in sorted(source["words"]):
        word_senses = source["words"][word]
        locations = [index[sid] for sid in word_senses]
        maxima = best_entailment[locations].max(axis=0)
        reviewed = profile["relations"].get(word)
        matches = [(sid, proof) for sid in word_senses for proof in proofs.get(sid, [])]
        proof = None
        possible = [(float(best_entailment[i, polarity]), float(best_cosine[i, polarity]), i, polarity)
                    for i in locations for polarity in range(2)]
        entailment, similarity, chosen, polarity = max(possible, key=lambda value: value[:2])
        anchor_index = int(selected_anchor[chosen, polarity])
        if reviewed and reviewed["relation"] in ("opposite", "similar"):
            relation = reviewed["relation"]
            chosen_id = reviewed["senseId"]
            method = reviewed["confidence"]
            selected = reviewed["rootSense"]
        elif matches:
            chosen_id, proof = min(matches, key=lambda item:
                                   (0 if item[1]["relation"] == "opposite" else 1, len(item[1]["path"])))
            relation = proof["relation"]
            method = "source-direction-proof"
            selected = proof["anchor"]
        elif entailment >= CONFIG["entailmentMinimum"]:
            relation = ("opposite", "similar")[polarity]
            chosen_id = ids[chosen]
            method = "local-vector-nli"
            selected = anchors[anchor_index]["senseId"]
        else:
            relation = "neutral"
            # A low score still assessed a real source meaning. Keep the most
            # relevant assessed sense rather than an unrelated first definition.
            best_vector_location = int(np.argmax(cosine[locations]))
            chosen_row, anchor_index = divmod(best_vector_location, len(anchors))
            chosen_id = ids[locations[chosen_row]]
            method = "local-vector-nli-neutral"
            selected = anchors[anchor_index]["senseId"]
        if chosen_id not in word_senses:
            raise SystemExit(f"Invalid selected sense: {enemy}/{word}/{chosen_id}")
        record = {
            "senseId": chosen_id,
            "relation": relation,
            "counterScore": round(float(maxima[0]), 6),
            "resistedScore": round(float(maxima[1]), 6),
            "margin": round(float(maxima[0] - maxima[1]), 6),
            "counterCosine": round(float(max_cosine[locations, 0].max()), 6),
            "resistedCosine": round(float(max_cosine[locations, 1].max()), 6),
            "sensesEvaluated": len(locations),
            "inferredCandidates": int(candidate_counts[locations].sum()),
            "selectedAnchor": selected,
            "method": method,
            **({"proof": proof} if proof else {}),
        }
        words[word] = record
        methods[method] = methods.get(method, 0) + 1
    metadata = {
        "version": CONFIG["version"], "configuration": CONFIG,
        "configurationHash": CONFIGURATION_HASH,
        "sourceDigest": source["sourceDigest"],
        "dictionaryVersion": source["dictionaryVersion"],
        "modelLockDigest": digest(canonical(LOCK).encode()),
        "vectorDigest": vector_digest, "provider": "CPUExecutionProvider",
        "threads": inference_threads,
        "wordsAssessed": len(words), "sensesAssessed": len(ids),
        "inferencePairs": len(pairs), "methods": methods,
    }
    atomic_write(output / f"{enemy.lower()}.json.gz",
                 gzip.compress(canonical({"metadata": metadata, "enemyWord": enemy, "words": words}).encode(), mtime=0))
    # Audit arrays are authoring artifacts only: all candidate probabilities and
    # all sense similarity scores, including neutral or overridden decisions.
    output.mkdir(parents=True, exist_ok=True)
    if reused is None:
        np.savez_compressed(output / f"{enemy.lower()}-sense-audit.npz",
                            candidates=np.asarray(meta, dtype=np.int32), probabilities=probabilities,
                            cosine=cosine, sense_ids=np.asarray(ids),
                            anchor_ids=np.asarray([root["senseId"] for root in anchors]))
    else:
        reused.close()
    report(enemy=enemy, words=len(words), methods=methods, output=str(output / f"{enemy.lower()}.json.gz"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Complete dictionary/profile export from the authoring pipeline")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/wyrmle-semantic-cache"))
    parser.add_argument("--enemies", default="CHAOS", help="Comma-separated enemy names or ALL")
    parser.add_argument("--threads", type=int, default=8)
    parser.add_argument("--download", action="store_true", help="Explicitly fetch pinned model assets; all inference remains local")
    parser.add_argument("--vectors-only", action="store_true", help="Prepare reusable whole-dictionary vectors without classifying enemies")
    parser.add_argument("--reuse-audits", type=Path, help="Reuse verified source-vector/NLI audit arrays for proof-policy reaggregation")
    args = parser.parse_args()
    if args.threads < 1:
        parser.error("--threads must be positive")
    source = json.loads(args.source.read_text())
    for word, ids in source["words"].items():
        if not ids or not all(sid in source["senses"] for sid in ids):
            raise SystemExit(f"Missing source senses for {word}")
    models = Models(model_files(args.cache, args.download), args.threads)
    ids, vectors, vector_digest = source_vectors(source, models, args.cache)
    if args.vectors_only:
        report(vectorDigest=vector_digest, senses=len(ids))
        return
    enemies = sorted(source["profiles"]) if args.enemies.upper() == "ALL" else args.enemies.upper().split(",")
    for enemy in enemies:
        if enemy not in source["profiles"]:
            raise SystemExit(f"Unknown enemy {enemy}")
        assess_enemy(source, enemy, ids, vectors, models, args.output, vector_digest, args.reuse_audits)


if __name__ == "__main__":
    main()
