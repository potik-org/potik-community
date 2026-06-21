# potik-community

Community-contributed labs for [Potik](https://potik.org) — the in-browser DSP / SDR playground. **PRs welcome.**

A **lab** is a runnable DSP graph (sources → processing → sinks) plus learning
objectives and, optionally, assertions (`checks`). It's a single JSON file —
no code, no build.

## Contribute a lab — straight from the editor

No hand-written JSON, no manual fork. The editor builds the PR for you:

1. **Build it** in the live editor at [app.potik.org](https://app.potik.org) —
   drag blocks, wire them, tune params.
2. **File → Submit a lab…** Enter a title, a unique id (slug), and a
   description; pick a domain + difficulty. Tags and objectives are optional —
   so are checks (a sandbox/demo lab is fine with none).
3. **Open GitHub PR →.** Potik assembles the lab and opens a prefilled pull
   request at `submissions/<id>.lab.json`. If your graph is large the JSON is
   copied to your clipboard instead — just paste it (⌘/Ctrl+V) into the empty
   file. Click **Propose changes** and the `lab-validate` check runs
   automatically.

You commit under your own GitHub account — no engine access needed.

> **Prefer to hand-author** (or want to add `checks`)? Copy the annotated
> reference [examples/cw-plus-noise](examples/cw-plus-noise/lab/cw-plus-noise.lab.jsonc)
> — it documents every field — to `submissions/<your-slug>.lab.json` (the
> filename stem must equal `"id"`), then open a PR.

## What CI checks

On every PR, [`scripts/validate-labs.mjs`](scripts/validate-labs.mjs) validates
each lab against [`lab.schema.json`](lab.schema.json) plus semantic static gates:

- schema: required fields, `domain` / `difficulty` / check-`kind` enums, graph shape
- `id` matches the filename
- **slug is unique** — your `id` isn't already published (checked live against potik's lab index) or used by another submission
- every edge references a real node; every check that names a `block` references a real node
- unique node ids and check ids; `block_present/absent/count` carry a `blockKind`
- `checks` is **optional** — a sandbox/demo lab with none is valid

Editing lab files directly in a clone? Run `npm install && npm test` to validate
before pushing.

> Block **kinds** (e.g. `cw_source`) aren't validated here — that needs the engine,
> so they're checked when a maintainer runs your lab. CI catches everything
> structural up to that point.

## After your PR

A maintainer reviews the lab live and merges it. It then gets mirrored into
Potik's engine and published at `app.potik.org/labs/<id>`. (You don't need access to
the engine repo — watch your PR for status.)

## Check kinds you can use (optional)

Checks are optional — submit without any and a maintainer can add them during
review. If you do add them, these are the kinds:

**Static** (fire on load): `block_present` · `block_absent` · `block_count` ·
`param_within` · `edge_exists`

**Live** (evaluated while the lab runs): `spectrum_peak_freq` · `spectrum_peak_db` ·
`spectrum_power_in_band` · `spectrum_floor_below` · `spectrum_mask` ·
`signal_peak_amplitude` · `signal_rms` · `power_db_within` · `rd_target_at` ·
`rd_no_target_in` · `digital_bit_error_rate`

The annotated example documents the parameters for each.
