# Legal RAG (Legal Handbook, Malaysia)

Searchable handbook for the Legal team agents (see `../specs/LEGAL_WORKFLOW.md`). Information only, not legal advice.

| Part | Folder | Status |
|---|---|---|
| A. Statutes | `statutes/raw/` + `statutes/acts.json` | 8 Acts downloaded from AGC (versions and dates in `acts.json`). Rules of Court Order 93 and the MACC Adequate Procedures Guidelines are not yet added |
| B. Playbooks | `playbooks/` | 3 drafts (NDA, service agreement as supplier, supplier agreement as buyer). Need a lawyer's review |
| C. Templates | `templates/` | 6 documents + 3 checklists, drafts |
| D. Company profile | `company/profile.json` | Made-up demo company, no real data |

## Use
```
pip install pypdf          # only needed for PDF statutes
python rag.py build        # chunk everything into index.json
python rag.py ask "penalty clause late payment" -k 5 [--kind statute|playbook|template|company]
python test_rag.py         # self-check
```
From an agent: `from rag import search; search("s.74 breach", kind="statute")` returns chunks with `cite`, `text`, `source`.

## How it works
- Statutes: split by section number (`74. Title`), one chunk per section, tagged `act, section, title, in_force_date, amended_by, source_url`. Penal Code is limited to s.405-424 by `sections` in `acts.json`. Contents-page duplicates are dropped.
- Playbooks and templates: one chunk per `##` heading. Company profile: one chunk per item.
- Search, two stages, no embeddings, no extra dependencies, $0 per query:
  1. Sparse retrieval: BM25 over an inverted index built by `build` (reads only the query terms' postings) -> top 25 candidates. A query containing `s.74` or `section 74` boosts that section.
  2. Rerank: candidates re-scored by BM25 + share of query terms present + query phrases (bigrams) kept intact + query words in the title -> top `k` (default 5). `rerank=False` skips it.
- ponytail: heuristic reranker, not a cross-encoder. If it ranks badly on real statutes, swap stage 2 for a cross-encoder (for example bge-reranker) on the same 25 candidates. For Malay queries, add a synonym list first.

## Before trusting it
1. Statutes must be the current reprint plus amendment Acts; merge amended wording into the text (SOURCES.md step 2).
2. Compare one section per Act with the official PDF.
3. Every item marked ⚠ in the playbooks and templates needs checking (limitation period, small claims limit, PDPA 2024 commencement, Employment Act day counts).
4. Playbook positions are drafts; a lawyer or SME legal guide must confirm them.
5. No real names, NRIC or data anywhere.
