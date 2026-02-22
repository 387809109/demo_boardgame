---
name: extract-tts-graphics-urls
description: Extract and normalize card image URLs from Tabletop Simulator workshop/save JSON files by reading CustomDeck FaceURL and BackURL fields. Use when handling TTS .json assets, exporting card face/back graphics, building deckKey-to-image mappings, or generating reusable graphics manifests for board game development.
---

# Extract Tts Graphics Urls

## Overview

Extract a deterministic graphics manifest from a TTS JSON file without carrying TTS-only layout/physics fields. Use the bundled script to output card face/back URLs, optional tile/model resources, optional `States` variants, and optional local image downloads.

## Workflow

1. Confirm the source TTS JSON path.
2. Run `scripts/extract_tts_graphics_urls.ps1`.
3. Check the summary counts in terminal output.
4. Enable optional flags (`-IncludeTiles`, `-IncludeModels`, `-IncludeStates`) when the mod contains non-card assets or state variants.
5. Optionally download images from extracted URLs.
6. Return the generated output file path and image directory.

### Run The Script

```powershell
powershell -File .codex/skills/extract-tts-graphics-urls/scripts/extract_tts_graphics_urls.ps1 `
  -SourcePath "C:\Users\Lan\Documents\My Games\Tabletop Simulator\Mods\Workshop\821387208.json"
```

Specify an explicit output file when needed:

```powershell
powershell -File .codex/skills/extract-tts-graphics-urls/scripts/extract_tts_graphics_urls.ps1 `
  -SourcePath "C:\path\workshop_item.json" `
  -OutputPath "f:\repos\demo_boardgame\TTS_821387208_GRAPHICS_URLS.json"
```

Enable download at the end of extraction:

```powershell
powershell -File .codex/skills/extract-tts-graphics-urls/scripts/extract_tts_graphics_urls.ps1 `
  -SourcePath "C:\Users\Lan\Documents\My Games\Tabletop Simulator\Mods\Workshop\821387208.json" `
  -DownloadImages
```

Include non-card resources for complex mods:

```powershell
powershell -File .codex/skills/extract-tts-graphics-urls/scripts/extract_tts_graphics_urls.ps1 `
  -SourcePath "C:\Users\Lan\Documents\My Games\Tabletop Simulator\Mods\Workshop\1466187317.json" `
  -IncludeTiles `
  -IncludeModels `
  -IncludeStates
```

Specify image output directory and retry behavior:

```powershell
powershell -File .codex/skills/extract-tts-graphics-urls/scripts/extract_tts_graphics_urls.ps1 `
  -SourcePath "C:\path\workshop_item.json" `
  -DownloadImages `
  -ImagesOutputDir "f:\repos\demo_boardgame\TTS_821387208_IMAGES" `
  -RetryCount 3 `
  -TimeoutSec 45
```

## Extraction Rules

- Parse source JSON with UTF-8.
- Traverse both `ObjectStates[]` and nested `ContainedObjects[]`.
- Always read `CustomDeck.{deckKey}` entries for card graphics metadata.
- Read `CustomImage` resources when `-IncludeTiles` is enabled.
- Read `CustomMesh` resources when `-IncludeModels` is enabled.
- Traverse `States` recursively when `-IncludeStates` is enabled.
- Ignore gameplay/physics/layout fields such as `IgnoreFoW`, `MeasureMovement`, `DragSelectable`, transform fields, and Lua/UI fields.
- Deduplicate texture definitions by deck signature (`deckKey + faceURL + backURL + grid/back flags`).
- Preserve key deck metadata needed for downstream slicing (`numWidth`, `numHeight`, `uniqueBack`, `backIsHidden`, `type`).

## Output Contract

The output JSON includes:
- `sourceFile`
- `generatedAtUtc`
- `summary`
- `uniqueFaceURLs`
- `uniqueBackURLs`
- `deckTextureMap`
- `uniqueTileImageURLs` / `uniqueTileSecondaryURLs` / `tileImageMap` (when `-IncludeTiles`)
- `uniqueModelMeshURLs` / `uniqueModelDiffuseURLs` / `uniqueModelNormalURLs` / `uniqueModelColliderURLs` / `modelMeshMap` (when `-IncludeModels`)
- `download` (only when `-DownloadImages` is enabled)

Use this file as the canonical manifest for later download/slicing/import steps.

## Resource

- `scripts/extract_tts_graphics_urls.ps1`: Deterministic extractor for a single TTS JSON file.
