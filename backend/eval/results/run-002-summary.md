# CP3 Eval run-002

- Model: ag/gemini-3-flash
- Model provider: openai
- Prompt version: cp3-v1
- Total cases: 24
- Intent: 23/24 (95.8%)
- Filter: 15/24 (62.5%)
- Tool: 22/24 (91.7%)
- Retrieval: 21/24 (87.5%)
- Groundedness: 21/24 (87.5%)
- Behavior: 21/24 (87.5%)
- Overall: 13/24 (54.2%)

## Failures

- GS-003: filter, retrieval, behavior
- GS-004: request error (`tzdata` unavailable)
- GS-006: filter
- GS-010: tool, retrieval, behavior
- GS-012: filter
- GS-015: filter
- GS-016: filter
- GS-019: filter
- GS-020: filter
- GS-023: filter, groundedness
- GS-024: groundedness
