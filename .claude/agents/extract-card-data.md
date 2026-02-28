# Extract Card Data from TTS Card Sheet Images

## Overview

Extract structured card text data from Tabletop Simulator (TTS) card sheet images.
TTS stores cards as sprite sheets (multiple cards in a single image grid).
This agent splits them into individual cards and uses AI vision to extract text fields.

## Prerequisites

- Python 3 + Pillow (`pip install Pillow`)
- Split script: `his_ref/img/split_cards.py`
- Claude Code with image reading capability

## Workflow

### Step 1: Identify the Card Sheet

Determine grid dimensions and positions to skip by examining the source image.

```
Read the card sheet image to determine:
1. Grid layout (cols x rows) - count cards across and down
2. Positions to skip (blank slots, card backs, duplicates)
3. Total valid card count = (cols * rows) - skipped
```

**IMPORTANT**: If the user has not specified which positions to skip,
show them the image and ASK before proceeding. Common skip reasons:
- Blank/empty slots (usually at the end of the last row)
- Card back images
- Duplicate or placeholder cards

### Step 2: Split into Individual Cards

Run the split script:

```bash
cd his_ref/img
python split_cards.py <image_file> <cols> <rows> --skip <r,c> <r,c> ...
```

**Do NOT use `--delete-source` here.** The original image is kept until the
entire pipeline completes successfully (see Step 6).

Output goes to `his_ref/img/processed/<sheet_id>/` by default.

Verify by reading 2-3 sample cards from different grid positions to confirm:
- Cards are correctly cropped (no overlap with adjacent cards)
- Text is legible at the cropped resolution
- No systematic offset issues

If the split is wrong (e.g., wrong grid dimensions), delete the output folder
and re-run. The original image is still available for retry.

### Step 3: Extract Card Text via AI Vision

Read each card image and extract these fields:

| Field | Location on Card | Type | Required |
|-------|-----------------|------|----------|
| `number` | Top center | integer | Yes |
| `cp` | Top left (shield icon) | integer (1-5) | Yes |
| `title` | Center, below image | string | Yes |
| `turn` | Top right, "Turn N" | integer or null | No |
| `year` | Top right, "(YYYY)" | integer or null | No |
| `category` | Right, below turn/year, colored banner | string or null | No |
| `description` | Center body text (black) | string | Yes |
| `specialNote` | Bottom text (red/italic) | string or null | No |

**Category values observed**: `MANDATORY`, `RESPONSE` (displayed as colored banners).
Other categories may exist on other sheets - extract as-is.

**Description formatting notes**:
- Bold/italic text in descriptions often indicates conditions or prerequisites
  (e.g., "*If Barbary Pirates has been played,*"). Preserve as plain text.
- "- OR -" separators indicate alternative effects. Keep as-is.
- Card references in italic (e.g., *Wartburg*, *Papal Bull*) can be plain text.

**Batch processing**: Read 6-7 card images per batch (one row at a time)
to balance throughput with accuracy. Verify each card's number is sequential
within the sheet.

### Step 4: Save Structured JSON

Save to `his_ref/img/processed/<sheet_id>.json` with this schema:

```json
{
  "sourceFile": "card_face_XXXXX.jpg",
  "grid": { "cols": 7, "rows": 6 },
  "skipped": ["r5c5", "r5c6"],
  "cardCount": 40,
  "cards": [
    {
      "number": 77,
      "cp": 2,
      "title": "Fountain of Youth",
      "turn": null,
      "year": null,
      "category": null,
      "description": "Cancel a Voyage of Exploration that...",
      "specialNote": null,
      "gridPosition": "r0c0"
    }
  ]
}
```

### Step 5: Validate

Run a validation check on the output JSON:

```python
import json
with open('processed/<sheet_id>.json', 'r') as f:
    data = json.load(f)
cards = data['cards']
print(f"Card count: {len(cards)} (expected {data['cardCount']})")
nums = [c['number'] for c in cards]
print(f"Number range: {min(nums)}-{max(nums)}")
# Check for gaps in numbering
for i in range(len(nums)-1):
    if nums[i+1] - nums[i] != 1:
        print(f"  Gap: {nums[i]} -> {nums[i+1]}")
# Check all required fields present
for c in cards:
    for field in ['number', 'cp', 'title', 'description']:
        if c[field] is None:
            print(f"  Missing {field} on card {c['number']}")
```

### Step 6: Delete Source Image

Only after validation passes (correct card count, no missing required fields,
no obvious extraction errors), delete the original card sheet image:

```bash
rm <original_image_file>
```

**This is the LAST step.** Never delete the source image earlier in the pipeline.
If any previous step fails or produces incorrect results, the source image is
still available for re-processing.

## Output Structure

```
his_ref/img/processed/
├── <sheet_id>/              # Individual card images
│   ├── <sheet_id>_r0_c0.jpg
│   ├── <sheet_id>_r0_c1.jpg
│   └── ...
└── <sheet_id>.json          # Extracted card data
```

## Field Extraction Tips (from experience)

1. **year vs turn**: Some cards show `(1517)` — this is `year`. Others show
   `Turn 3` or `Turn 3 (1517)` — extract both `turn` and `year` when present.
   Cards with only `(1517)` and a `†` symbol after the title have `year: 1517`
   but `turn: null` — the year indicates the card is in the early deck.

2. **† symbol after title**: Indicates the card is removed from the deck after
   being played as an event. The `specialNote` field usually contains
   "Remove from deck if played as event." but read the actual red text.

3. **MANDATORY / RESPONSE banners**: These appear as colored banners on the
   right side of the card, below the turn indicator. They are distinct from
   the description text.

4. **Foreign War cards**: Cards like "Revolt in Egypt", "War in Persia" have
   the phrase "Foreign War card" in bold within their description. These are
   a special card type but the `category` field should remain null unless
   there's a visible banner — capture "Foreign War" context in `description`.

5. **Multi-effect cards**: Some cards have "- OR -" separating alternative
   effects. Keep the full text including the separator.

6. **Playability restrictions**: Phrases like "Not playable by Protestant"
   or "Playable by England, France, Hapsburg" appear in italic at the start
   of descriptions. Include them in the `description` field.

## Processing Multiple Sheets

When processing additional card sheets from the same game:

1. Each sheet gets its own subfolder and JSON file
2. Card numbers should not overlap between sheets
3. After all sheets are processed, merge into a single master file:
   `his_ref/img/processed/all_cards.json`
