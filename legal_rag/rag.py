"""Legal Handbook RAG: chunk statutes/playbooks/templates/company profile, search with BM25.

    python rag.py build
    python rag.py ask "penalty clause late payment" [-k 5] [--kind statute|playbook|template|company]

Agents: `from rag import search; search("s.74 breach", kind="statute")`
"""
import json, math, re, sys
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
SEC = re.compile(r"(?m)^[ \t]*(\d{1,3}[A-Za-z]{0,2})\.[ \t]+(?=[A-Z(])")  # "74. Title" / "74. (1) Text" / "17a. (1) Text"
tok = lambda s: re.findall(r"\w+", s.lower())


def _text(f):
    if f.suffix.lower() == ".pdf":
        from pypdf import PdfReader
        return "\n".join(p.extract_text() or "" for p in PdfReader(f).pages)
    return f.read_text("utf8")


def statute_chunks(root):
    meta_f = root / "statutes" / "acts.json"
    meta = json.loads(meta_f.read_text("utf8")) if meta_f.exists() else {}
    for f in sorted((root / "statutes" / "raw").glob("*")):
        m = meta.get(f.name)
        if not m:
            print("skip (no entry in statutes/acts.json):", f.name)
            continue
        text = _text(f)
        hits = list(SEC.finditer(text))
        best = {}  # table of contents repeats section numbers; keep the longest body
        for i, h in enumerate(hits):
            body = text[h.start(): hits[i + 1].start() if i + 1 < len(hits) else len(text)].strip()
            n = h.group(1).upper()
            lo, hi = m.get("sections", [0, 10**6])
            if not lo <= int(re.match(r"\d+", n).group()) <= hi:
                continue
            if n not in best or len(body) > len(best[n][0]):
                end = max(h.start() - 1, 0)  # AGC prints the section's title on the line above "74. (1) ..."
                best[n] = (body, text[text.rfind("\n", 0, end) + 1: end].strip())
        for n, (body, head) in best.items():
            title = re.sub(r"^\d+[A-Za-z]*\.\s*", "", body.splitlines()[0])[:100]
            if title.startswith("(") and 0 < len(head) < 150 and not head.endswith((".", ";", ":", ",")) and not head.startswith("("):
                title, body = head, f"{head}\n{body}"
            yield dict(kind="statute", act=m["act"], section=n, title=title, text=body,
                       cite=f"{m['act']} s.{n}", in_force_date=m.get("in_force_date"),
                       amended_by=m.get("amended_by"), source_url=m.get("source_url"), source=f.name)


def md_chunks(root, folder, kind):
    for f in sorted((root / folder).glob("*.md")):
        parts = re.split(r"(?m)^## ", f.read_text("utf8"))
        for i, p in enumerate(parts):
            if not p.strip():
                continue
            title = f.stem if i == 0 else p.splitlines()[0].strip()
            yield dict(kind=kind, title=title, text=p.strip(), cite=f"{f.stem} > {title}", source=f.name)


def company_chunks(root):
    f = root / "company" / "profile.json"
    if not f.exists():
        return
    for key, val in json.loads(f.read_text("utf8")).items():
        for j, item in enumerate(val if isinstance(val, list) else [val]):
            yield dict(kind="company", title=key, text=f"{key}: {json.dumps(item, ensure_ascii=False)}",
                       cite=f"company profile > {key}[{j}]", source="profile.json")


MODEL = "BAAI/bge-small-en-v1.5"  # 67 MB, runs locally, free. Chunk vectors are committed; only the query is embedded at run time.
DENSE_WEIGHT = 0.35  # share of the score from dense vectors; the other 0.65 is sparse (BM25). 0 = pure sparse
_model = None


def _embed(texts, query=False):
    global _model
    from fastembed import TextEmbedding  # optional dependency: without it search is sparse-only
    _model = _model or TextEmbedding(MODEL)
    v = np.array(list((_model.query_embed if query else _model.passage_embed)(texts)), dtype=np.float32)
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def build(root=ROOT, dense=True):
    chunks = [*statute_chunks(root), *md_chunks(root, "playbooks", "playbook"),
              *md_chunks(root, "templates", "template"), *company_chunks(root)]
    post, dl = {}, []  # sparse index: term -> [[chunk id, term freq], ...]; dl = chunk lengths
    for i, c in enumerate(chunks):
        c["id"] = i
        tf = Counter(tok(f"{c['title']} {c.get('act') or ''} {c['text']}"))
        dl.append(sum(tf.values()))
        for t, n in tf.items():
            post.setdefault(t, []).append([i, n])
    (root / "index.json").write_text(json.dumps(dict(chunks=chunks, post=post, dl=dl, model=MODEL), ensure_ascii=False), "utf8")
    emb = root / "embeddings.npy"
    emb.unlink(missing_ok=True)  # never leave vectors that do not match the chunks
    if dense:
        try:
            vecs = np.vstack([_embed([f"{c['title']}. {c['text'][:2000]}" for c in chunks[i:i + 64]]) for i in range(0, len(chunks), 64)])
            np.save(emb, vecs.astype(np.float16))
        except ImportError:
            print("fastembed not installed: built sparse-only (pip install fastembed for dense vectors)")
    print(Counter(c["kind"] for c in chunks), f"{len(post)} terms", "+ dense" if emb.exists() else "(sparse only)")
    return chunks


def search(q, k=5, kind=None, pool=25, rerank=True, dense=DENSE_WEIGHT, root=ROOT):
    """Sparse-led hybrid search (law needs exact terms and citations, so sparse 65% / dense 35%).
    Stage 1: sparse BM25 over the inverted index and dense cosine over the committed vectors each give their
    top `pool`, merged by weighted reciprocal rank fusion. Stage 2: rerank by weighted BM25 + cosine, plus term
    coverage, phrase (bigram) and title match -> top `k`. `dense=0` is pure sparse; it is also the automatic
    fallback when vectors or fastembed are missing."""
    ix = json.loads((root / "index.json").read_text("utf8"))
    chunks, post, dl = ix["chunks"], ix["post"], ix["dl"]
    n, avg = len(chunks), sum(dl) / max(len(dl), 1)
    cos = None
    if dense and (root / "embeddings.npy").exists():
        try:
            cos = np.load(root / "embeddings.npy").astype(np.float32) @ _embed([q], query=True)[0]
        except ImportError:
            pass
    dense = dense if cos is not None else 0  # no vectors: behave exactly as pure sparse
    score = Counter()
    for t in set(tok(q)):
        p = post.get(t, [])
        idf = math.log(1 + (n - len(p) + .5) / (len(p) + .5))
        for i, tf in p:
            score[i] += idf * tf * 2.5 / (tf + 1.5 * (.25 + .75 * dl[i] / avg))
    for s in {s.upper() for s in re.findall(r"(?i)\bs(?:ec(?:tion)?)?\.?\s*(\d+[A-Z]?)", q)}:
        for c in chunks:
            if c.get("section") == s:
                score[c["id"]] += 5  # explicit "s.74" lookup
    keep = lambda i: not kind or chunks[i]["kind"] == kind
    rank = Counter()  # reciprocal rank fusion of the sparse list and the dense list
    for r, (i, _) in enumerate([x for x in score.most_common() if keep(x[0])][:pool]):
        rank[i] += (1 - (dense if cos is not None else 0)) / (60 + r)
    if cos is not None:
        for r, i in enumerate([i for i in np.argsort(-cos) if keep(i)][:pool]):
            rank[int(i)] += dense / (60 + r)
    cand = [i for i, _ in rank.most_common(pool)]
    qt = tok(q)
    if not rerank or not cand or not qt:
        return [chunks[i] for i in cand[:k]]
    qs, qb = set(qt), set(zip(qt, qt[1:]))
    top = max(score[i] for i in cand) or 1
    ctop = max(cos[i] for i in cand) if cos is not None else 1

    def final(i):
        c = chunks[i]
        d, ti = tok(c["text"]), set(tok(c["title"]))
        return ((1 - dense) * score[i] / top + (dense * max(cos[i], 0) / ctop if cos is not None else 0)  # 65% sparse + 35% dense
                + .5 * len(qs & set(d)) / len(qs)                      # how many query terms appear
                + .5 * len(qb & set(zip(d, d[1:]))) / max(len(qb), 1)  # query phrases kept intact
                + .5 * len(qs & ti) / len(qs))                         # query words in the title
    return [chunks[i] for i in sorted(cand, key=lambda i: -final(i))[:k]]


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # Windows console is cp1252; chunks contain ⚠
    a = sys.argv[1:]
    if a[:1] == ["build"]:
        build()
    elif a[:1] == ["ask"]:
        k = int(a[a.index("-k") + 1]) if "-k" in a else 5
        kind = a[a.index("--kind") + 1] if "--kind" in a else None
        skip = {a.index(x) + 1 for x in ("-k", "--kind") if x in a} | {a.index(x) for x in ("-k", "--kind") if x in a}
        q = " ".join(x for i, x in enumerate(a[1:], 1) if i not in skip)
        for c in search(q, k, kind):
            print(f"[{c['kind']}] {c['cite']}  ({c['source']})\n    {' '.join(c['text'].split())[:300]}\n")
    else:
        print(__doc__)
