# HIS Map Manual Correction Workflow

1. Review unresolved/low-confidence items in:
   - `ports_review.csv`
   - `language_review.csv`
   - `topology_low_confidence_review.csv`

2. Import review CSV decisions into overrides:
   - Ports are already imported manually or by script.
   - Import language CSV:

```powershell
python his_ref/img/processed/manual_review/import_language_review_to_overrides.py
```

   - Import topology CSV:

```powershell
python his_ref/img/processed/manual_review/import_topology_review_to_overrides.py
```

   `manual_reason` will be preserved on edges. If it contains `pass`, the edge will carry `connection_type: "pass"`.

3. Write/adjust any remaining decisions directly in:
   - `his_vmod_map_overrides.json`

4. Apply overrides:

```powershell
python his_ref/img/processed/manual_review/apply_his_map_overrides.py
```

5. Corrected output:
   - `his_ref/img/processed/his_vmod_map_data.corrected.json`

## Visual Review Map

Generate interactive review map:

```powershell
python his_ref/img/processed/manual_review/build_his_review_map.py
```

Output files:
- `his_ref/img/processed/manual_review/his_map_review.html`
- `his_ref/img/processed/manual_review/HereIStandMap.jpg`
- `his_ref/img/processed/manual_review/his_map_review_data.js`
- `his_ref/img/processed/manual_review/his_map_review_app.js`

How to use:
- Open `his_map_review.html` in browser.
- Click a node: inspect space details (position, type, controller, language, port, sea links).
- Click an edge: inspect connection details (`connection` or `pass`).
- Use filters for controller/language/ports/pass edges to do final verification.
- Edit in sidebar:
  - `Edit Node`: controller/language/port/connected seas/fortress
  - `Edit Edge`: keep/remove edge and mark `pass` (no distance field)
  - `Add Edge`: create a brand-new edge by selecting Space A + Space B
- Export edits:
  - `Copy JSON` or `Download JSON` from the `Overrides` section
  - Replace `his_vmod_map_overrides.json` with exported JSON
  - Re-run `apply_his_map_overrides.py` to materialize into map data

Interaction note:
- Edge lines are intentionally thicker and include a larger invisible hit area for easier clicking.

Data note:
- `apply_his_map_overrides.py` will strip non-rules metrics from output:
  - `coastal_distance_to_sea`
  - topology edge `distance`

Legend:
- Gray edge: inferred connection
- Cyan edge: manual connection
- Orange dashed edge: `pass`
- Blue-ring node: port

## Language Zone Values

Use only:
- `english`
- `french`
- `german`
- `italian`
- `spanish`
- `none` (no language zone)

## Override format

```json
{
  "land_space_overrides": {
    "Bilbao": {
      "is_port": true,
      "connected_sea_zones": ["Bay of Biscay"],
      "language_zone_inferred": "none",
      "initial_controller_1517": "independent",
      "is_fortress": false
    }
  },
  "topology_overrides": {
    "remove_land_edges": [["Cartagena", "Madrid"]],
    "add_land_edges": [
      {
        "a": "SpaceA",
        "b": "SpaceB",
        "confidence": 1.0,
        "method": "manual_override"
      }
    ]
  }
}
```
