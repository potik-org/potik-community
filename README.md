# potik-community

Community-contributed labs for [Potik](https://potik.org) — the in-browser DSP / SDR playground. **PRs welcome.**

A **lab** is a runnable DSP graph (sources → processing → sinks) plus learning
objectives and assertions (`checks`). It's a single JSON file — no code, no build.

## Contribute a lab in 3 steps

1. **Build it** in the live editor at [potik.org](https://potik.org): drag blocks,
   wire them, tune params. **File → Save → JSON** gives you the `graph`.
2. **Wrap it** in a `LabSpec`. Copy
   [examples/cw-plus-noise](examples/cw-plus-noise/lab/cw-plus-noise.lab.jsonc)
   — a fully-annotated reference documenting every field — and paste your graph
   under `"graph"`. Save it to `submissions/<your-slug>.lab.json` (filename stem
   must equal `"id"`).
3. **Open a PR.** The `lab-validate` check runs automatically.

## What CI checks

On every PR, [`scripts/validate-labs.mjs`](scripts/validate-labs.mjs) validates
each lab against [`lab.schema.json`](lab.schema.json) plus semantic static gates:

- schema: required fields, `domain` / `difficulty` / check-`kind` enums, graph shape
- `id` matches the filename
- **slug is unique** — your `id` isn't already published (checked live against potik's lab index) or used by another submission
- every edge references a real node; every check that names a `block` references a real node
- unique node ids and check ids; `block_present/absent/count` carry a `blockKind`

Run it locally before pushing: `npm install && npm test`.

> Block **kinds** (e.g. `cw_source`) aren't validated here — that needs the engine,
> so they're checked when a maintainer runs your lab. CI catches everything
> structural up to that point.

## After your PR

A maintainer reviews the lab live and merges it. It then gets mirrored into
Potik's engine and published at `potik.org/labs/<id>`. (You don't need access to
the engine repo — watch your PR for status.)

## Check kinds you can use

**Static** (fire on load): `block_present` · `block_absent` · `block_count` ·
`param_within` · `edge_exists`

**Live** (evaluated while the lab runs): `spectrum_peak_freq` · `spectrum_peak_db` ·
`spectrum_power_in_band` · `spectrum_floor_below` · `spectrum_mask` ·
`signal_peak_amplitude` · `signal_rms` · `power_db_within` · `rd_target_at` ·
`rd_no_target_in` · `digital_bit_error_rate`

The annotated example documents the parameters for each.
