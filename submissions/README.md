# submissions/

Drop your lab here as `submissions/<your-slug>.lab.json` and open a PR.

- The filename stem **must** equal the lab's `"id"` (e.g. `my-lab.lab.json` → `"id": "my-lab"`).
- Plain JSON (`.lab.json`). Annotated `.lab.jsonc` is fine too — strip comments
  for the final file if you want, but CI accepts either.
- On PR, the **lab-validate** check runs `lab.schema.json` + static gates
  (id↔filename, node↔edge references, check↔node references, unique ids). Fix
  anything it flags — the error messages name the exact field.
- A maintainer then reviews it live before it's published.

Start from the fully-annotated [examples/cw-plus-noise](../examples/cw-plus-noise/lab/cw-plus-noise.lab.jsonc)
— it documents every field inline.
