# Rejected 4B contextual candidate

This is an audit of the complete attempted Qwen3-4B-Instruct-2507 assessment,
not a publication-ready semantic cache. Its frozen policy digest is
`3e8f1135c0e5bb5f2cca1d5ede645a140d223017b9d56e983445107c9f5d341d`.

`inference-audit.jsonl.gz` has one manifest header followed by 1,065 distinct
source-input records. It preserves the pinned model/prompt/policy, source
definitions, explanations, selected groups/senses, invalid-output attempts,
and request digests. There are 1,057 valid-format responses and eight exhausted
format errors. Of these inputs, 239 ran on CPU and 826 on the RX 9070 Vulkan
backend; Vulkan records identify the driver, runtime archive and launch flags.
The cache reused the first saved response for an identical input.

The compact puzzle accounts for 1,019 distinct inputs / 1,610 eligible spellings.
The remaining inputs come from development, gameplay controls and independent
quality checks. A valid output format does not establish semantic correctness:
the independent primary test scored 140/144 labels with 29/30 constrained
source selections, while the confirmation test scored 31/36 labels. The
candidate failed the fixed publication quality gates. Its 85/85 development
label result had not checked the source-selection constraints.

The archive's SHA-256 is
`81fcc33004865405713020da29d0e8df0e9a5120a980da3f64eb988e36660b02`.
The companion `summary.json` records the aggregate counts. Dictionary
attribution and model licenses are documented in `docs/offline-semantics.md`.
