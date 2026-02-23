# Rulebook Extraction Pipeline (HIS)

This folder contains a self-contained extraction pipeline for:
- text (per-page raw + cleaned)
- extracted embedded images
- generated rulebook markdown docs
- QA/manifest metadata

## Environment

Use WSL conda base as requested:

```bash
source /home/tlan/miniconda3/bin/activate base
```

## Run

From repo root:

```bash
python his_ref/rulebook_extraction/extract_rulebook.py \
  --pdf his_ref/HIS-Rules-2010.pdf \
  --out his_ref/rulebook_extraction
```

## Outputs

- `his_ref/rulebook_extraction/pages/page_XXX_raw.txt`
- `his_ref/rulebook_extraction/pages/page_XXX_clean.txt`
- `his_ref/rulebook_extraction/images/*`
- `his_ref/rulebook_extraction/pages_manifest.json`
- `his_ref/rulebook_extraction/RULEBOOK_CANONICAL.md`
- `his_ref/rulebook_extraction/RULEBOOK_CLEAN.md`
- `his_ref/rulebook_extraction/RULEBOOK_QA.md`

## Notes / Limits

- This pipeline does not perform OCR.
- It extracts from PDF text streams and ToUnicode maps.
- Some text layout artifacts are expected (line breaks, headings, hyphenation).
- Some image color spaces may be unsupported and are reported in `RULEBOOK_QA.md`.
