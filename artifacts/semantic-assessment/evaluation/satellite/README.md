# Rejected satellite proof prototype

This isolated authoring experiment adds only explicit OEWN adjective-satellite (`-s`) → head-adjective (`-a`) `similar` edges, preserving the existing forward direction, two-edge total bound and excluded-sense checks. It reaggregates the frozen .75 NLI cache; it does not run new model inference or change repository source code.

The configuration was frozen after 85/85 development labels and 24/24 constrained senses passed. The actual complete six-enemy outputs then had unchanged main and confirmation benchmark results; confirmation still failed. Five CHAOS labels changed outside the benchmarks, retained with exact proof paths here.

**Not adopted.** The reviewed PEACEFUL root explicitly disables similarity expansion. Although these source edges are real, enabling this proof channel globally would bypass that reviewed expansion policy. It also did not address the observed semantic misses. No score threshold or expected benchmark label was changed for this experiment.

`prototype.py` records the temporary full-source/export/reaggregation procedure and expects the baseline source/cache under the `/tmp` paths used during evaluation. `source-change-summary.json` records the candidate source/configuration hashes; `summary.json` records the actual-output quality result and cache checksums.
