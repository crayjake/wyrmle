#!/usr/bin/env python3
"""Build the complete pinned OEWN sense graph for offline puzzle compilation.

The gzip catalog is intentionally Node-only. Published puzzles should contain
their own small, reviewed meaning records, never import this whole catalog into
the game. The existing POS/relation v1 files are left unchanged.
"""

import argparse
from collections import defaultdict
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
VERSION = "oewn-2025-meanings-v1"
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("lexicon_builder", ROOT / "scripts/build-lexicon.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
DC = "{https://globalwordnet.github.io/schemas/dc/}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Cached official OEWN 2025 .xml.gz")
    args = parser.parse_args()
    source = args.source.read_bytes()
    dictionary_bytes = (ROOT / "node_modules/an-array-of-english-words/index.json").read_bytes()
    if hashlib.sha256(source).hexdigest() != builder.SOURCE_SHA256:
        raise SystemExit("Source checksum differs from the pinned release; create a new version first.")
    if hashlib.sha256(dictionary_bytes).hexdigest() != builder.DICTIONARY_SHA256:
        raise SystemExit("Validity dictionary changed; create a new meaning version first.")
    dictionary = set(json.loads(dictionary_bytes))
    allowed = {word for word in dictionary if re.fullmatch(r"[a-z]+", word)}
    lexicon = ET.fromstring(gzip.decompress(source)).find("Lexicon")
    if lexicon is None or lexicon.get("id") != "oewn" or lexicon.get("version") != "2025":
        raise SystemExit("Expected the official Open English Wordnet 2025 archive.")

    # Keep the entire graph, including multiword/non-game entries, so every
    # relation target resolves and intermediate concepts are not silently lost.
    entry_nodes = sorted(lexicon.findall("LexicalEntry"), key=lambda node: node.get("id"))
    synset_nodes = sorted(lexicon.findall("Synset"), key=lambda node: node.get("id"))
    sense_nodes = sorted([(sense, entry_index) for entry_index, entry in enumerate(entry_nodes)
                          for sense in entry.findall("Sense")], key=lambda pair: pair[0].get("id"))
    sense_indices = {node.get("id"): index for index, (node, _) in enumerate(sense_nodes)}
    synset_indices = {node.get("id"): index for index, node in enumerate(synset_nodes)}

    def edges(node, tag, target_indices):
        result = []
        for edge in node.findall(tag):
            row = [edge.get("relType"), target_indices[edge.get("target")]]
            if edge.get(DC + "type"):
                row.append(edge.get(DC + "type"))
            result.append(row)
        return sorted(result, key=lambda row: tuple(map(str, row)))

    entries = []
    words = defaultdict(list)
    # Form codes: 0 = source lemma; 1 = explicit source form; 2 = regular
    # morphological inference. They are evidence, never interchangeable claims.
    for index, entry in enumerate(entry_nodes):
        lemma = entry.find("Lemma")
        written = lemma.get("writtenForm", "")
        word = written.lower()
        pos = lemma.get("partOfSpeech")
        forms = {form.get("writtenForm", "").lower() for form in entry.findall("Form")}
        explicit = {word, *forms} & allowed
        regular = (builder.regular_forms(word, builder.POS.get(pos), bool(forms)) & allowed
                   if re.fullmatch(r"[a-z]+", word) else set())
        entries.append([entry.get("id"), written, pos,
                        [sense_indices[sense.get("id")] for sense in entry.findall("Sense")]])
        for form in sorted(explicit | regular):
            words[form.upper()].append([index, 0 if form == word else 1 if form in explicit else 2])

    senses = [[node.get("id"), entry_index, synset_indices[node.get("synset")],
               edges(node, "SenseRelation", sense_indices)] for node, entry_index in sense_nodes]
    synsets = [[node.get("id"), node.get("partOfSpeech"),
                ["".join(definition.itertext()).strip() for definition in node.findall("Definition")],
                edges(node, "SynsetRelation", synset_indices)] for node in synset_nodes]
    missing_definitions = [row[0] for row in synsets if not row[2] or not all(row[2])]
    if missing_definitions:
        raise SystemExit(f"Source synsets without definitions: {missing_definitions[:10]}")
    catalog = {"version": VERSION, "words": dict(sorted(words.items())),
               "entries": entries, "senses": senses, "synsets": synsets}
    encoded = json.dumps(catalog, ensure_ascii=True, separators=(",", ":")).encode() + b"\n"
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, filename="", mode="wb", compresslevel=9, mtime=0) as archive:
        archive.write(encoded)
    compressed = buffer.getvalue()
    coverage = {"dictionaryWords": len(dictionary), "coveredWords": len(words),
                "directWords": sum(any(form != 2 for _, form in rows) for rows in words.values()),
                "morphologyOnlyWords": sum(all(form == 2 for _, form in rows) for rows in words.values()),
                "missingWords": len(dictionary) - len(words),
                "entries": len(entries), "senses": len(senses), "synsets": len(synsets)}
    metadata = {"version": VERSION,
                "source": {"name": "Open English Wordnet", "version": "2025", "license": "CC-BY-4.0",
                           "url": builder.SOURCE_URL, "sha256": builder.SOURCE_SHA256},
                "dictionary": {"package": "an-array-of-english-words", "version": "2.0.0",
                               "sha256": builder.DICTIONARY_SHA256},
                "catalog": {"sha256": hashlib.sha256(compressed).hexdigest(), "bytes": len(compressed),
                            "uncompressedBytes": len(encoded)},
                "coverage": coverage,
                "policy": "All source senses, definitions and relation targets retained. Only dictionary spellings are queryable as game words. Explicit forms and conservative regular morphology inherit source lemma senses and are labeled separately. No meaning or neutral classification is fabricated for uncovered words; meaning relations require separate reviewed game policy."}
    output = ROOT / "src/lexicon/data"
    (output / f"{VERSION}.json.gz").write_bytes(compressed)
    (output / f"{VERSION}-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
