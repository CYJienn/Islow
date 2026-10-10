"""Run: python test_rag.py  (self-check on a throwaway handbook, no real data)"""
import json, tempfile
from pathlib import Path
import rag

root = Path(tempfile.mkdtemp())
(root / "statutes" / "raw").mkdir(parents=True)
(root / "playbooks").mkdir()
(root / "templates").mkdir()
(root / "company").mkdir()
(root / "statutes" / "raw" / "toy.txt").write_text(
    "ARRANGEMENT OF SECTIONS\n74. Compensation for breach of contract\n75. Party rightfully rescinding\n"
    "PART II\nCompensation for breach of contract\n74. (1) When a contract has been broken, the party "
    "who suffers is entitled to reasonable compensation.\n75. Party rightfully rescinding contract\n"
    "entitled to compensation.\nOffence by commercial organization\n17a. (1) A commercial organization commits an offence.\n"
    "406. Punishment for criminal breach of trust\nImprisonment.\n999. Out of range\nx\n")
(root / "statutes" / "acts.json").write_text(json.dumps(
    {"toy.txt": {"act": "Toy Act 1950", "sections": [1, 500], "in_force_date": "1950-01-01"}}))
(root / "playbooks" / "nda.md").write_text("# NDA\nintro\n## Governing law\nPreferred: Malaysia\n"
    "## Misc\n" + "late payment interest late interest payment " * 3 +
    "\n## Late payment interest\nCharge interest on any late payment.\n")
(root / "company" / "profile.json").write_text(json.dumps({"name": "Demo Sdn Bhd", "invoices": [{"no": "INV-1"}]}))

chunks = rag.build(root, dense=False)
sec = {c["section"]: c for c in chunks if c["kind"] == "statute"}
assert set(sec) == {"74", "75", "17A", "406"}, set(sec)    # ToC dupes merged, "17a." -> 17A, s.999 filtered out
assert sec["74"]["title"] == "Compensation for breach of contract"  # title taken from the line above "74. (1)"
assert "reasonable compensation" in sec["74"]["text"]       # kept the body, not the ToC line
assert rag.search("compensation breach", root=root)[0]["section"] == "74"
assert rag.search("see s.406", kind="statute", root=root)[0]["section"] == "406"
assert rag.search("governing law", kind="playbook", root=root)[0]["title"] == "Governing law"
q = "late payment interest"
assert rag.search(q, k=1, kind="playbook", rerank=False, root=root)[0]["title"] == "Misc"  # BM25 alone: keyword-stuffed chunk wins
assert rag.search(q, k=1, kind="playbook", root=root)[0]["title"] == "Late payment interest"  # rerank: phrase + title wins
assert rag.search("INV-1", kind="company", root=root)
try:
    import fastembed  # noqa: F401
except ImportError:
    print("ok (dense test skipped: fastembed not installed)")
else:
    import numpy as np
    chunks = rag.build(root)  # dense vectors on
    assert np.load(root / "embeddings.npy").shape == (len(chunks), 384)
    # no shared word with the query: only the dense side can connect "end early" to the s.74 breach text
    hit = rag.search("what happens if one side does not keep the contract", k=3, kind="statute", root=root)
    assert hit and {"74", "75"} & {c["section"] for c in hit}, [c["section"] for c in hit]
    assert rag.search("compensation breach", k=1, root=root)[0]["section"] == "74"
    (root / "embeddings.npy").unlink()  # sparse-only fallback still works
    assert rag.search("compensation breach", k=1, root=root)[0]["section"] == "74"
    print("ok (dense + sparse)")
