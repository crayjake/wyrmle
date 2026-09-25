# Preserving a game while correcting meanings

September 25 CHAOS v11 keeps v10's board, tile identities, refill order, lives and combat rules. It adds previously missing definition-backed words as neutral entries and corrects the reviewed calmness, coherence and order families to counter CHAOS. The archived v10 puzzle remains available unchanged so completed results and stored evidence can still be verified.

An unfinished v10 game receives the corrected meanings automatically when they preserve all previously scored outcomes. This is a single versioned compatibility rule, limited to the September 25 `letter-strike-7` v10 → v11 publication pair. The loader checks that:

- Both encounters match their exact reviewed, immutable publication, including all dictionary and profile records. Arbitrary edited tables cannot authorize themselves.
- Physical puzzle and combat rules are identical. Only the encounter identifier, meaning dictionary and mirrored semantic lists can differ.
- The dictionary versions match the explicitly supported source and replacement.
- Replaying the original tile selections produces exactly the same played turns, board, refill position, enemy health, lives and status, including every Undo snapshot.

The original save is validated with its archived rules before any upgrade is considered. Loading does not write or remove saved bytes. The next explicit play or Undo persists v11. The mode, revision and used Undo allowance carry over unchanged; the new word table is attached to in-memory Undo positions too.

Completed wins and losses retain v10 and their original completion time. This includes a terminal run whose separate result record was not written before an interruption. If a previously played word would now receive a different meaning label, hit count or outcome, the game retains v10. **Settings → Beta tools → Reset puzzle** explicitly starts that day again with v11. A failed compatibility check leaves the validated original game in place. Corrupt saves remain blocked and preserved. A tab still holding the old encounter must reload before committing a move.

New definitions change the set of possible future moves, so v11 requires its own regenerated opening-safety certificate and analysis. The v10 certificate cannot establish recovery for newly legal openings. Vocabulary migration preserves the moves already played; the first-word guarantee does not extend to arbitrary later decisions.

The shipped v11 data stores 116 changed records against the retained v10 dictionary: 72 additions and 44 reviewed corrections. Loading combines those explicit stored records with the immutable base; it does not infer definitions or classifications. The complete reconstructed encounter has exactly the same serialized bytes and certificate fingerprint as the fully materialized generator output. This avoids sending a second copy of the large archived dictionary to the phone.

`tests/meaning-vocabulary-upgrade.test.ts` exercises compact and former full saves, playing a newly defined word, immediate and later Undo, completed results, missing result recovery, stale tabs, and corrupted evidence. It also verifies that unreviewed changes to a definition, scoring relation, physical rule or version fail the compatibility gate, and that past turns are never silently rescored.
