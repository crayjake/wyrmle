"""Offline English corpus lookup. Input words come from the playing dictionary."""
from collections import defaultdict
from hashlib import sha256
from importlib.metadata import version
from pathlib import Path
import json
import sys

import wordfreq

lock = json.loads((Path(__file__).parent / "wordfreq-lock.json").read_text())
assert version("wordfreq") == lock["version"], "Install the pinned wordfreq version."
data = Path(wordfreq.__file__).parent / "data" / "large_en.msgpack.gz"
assert sha256(data.read_bytes()).hexdigest() == lock["dataSha256"], "Corpus bytes changed."
source = json.load(sys.stdin)
words = source["words"]
assert words == sorted(set(words))
bins = defaultdict(list)
for word in words:
    assert word.isascii() and word.isalpha() and word.isupper()
    # No lemma substitution: inflections use their own observed frequencies.
    frequency = wordfreq.zipf_frequency(word.lower(), "en", wordlist="large", minimum=0)
    hundredths = round(frequency * 100)
    assert 0 <= hundredths <= 800
    bins[hundredths].append(word)
result = {
    "version": "wyrmle-wordfreq-en-3.1.1-v1",
    "source": lock,
    "dictionaryVersion": source["dictionaryVersion"],
    "dictionaryDigest": source["dictionaryDigest"],
    "scale": {
        "stored": "Zipf frequency multiplied by 100, rounded to an integer",
        "commonness": "clamp((zipf - 1) / 4, 0, 1)",
        "familiarMinimum": 0.5,
        "familiarZipfMinimum": 3,
        "unobservedZipf": 0,
        "unobservedMeaning": "Not present in the large English corpus list; not a measured zero frequency"
    },
    "counts": {
        "queried": len(words),
        "observed": sum(len(values) for score, values in bins.items() if score > 0),
        "unobserved": len(bins[0]),
        "familiar": sum(len(values) for score, values in bins.items() if score >= 300)
    },
    "bins": [[score, " ".join(bins[score])] for score in sorted(bins)]
}
json.dump(result, sys.stdout, separators=(",", ":"), ensure_ascii=True)
sys.stdout.write("\n")
