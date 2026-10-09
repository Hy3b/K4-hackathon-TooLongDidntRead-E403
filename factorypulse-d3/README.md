# FactoryPulse D3 — 2026 idea-round evidence
**Public project code on isolated branch**. This lives in a dedicated `factorypulse-d3/` directory and does not modify the unrelated main project.

DENSO D3: link ERP orders/BOM, WMS components, MES manufacturing, QA release and delivery ETA. Decision support compares SAME candidate policy under manual SOP lookup vs cross-layer feed, including adverse outcomes.

**Quick interactive demo:** open `standalone.html` directly in a browser (all code and synthetic data self-contained).

**Reproduce offline** (Node.js 18+):
```bash
node --test tests/check.test.mjs
node scripts/benchmark.mjs
```
**Expected synthetic evidence:** 24 stress cases: **5 integrated wins, 14 ties, 2 manual wins, 3 VERIFY**. These are handcrafted cases, not independent external validation. Average integrated loss is worse on this full toy set because three stale-data cases refuse intervention. Do not market the win count or any simulated delay as DENSO field ROI.

Hard constraints include QA approvals and alternate machine capacity. A stale feed requires verification. A known injected incident is NOT inferred causal root cause. SOP lookup minutes and integration delays are assumptions, not recorded factory timings. No PLC/QA control.

References:
- Official [D3 problem](https://densohackathon.vn/theme)
- [JMA case study on DENSO Manufacturing Vietnam Future Command Room (June 2026)](https://imd.jma.or.jp/management/report/activity_report41.html)

**Pilot only if validated:** select one cell; map actual data keys; historical replay; measure SOP response latency; run human-approved shadow mode; stop if data are stale, no benefit vs existing process, or action approvals cannot be verified.

The complete editable submission deck and recorded demo are provided as deliverables outside this GitHub branch. Team identities and experience must be confirmed before submission.