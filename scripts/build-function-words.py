#!/usr/bin/env python3
"""Build a pinned, definition-backed supplement for WordNet's closed-class gap.

Normal rebuilds are offline and use the committed sanitized source snapshot.
--source-dir recreates that snapshot from the checksum-pinned Kaikki JSONL
downloads listed below. No definitions, spellings or inflections are invented.
"""

import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/lexicon/data"
VERSION = "wiktionary-function-words-v1"
SNAPSHOT = OUTPUT / "function-words-source-v1.json.gz"
SNAPSHOT_SHA256 = "8d81d6cf5af5d641ef1c45ff75943c609aeec97c86b9ff7ee8069f0c0a1e1f9c"
DICTIONARY_SHA256 = "dadb53f5df46b5b26577fe1cadc85bf076d2d04cf554f6fcda693f2704555e06"
POS = {"article": "article", "conj": "conjunction", "det": "determiner",
       "particle": "particle", "prep": "preposition", "pron": "pronoun",
       "adv": "adverb", "verb": "verb"}
HASHES = {
    "article": "b0832060a159dc97315257a645757e03a9e92389fd11b02fc227405b3b7cd90f",
    "conj": "79a39b42972d4236b9f10277ab977672e47cf8c433f21c392c75ab4327c55bdb",
    "det": "ded787dc52ab80e0b2de5d88f08af139dcc31c1471ace0ab4a5094b80a30e6d2",
    "particle": "418cc21ece399721f73bce1956e7586baa7f93765179f60db8f324b2b40bd717",
    "prep": "a18797673b4531a388d74b4f20e40e046aad34dfb62d4fea18383bd11c4339fa",
    "pron": "190addbd35f9994d531fc9436bb8a9119c8ad5c7b28ba3ed5846ff5e4b5c6d2f",
    "interrogative": "6ae477679245a1ed3872c82cd310fbcea7dc672d4f275dc2415b62cfb4c22e48",
    "relative": "3f8adb1656fee2bbc8a61fecefc1d8311adcda0ca8952c8385b9c1f14582a251",
    "auxiliary": "e0dc58173fac2e0a900755422440a156bb28039fcca928d6c2001b2ae526e572",
    "modal": "253b2fe0bfbf2d2957c220de22e37296c2357d827d4db3af06abbde794722358",
    "form-could": "41c96e125dc2360d7a83aa1a84669f05c3b38f1dd4366f2afbf3047530f46b1d",
    "form-de": "586f6cac0ba3f83b81d03c0b3039eed529ddb294d44b57ab279d80bffe783909",
    "form-dee": "00e4e2980da10d98643d92d32f8a7e90e13d795e17a19e10f9d3e28dd477a50d",
    "form-hae": "eac8a641a791916921f15e61c187f0a5b60ca3ca8182ebede38ce1118956a923",
    "form-mought": "573b2bf88f43db3f75af8541bd2987e18d9721001d12c287f35a23626bf2fc52",
    "form-musting": "3a363a7cdddef80e949ae517cbfc3d0f31572133715e48c8fab85bc61a7ee964",
    "form-musted": "a4711d0a1f38df662e45ae0efc091a5b1fc1eee527dc1f5c04c73426374016da",
    "form-gon": "cb915a454852af3756f12d8247eda80f2b01857b9d84868a7c8ddb5661c48654",
    "form-maun": "ffb5f60c2f2ca6425ec6cab5436e25c70ac32b6ec934a6b8abc2337de6f62b68",
    "form-nills": "6322bab00f859ff88f4d5914de59cdc7d93a3381d2eac4092ccf86598fdde4fd",
    "form-nilling": "b6d07a30e5fb95da32f26b52b45f922784ae0e9a3c3ccb9d28be6f012727324c",
    "form-nilled": "83e609a3fa07f58d9b6bcefce9cae320e2e7bebc4afcc9de2beaae91ccc959c6",
}
REJECT_TAGS = {"archaic", "obsolete", "nonstandard", "proscribed", "misspelling",
               "pronunciation-spelling", "dated", "historical"}
REQUIRED_WORDS = """the and that have for not with you this but his from they say her she will one all would there their what out about who get which when make can like time just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us are were was been being has had does did doing may might must should shall where why whose whom anyone anybody anything everybody everyone everything nobody nothing somebody someone something each either neither both such enough several few many much less little more another every those myself yourself himself herself itself ourselves themselves yours ours theirs although though unless until while since during among amongst amid amidst along across against around before behind below beside besides between beyond despite down except inside near off onto opposite outside past per round through throughout toward towards under underneath unlike upon versus via within without yet nor so whereas wherever whenever whatever whoever whichever whomever whether once""".upper().split()
SOURCE = {"name": "English Wiktionary via Kaikki / Wiktextract",
          "license": "CC-BY-SA-4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
          "url": "https://kaikki.org/dictionary/English/index.html",
          "dumpDate": "2026-09-02", "extractionDate": "2026-09-20",
          "retrievedDate": "2026-09-25"}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_url(key):
    if key.startswith("form-"):
        word = key.removeprefix("form-")
        return f"https://kaikki.org/dictionary/English/meaning/{word[0]}/{word[:2]}/{word}.jsonl"
    if key in ("interrogative", "relative", "auxiliary", "modal"):
        group = {"interrogative": "Lf", "relative": "0t", "auxiliary": "SR", "modal": "xY"}[key]
        return f"https://kaikki.org/dictionary/English/tags/{group}/{key}/kaikki.org-dictionary-English-tag-{key}.jsonl"
    return f"https://kaikki.org/dictionary/English/pos-{key}/kaikki.org-dictionary-English-by-pos-{key}.jsonl"


def make_snapshot(directory):
    records, sources, attested_forms = [], [], defaultdict(list)
    for key, expected in HASHES.items():
        data = (directory / f"{key}.jsonl").read_bytes()
        if sha(data) != expected:
            raise ValueError(f"{key}: source differs from pinned snapshot; create a new version.")
        sources.append({"key": key, "url": source_url(key), "sha256": expected, "bytes": len(data)})
        for entry_index, line in enumerate(data.splitlines()):
            row = json.loads(line)
            if row.get("lang_code") != "en" or not re.fullmatch(r"[a-z]+", row.get("word", "")):
                continue
            if key in ("interrogative", "relative") and row.get("pos") != "adv":
                continue
            if (key in ("auxiliary", "modal") or key.startswith("form-")) and row.get("pos") != "verb":
                continue
            if key in ("auxiliary", "modal"):
                for form in row.get("forms", []):
                    spelling = form.get("form", "")
                    tags = form.get("tags", [])
                    if re.fullmatch(r"[a-z]+", spelling) and not set(tags) & (REJECT_TAGS | {"inflection-template", "table-tags"}):
                        evidence = {"lemma": row["word"], "tags": tags, "sourceFile": key}
                        if evidence not in attested_forms[spelling]:
                            attested_forms[spelling].append(evidence)
            if row.get("pos") not in POS:
                raise ValueError("Unexpected source part of speech.")
            senses = []
            for sense_index, sense in enumerate(row.get("senses", [])):
                if key in ("interrogative", "relative") and key not in sense.get("tags", []):
                    continue
                if key in ("auxiliary", "modal") and key not in sense.get("tags", []):
                    continue
                # Usage quotations, media and translations have separate possible
                # copyright terms and are deliberately not part of this extract.
                projected = {field: sense[field] for field in
                             ("id", "glosses", "tags", "form_of", "alt_of") if field in sense}
                if not sense.get("id"):
                    projected["sourceLocator"] = f"kaikki-sha256:{expected}:entry:{entry_index}:sense:{sense_index}"
                senses.append(projected)
            if senses:
                records.append({"sourceFile": key, "word": row["word"], "pos": row["pos"],
                                "tags": row.get("tags", []), "senses": senses})
    for key in HASHES:
        if key.startswith("form-") and key.removeprefix("form-") not in attested_forms:
            raise ValueError(f"{key} is not an explicitly attested auxiliary form.")
    allowed = set(json.loads((ROOT / "node_modules/an-array-of-english-words/index.json").read_text()))
    base_words = set(json.loads((OUTPUT / "meaning-dictionary-v1.json").read_text())["words"])
    category_words, _ = build({"records": [r for r in records if not r["sourceFile"].startswith("form-")]}, allowed)
    needed_forms = {word for word in attested_forms if word in allowed and
                    word.upper() not in base_words | set(category_words)}
    downloaded_forms = {key.removeprefix("form-") for key in HASHES if key.startswith("form-")}
    if needed_forms != downloaded_forms:
        raise ValueError(f"Auxiliary form source coverage changed: {sorted(needed_forms ^ downloaded_forms)}")
    snapshot = {"version": VERSION, "source": SOURCE, "sources": sources,
                "attestedAuxiliaryForms": dict(sorted(attested_forms.items())), "records": records}
    compressed = gzip.compress(encoded(snapshot), compresslevel=9, mtime=0)
    if SNAPSHOT_SHA256 and sha(compressed) != SNAPSHOT_SHA256:
        raise ValueError("Projection changed; create a new source version.")
    SNAPSHOT.write_bytes(compressed)
    return snapshot


def build(snapshot, allowed):
    candidates = defaultdict(list)
    rejected = Counter()
    for entry_order, row in enumerate(snapshot["records"]):
        for order, sense in enumerate(row["senses"]):
            tags = sorted(set(row["tags"] + sense.get("tags", [])))
            if set(tags) & REJECT_TAGS:
                rejected["excludedUsageTag"] += 1
                continue
            glosses = sense.get("glosses", [])
            if not glosses or any(not isinstance(g, str) or not g.strip() or
                                 re.search(r"\{\{|\}\}|\[please|rfdef|no definition|definition needed", g, re.I)
                                 for g in glosses):
                rejected["missingOrPlaceholderDefinition"] += 1
                continue
            if not sense.get("id") and not sense.get("sourceLocator"):
                raise ValueError(f"Missing source sense locator for {row['word']}")
            payload = {"lemma": row["word"], "partOfSpeech": POS[row["pos"]],
                       "sourceSenseId": sense.get("id", sense.get("sourceLocator")), "glosses": glosses, "tags": tags,
                       "formOf": sense.get("form_of", []), "altOf": sense.get("alt_of", [])}
            record = {"id": "wikt-en-" + sha(encoded(payload))[:20], **payload,
                      "definition": " ".join(glosses),
                      "sourceUrl": "https://en.wiktionary.org/wiki/" + quote(row["word"]) + "#English",
                      "sourceOrder": entry_order * 1000 + order}
            if not any(existing["id"] == record["id"] for existing in candidates[row["word"]]):
                candidates[row["word"]].append(record)

    def resolve(record, visited):
        references = record["formOf"] + record["altOf"]
        if not references:
            return []
        resolved = []
        for reference in references:
            target = reference.get("word", "")
            if target in visited:
                continue
            for target_record in candidates.get(target, []):
                if target_record["partOfSpeech"] != record["partOfSpeech"]:
                    continue
                children = resolve(target_record, visited | {target})
                if children is not None:
                    resolved.append({"word": target, "senseId": target_record["id"],
                                     "definition": target_record["definition"],
                                     "sourceUrl": target_record["sourceUrl"], "references": children})
        return resolved or None

    words = {}
    for word in sorted(candidates):
        if word not in allowed:
            rejected["outsideSpellingDictionary"] += 1
            continue
        senses = []
        for record in candidates[word]:
            resolved = resolve(record, {word})
            if resolved is None:
                rejected["unresolvedFormReference"] += 1
                continue
            display = dict(record)
            if resolved:
                display["resolvedReferences"] = resolved
                display["definition"] += " " + resolved[0]["definition"]
            senses.append(display)
        # Neutral grammatical display preference, not a frequency claim. Within
        # each class preserve upstream order; pronouns/articles precede less
        # typical conjunction/preposition readings and references rank last.
        priority = {"adverb": 0, "pronoun": 1, "article": 2, "determiner": 3,
                    "conjunction": 4, "preposition": 5, "particle": 6, "verb": 7}
        senses.sort(key=lambda r: (bool(r["formOf"] or r["altOf"]),
                                   bool(set(r["tags"]) & {"dialectal", "rare", "informal", "slang"}),
                                   priority[r["partOfSpeech"]], r["sourceOrder"], r["id"]))
        if senses:
            words[word.upper()] = {"lemma": word,
                                    "partsOfSpeech": sorted({s["partOfSpeech"] for s in senses}),
                                    "senses": senses}
    return words, dict(sorted(rejected.items()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, help="Directory of pinned .jsonl source files")
    args = parser.parse_args()
    dictionary_bytes = (ROOT / "node_modules/an-array-of-english-words/index.json").read_bytes()
    if sha(dictionary_bytes) != DICTIONARY_SHA256:
        raise SystemExit("Spelling dictionary changed; review coverage and create a new version.")
    if args.source_dir:
        snapshot = make_snapshot(args.source_dir)
    else:
        data = SNAPSHOT.read_bytes()
        if SNAPSHOT_SHA256 and sha(data) != SNAPSHOT_SHA256:
            raise SystemExit("Pinned source snapshot checksum differs.")
        snapshot = json.loads(gzip.decompress(data))
    allowed = set(json.loads(dictionary_bytes))
    words, rejected = build(snapshot, allowed)
    base = json.loads((OUTPUT / "meaning-dictionary-v1.json").read_text())
    base_words = set(base["words"])
    missing = sorted(set(REQUIRED_WORDS) - (set(words) | base_words))
    if missing:
        raise SystemExit(f"Required everyday-word coverage failed: {missing}")
    result = {"version": VERSION, "source": SOURCE, "words": words}
    output = encoded(result)
    (OUTPUT / "function-words-v1.json").write_bytes(output)
    metadata = {"version": VERSION, "source": SOURCE, "sources": snapshot["sources"],
                "snapshot": {"file": SNAPSHOT.name, "sha256": sha(SNAPSHOT.read_bytes()),
                             "bytes": SNAPSHOT.stat().st_size},
                "dictionary": {"package": "an-array-of-english-words", "version": "2.0.0",
                               "sha256": DICTIONARY_SHA256},
                "export": {"sha256": sha(output), "bytes": len(output)},
                "coverage": {"supplementWords": len(words), "newWords": len(set(words) - base_words),
                             "senseCount": sum(len(w["senses"]) for w in words.values()),
                             "requiredWords": REQUIRED_WORDS, "missingRequiredWords": missing},
                "rejected": rejected,
                "policy": {"selection": "All existing dictionary spellings in six closed-class POS partitions plus interrogative/relative adverbs and auxiliary/modal verbs. Still-uncovered explicitly attested auxiliary forms receive their own source entries. No word-specific acceptance list or inferred forms.",
                           "excludedTags": sorted(REJECT_TAGS),
                           "references": "Form/alternative references require an acyclic same-POS source definition; exact source glosses, targets and resolved evidence are retained.",
                           "sourceProjection": "Retains source headwords, POS, source sense IDs, glosses, usage tags and form/alternative references; excludes example quotations, translations and media.",
                           "semantics": "Grammatical definitions do not establish an enemy relationship; game-specific classifications are compiled separately."}}
    (OUTPUT / "function-words-v1-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps({"snapshot": metadata["snapshot"], "coverage": metadata["coverage"], "rejected": rejected}, indent=2))


if __name__ == "__main__":
    main()
