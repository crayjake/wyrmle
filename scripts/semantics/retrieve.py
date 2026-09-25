#!/usr/bin/env python3
"""Build complete three-channel retrieval for generation-time contextual review.

Uses the same pinned embedding model and licensed source export as infer.py.
An optional previous retrieval directory verifies reusable vector files by
their recorded hashes. No word-specific semantic decisions are made here.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path

import numpy as np

from infer import CONFIG, LOCK, Models, atomic_write, canonical, digest, model_files, report, source_vectors


def array_bytes(values):
    buffer = io.BytesIO()
    np.save(buffer, values, allow_pickle=False)
    return buffer.getvalue()


def channel_vectors(channel, texts, cache, models, evidence):
    prefix = "definitions" if channel == "definition" else "lemmas"
    identity = digest(canonical({"texts": texts, "model": LOCK["models"]["embedding"],
                                 "tokens": CONFIG["embeddingMaxTokens"], "pooling": CONFIG["pooling"]}).encode())
    path = cache / "vectors" / f"{prefix}-{identity}.npy"
    verified_reuse = None
    if evidence:
        # Older authoring tools used different cache-name fingerprints; only
        # an exact frozen file digest makes those files eligible for reuse.
        for candidate in sorted((cache / "vectors").glob(f"{prefix}-*.npy")):
            candidate_raw = candidate.read_bytes()
            if digest(candidate_raw) == evidence[channel]:
                verified_reuse = candidate_raw
                break
    if verified_reuse is not None:
        raw = verified_reuse
    elif path.exists():
        raw = path.read_bytes()
    else:
        raw = array_bytes(models.embed(texts, progress=True))
        atomic_write(path, raw)
    if evidence and digest(raw) != evidence[channel]:
        raise ValueError(f"Rebuilt {channel} vectors differ from frozen evidence")
    values = np.load(io.BytesIO(raw), allow_pickle=False)
    if values.shape != (len(texts), 384) or not np.isfinite(values).all():
        raise ValueError(f"Invalid {channel} vectors")
    return values, digest(raw)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("baseline", type=Path, help="Full-dictionary infer.py .json.gz results")
    parser.add_argument("output", type=Path)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/wyrmle-semantic-cache"))
    parser.add_argument("--audits", type=Path, help="Reuse matching infer.py sense-audit NPZ arrays")
    parser.add_argument("--reuse-retrieval", type=Path, help="Frozen retrieval artifacts pin reusable vector hashes")
    parser.add_argument("--threads", type=int, default=8)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    if args.threads < 1:
        parser.error("--threads must be positive")
    source = json.loads(args.source.read_text())
    source_digest = source["sourceDigest"]
    body = {key: value for key, value in source.items() if key != "sourceDigest"}
    if digest(json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode()) != source_digest:
        raise ValueError("Source export digest changed")
    baselines, evidence = {}, None
    for enemy in sorted(source["profiles"]):
        raw = (args.baseline / f"{enemy.lower()}.json.gz").read_bytes()
        base = json.loads(gzip.decompress(raw))
        metadata = base["metadata"]
        if (metadata["sourceDigest"] != source_digest
                or metadata["modelLockDigest"] != digest(canonical(LOCK).encode())):
            raise ValueError(f"Stale source or model pin for {enemy}")
        baselines[enemy] = (raw, metadata)
        if args.reuse_retrieval:
            previous = json.loads(gzip.decompress((args.reuse_retrieval / f"{enemy.lower()}.json.gz").read_bytes()))["metadata"]
            if (previous["sourceDigest"] != source_digest
                    or previous["embeddingRevision"] != CONFIG["embeddingRevision"]
                    or previous["modelLockDigest"] != metadata["modelLockDigest"]):
                raise ValueError("Retrieval evidence has different source or embedding pins")
            if evidence is not None and previous["vectorDigests"] != evidence:
                raise ValueError("Enemy retrieval artifacts disagree on source vectors")
            evidence = previous["vectorDigests"]
    models = Models(model_files(args.cache, args.download), args.threads)
    ids, combined, combined_digest = source_vectors(source, models, args.cache)
    vector_digests = {"combined": digest(array_bytes(combined))}
    if evidence and vector_digests["combined"] != evidence["combined"]:
        raise ValueError("Combined source vectors changed")
    texts = {"definition": sorted({sense["definition"] for sense in source["senses"].values()}),
             "lemma": sorted({sense["lemma"] for sense in source["senses"].values()})}
    vectors, text_indices = {}, {}
    for channel, values in texts.items():
        vectors[channel], vector_digests[channel] = channel_vectors(channel, values, args.cache, models, evidence)
        text_indices[channel] = {text: index for index, text in enumerate(values)}
    aligned = {channel: values[[text_indices[channel][source["senses"][sid][channel]] for sid in ids]]
               for channel, values in vectors.items()}
    source_indices = {sid: index for index, sid in enumerate(ids)}
    for enemy, (base_raw, base_metadata) in baselines.items():
        if base_metadata["vectorDigest"] != combined_digest:
            raise ValueError(f"Combined source inference differs from {enemy} baseline")
        profile = source["profiles"][enemy]
        excluded = set(source.get("excludedSenseIds", [])) | set(profile.get("excludedSenseIds", []))
        excluded.update(profile.get("reviewedSenseExclusions", {}))
        anchors = {}
        for root in list(profile["roots"]) + list(profile["relations"].values()):
            if root["relation"] in ("opposite", "similar") and root["senseId"] not in excluded:
                anchors.setdefault((source["senses"][root["senseId"]]["definition"], root["relation"]), root["senseId"])
        anchor_ids = list(anchors.values())
        if args.audits:
            audit = np.load(args.audits / f"{enemy.lower()}-sense-audit.npz", allow_pickle=False)
            if not np.array_equal(audit["sense_ids"], ids) or not np.array_equal(audit["anchor_ids"], anchor_ids):
                raise ValueError(f"Source or anchor identities changed for {enemy}")
            cosine = audit["cosine"]
        else:
            anchor_texts = [f"{source['senses'][sid]['lemma']}: {source['senses'][sid]['definition']}" for sid in anchor_ids]
            cosine = combined @ models.embed(anchor_texts).T
        if cosine.shape != (len(ids), len(anchor_ids)) or not np.isfinite(cosine).all():
            raise ValueError(f"Invalid combined retrieval matrix for {enemy}")
        maxima = [cosine.max(axis=1)]
        for channel in ("definition", "lemma"):
            anchor_vectors = vectors[channel][[text_indices[channel][source["senses"][sid][channel]] for sid in anchor_ids]]
            maxima.append((aligned[channel] @ anchor_vectors.T).max(axis=1))
        maxima = np.stack(maxima, axis=1)
        qualified = maxima.max(axis=1) >= 0.5
        words = {}
        for word, sense_ids in source["words"].items():
            rows = [source_indices[sid] for sid in sense_ids]
            words[word] = {"maxima": [round(float(value), 8) for value in maxima[rows].max(axis=0)],
                           "qualifiedSenseIds": [sid for sid in sense_ids if sid not in excluded and qualified[source_indices[sid]]]}
        metadata = {"version": "wyrmle-semantic-retrieval-union-v1", "sourceDigest": source_digest,
                    "baseRawSha256": digest(base_raw), "baseConfigurationHash": base_metadata["configurationHash"],
                    "embeddingModelId": CONFIG["embedding"], "embeddingRevision": CONFIG["embeddingRevision"],
                    "modelLockDigest": base_metadata["modelLockDigest"],
                    "channels": ["lemma-definition", "definition", "lemma"], "threshold": 0.5,
                    "wordsAssessed": len(words), "sensesAssessed": len(ids), "vectorDigests": vector_digests}
        raw = canonical({"metadata": metadata, "enemyWord": enemy, "words": words}).encode()
        target = args.output / f"{enemy.lower()}.json.gz"
        atomic_write(target, gzip.compress(raw, mtime=0))
        report(enemy=enemy, words=len(words), sha256=hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == "__main__":
    main()
