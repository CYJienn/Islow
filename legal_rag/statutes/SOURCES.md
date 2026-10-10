# Statutes: sources

**Status (2026-10-10): the 8 Acts below are already downloaded into `raw/` and indexed.** Versions: Contracts (2006 reprint), Employment (1 Aug 2023, includes A1651), Penal Code (4 Jul 2023), Limitation (1 Sep 2019 online text), PDPA (15 Sep 2026, includes A1727), Companies (31 Jan 2025 online text), MACC (1 Jan 2022, includes s.17A), Consumer Protection (1 Nov 2021). Still to add: Rules of Court 2012 Order 93, MACC Guidelines on Adequate Procedures. Re-check the portal for newer versions before relying on them.

Instructions below are for adding or refreshing Acts.

Source: https://lom.agc.gov.my > Act > Principal > Updated. Search by Act number, download the PDF.
The portal encrypts its listing in the browser and does not allow scripted downloads, so this is a browser job.

| Save as (in `raw/`) | Act | Notes |
|---|---|---|
| `Act136_Contracts.pdf` | Contracts Act 1950 (Act 136) | |
| `Act265_Employment.pdf` | Employment Act 1955 (Act 265) | Also get the 2022 amendment Act (A1651) |
| `Act574_PenalCode.pdf` | Penal Code (Act 574) | Only s.405-424 are indexed (`sections` in acts.json) |
| `Act254_Limitation.pdf` | Limitation Act 1953 (Act 254) | |
| `Act709_PDPA.pdf` | Personal Data Protection Act 2010 (Act 709) | Also the 2024 amendment Act |
| `Act777_Companies.pdf` | Companies Act 2016 (Act 777) | Large; annual return, directors, records parts matter |
| `Act694_MACC.pdf` | MACC Act 2009 (Act 694) | s.17A. Also save the Guidelines on Adequate Procedures as `.txt` or `.pdf` and add an acts.json entry |
| `Act599_ConsumerProtection.pdf` | Consumer Protection Act 1999 (Act 599) | Tribunal for Consumer Claims part |
| (not on AGC the same way) | Rules of Court 2012, Order 93 (small claims) | Add as `.txt` ⚠ verify the current claim limit |

Then for each file:
1. Fill `source_url`, `in_force_date` and `amended_by` in `acts.json`.
2. **Merge amendments into the text** where an amendment Act changes a section: edit the `.txt` copy (or use `.txt` instead of `.pdf`) so the amended wording is what gets indexed, and note the change at the end of that section.
3. If a PDF is a scan (cannot highlight text), OCR it first.
4. `python rag.py build`, then `python rag.py ask "s.74"` and compare that one section to the official PDF by hand.

Later (not needed for demo): Industrial Relations Act 1967, Sale of Goods Act 1957, Electronic Commerce Act 2006, Trademarks Act 2019, Copyright Act 1987, Minimum Wages Order, EPF/SOCSO/EIS Acts, LHDN e-invoice and SST guides.
