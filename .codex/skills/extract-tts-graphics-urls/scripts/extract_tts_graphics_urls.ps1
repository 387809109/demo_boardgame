param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,

  [string]$OutputPath,

  [switch]$DownloadImages,

  [string]$ImagesOutputDir,

  [ValidateRange(0, 10)]
  [int]$RetryCount = 2,

  [ValidateRange(5, 300)]
  [int]$TimeoutSec = 30,

  [switch]$IncludeTiles,

  [switch]$IncludeModels,

  [switch]$IncludeStates
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-SourceFile {
  param([string]$Path)

  try {
    return (Resolve-Path -LiteralPath $Path).Path
  } catch {
    throw "Source file not found: $Path"
  }
}

function Build-OutputPath {
  param(
    [string]$ResolvedSourcePath,
    [string]$ExplicitOutputPath
  )

  if ($ExplicitOutputPath) {
    return $ExplicitOutputPath
  }

  $sourceName = [System.IO.Path]::GetFileNameWithoutExtension($ResolvedSourcePath)
  $defaultName = "TTS_${sourceName}_GRAPHICS_URLS.json"
  return Join-Path -Path (Get-Location).Path -ChildPath $defaultName
}

function Build-ImagesOutputDir {
  param(
    [string]$ResolvedSourcePath,
    [string]$ExplicitImagesOutputDir
  )

  if ($ExplicitImagesOutputDir) {
    return $ExplicitImagesOutputDir
  }

  $sourceName = [System.IO.Path]::GetFileNameWithoutExtension($ResolvedSourcePath)
  $defaultName = "TTS_${sourceName}_IMAGES"
  return Join-Path -Path (Get-Location).Path -ChildPath $defaultName
}

function Add-TtsNodeRecursive {
  param(
    [object]$Node,
    [string]$Path,
    [bool]$IncludeStates,
    [System.Collections.Generic.List[object]]$Output
  )

  if ($null -eq $Node) {
    return
  }

  $Output.Add([PSCustomObject]@{
    node       = $Node
    sourcePath = $Path
  })

  if ($Node.PSObject.Properties.Name -contains "ContainedObjects" -and $Node.ContainedObjects) {
    for ($i = 0; $i -lt $Node.ContainedObjects.Count; $i++) {
      $child = $Node.ContainedObjects[$i]
      Add-TtsNodeRecursive -Node $child -Path ("{0}.ContainedObjects[{1}]" -f $Path, $i) -IncludeStates $IncludeStates -Output $Output
    }
  }

  if ($IncludeStates -and $Node.PSObject.Properties.Name -contains "States" -and $Node.States) {
    foreach ($stateProp in $Node.States.PSObject.Properties) {
      Add-TtsNodeRecursive -Node $stateProp.Value -Path ("{0}.States[{1}]" -f $Path, $stateProp.Name) -IncludeStates $IncludeStates -Output $Output
    }
  }
}

function Get-TtsObjects {
  param(
    [object]$RootJson,
    [bool]$IncludeStates
  )

  $objects = New-Object System.Collections.Generic.List[object]

  for ($i = 0; $i -lt $RootJson.ObjectStates.Count; $i++) {
    Add-TtsNodeRecursive -Node $RootJson.ObjectStates[$i] -Path ("ObjectStates[{0}]" -f $i) -IncludeStates $IncludeStates -Output $objects
  }

  return $objects
}

function Get-DeckRows {
  param([System.Collections.Generic.List[object]]$Entries)

  $rows = New-Object System.Collections.Generic.List[object]

  foreach ($entry in $Entries) {
    $obj = $entry.node
    if (-not ($obj.PSObject.Properties.Name -contains "CustomDeck") -or -not $obj.CustomDeck) {
      continue
    }

    foreach ($deckEntry in $obj.CustomDeck.PSObject.Properties) {
      $deckKey = 0
      if (-not [int]::TryParse([string]$deckEntry.Name, [ref]$deckKey)) {
        continue
      }

      $def = $deckEntry.Value
      if ($null -eq $def) {
        continue
      }

      $rows.Add([PSCustomObject]@{
        sourceName   = [string]$obj.Name
        sourcePath   = [string]$entry.sourcePath
        guid         = [string]$obj.GUID
        nickname     = [string]$obj.Nickname
        deckKey      = $deckKey
        faceURL      = [string]$def.FaceURL
        backURL      = [string]$def.BackURL
        numWidth     = [int]$def.NumWidth
        numHeight    = [int]$def.NumHeight
        backIsHidden = [bool]$def.BackIsHidden
        uniqueBack   = [bool]$def.UniqueBack
        type         = [int]$def.Type
      })
    }
  }

  return $rows
}

function Get-DeckTextureMap {
  param([System.Collections.Generic.List[object]]$Rows)

  $grouped = $Rows | Group-Object deckKey, faceURL, backURL, numWidth, numHeight, backIsHidden, uniqueBack, type | Sort-Object Name

  $mapped = New-Object System.Collections.Generic.List[object]
  foreach ($group in $grouped) {
    $sample = $group.Group | Select-Object -First 1
    $cardInstanceCount = @($group.Group | Where-Object { $_.sourceName -eq "Card" }).Count
    $deckContainerCount = @($group.Group | Where-Object { $_.sourceName -in @("Deck", "DeckCustom") }).Count

    $mapped.Add([PSCustomObject]@{
      deckKey            = $sample.deckKey
      faceURL            = $sample.faceURL
      backURL            = $sample.backURL
      numWidth           = $sample.numWidth
      numHeight          = $sample.numHeight
      backIsHidden       = $sample.backIsHidden
      uniqueBack         = $sample.uniqueBack
      type               = $sample.type
      occurrenceCount    = $group.Count
      cardInstanceCount  = $cardInstanceCount
      deckContainerCount = $deckContainerCount
    })
  }

  return $mapped | Sort-Object deckKey
}

function Get-TileRows {
  param([System.Collections.Generic.List[object]]$Entries)

  $rows = New-Object System.Collections.Generic.List[object]

  foreach ($entry in $Entries) {
    $obj = $entry.node
    if (-not ($obj.PSObject.Properties.Name -contains "CustomImage") -or -not $obj.CustomImage) {
      continue
    }

    $customTile = $null
    if ($obj.CustomImage.PSObject.Properties.Name -contains "CustomTile") {
      $customTile = $obj.CustomImage.CustomTile
    }

    $rows.Add([PSCustomObject]@{
      sourceName         = [string]$obj.Name
      sourcePath         = [string]$entry.sourcePath
      guid               = [string]$obj.GUID
      nickname           = [string]$obj.Nickname
      imageURL           = [string]$obj.CustomImage.ImageURL
      imageSecondaryURL  = [string]$obj.CustomImage.ImageSecondaryURL
      imageScalar        = [double]$obj.CustomImage.ImageScalar
      widthScale         = [double]$obj.CustomImage.WidthScale
      customTileType     = if ($customTile -and ($customTile.PSObject.Properties.Name -contains "Type")) { [int]$customTile.Type } else { $null }
      customTileThickness = if ($customTile -and ($customTile.PSObject.Properties.Name -contains "Thickness")) { [double]$customTile.Thickness } else { $null }
      customTileStackable = if ($customTile -and ($customTile.PSObject.Properties.Name -contains "Stackable")) { [bool]$customTile.Stackable } else { $null }
      customTileStretch   = if ($customTile -and ($customTile.PSObject.Properties.Name -contains "Stretch")) { [bool]$customTile.Stretch } else { $null }
    })
  }

  return $rows
}

function Get-TileTextureMap {
  param([System.Collections.Generic.List[object]]$Rows)

  $grouped = $Rows | Group-Object imageURL, imageSecondaryURL, imageScalar, widthScale, customTileType, customTileThickness, customTileStackable, customTileStretch | Sort-Object Name

  $mapped = New-Object System.Collections.Generic.List[object]
  foreach ($group in $grouped) {
    $sample = $group.Group | Select-Object -First 1
    $mapped.Add([PSCustomObject]@{
      imageURL            = $sample.imageURL
      imageSecondaryURL   = $sample.imageSecondaryURL
      imageScalar         = $sample.imageScalar
      widthScale          = $sample.widthScale
      customTileType      = $sample.customTileType
      customTileThickness = $sample.customTileThickness
      customTileStackable = $sample.customTileStackable
      customTileStretch   = $sample.customTileStretch
      occurrenceCount     = $group.Count
    })
  }

  return $mapped | Sort-Object imageURL, imageSecondaryURL
}

function Get-ModelRows {
  param([System.Collections.Generic.List[object]]$Entries)

  $rows = New-Object System.Collections.Generic.List[object]

  foreach ($entry in $Entries) {
    $obj = $entry.node
    if (-not ($obj.PSObject.Properties.Name -contains "CustomMesh") -or -not $obj.CustomMesh) {
      continue
    }

    $rows.Add([PSCustomObject]@{
      sourceName   = [string]$obj.Name
      sourcePath   = [string]$entry.sourcePath
      guid         = [string]$obj.GUID
      nickname     = [string]$obj.Nickname
      meshURL      = [string]$obj.CustomMesh.MeshURL
      diffuseURL   = [string]$obj.CustomMesh.DiffuseURL
      normalURL    = [string]$obj.CustomMesh.NormalURL
      colliderURL  = [string]$obj.CustomMesh.ColliderURL
      convex       = [bool]$obj.CustomMesh.Convex
      materialIndex = [int]$obj.CustomMesh.MaterialIndex
      typeIndex    = [int]$obj.CustomMesh.TypeIndex
      castShadows  = [bool]$obj.CustomMesh.CastShadows
    })
  }

  return $rows
}

function Get-ModelTextureMap {
  param([System.Collections.Generic.List[object]]$Rows)

  $grouped = $Rows | Group-Object meshURL, diffuseURL, normalURL, colliderURL, convex, materialIndex, typeIndex, castShadows | Sort-Object Name

  $mapped = New-Object System.Collections.Generic.List[object]
  foreach ($group in $grouped) {
    $sample = $group.Group | Select-Object -First 1
    $mapped.Add([PSCustomObject]@{
      meshURL       = $sample.meshURL
      diffuseURL    = $sample.diffuseURL
      normalURL     = $sample.normalURL
      colliderURL   = $sample.colliderURL
      convex        = $sample.convex
      materialIndex = $sample.materialIndex
      typeIndex     = $sample.typeIndex
      castShadows   = $sample.castShadows
      occurrenceCount = $group.Count
    })
  }

  return $mapped | Sort-Object meshURL, diffuseURL
}

function Get-UrlHash {
  param([string]$Url)

  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Url)
    $hashBytes = $sha1.ComputeHash($bytes)
    $hash = ([System.BitConverter]::ToString($hashBytes) -replace "-", "").ToLowerInvariant()
    return $hash.Substring(0, 12)
  } finally {
    $sha1.Dispose()
  }
}

function Get-UrlExtension {
  param([string]$Url)

  try {
    $uri = [System.Uri]$Url
    $ext = [System.IO.Path]::GetExtension($uri.AbsolutePath).ToLowerInvariant()
    if ($ext -in @(".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".avif")) {
      return $ext
    }
  } catch {
  }

  return $null
}

function Get-ExtensionFromContentType {
  param([string]$ContentType)

  if (-not $ContentType) {
    return $null
  }

  $ct = $ContentType.Split(";")[0].Trim().ToLowerInvariant()
  switch ($ct) {
    "image/jpeg" { return ".jpg" }
    "image/jpg" { return ".jpg" }
    "image/png" { return ".png" }
    "image/webp" { return ".webp" }
    "image/gif" { return ".gif" }
    "image/bmp" { return ".bmp" }
    "image/tiff" { return ".tif" }
    "image/avif" { return ".avif" }
    default { return $null }
  }
}

function Add-UrlsToKindMap {
  param(
    [hashtable]$ByUrl,
    [string[]]$Urls,
    [string]$Kind
  )

  foreach ($url in @($Urls)) {
    if ([string]::IsNullOrWhiteSpace($url)) {
      continue
    }

    if (-not $ByUrl.ContainsKey($url)) {
      $ByUrl[$url] = New-Object System.Collections.Generic.List[string]
    }
    if (-not $ByUrl[$url].Contains($Kind)) {
      $ByUrl[$url].Add($Kind)
    }
  }
}

function Get-DownloadEntriesByKind {
  param([hashtable]$UrlSetsByKind)

  $byUrl = @{}
  foreach ($kind in $UrlSetsByKind.Keys) {
    Add-UrlsToKindMap -ByUrl $byUrl -Urls @($UrlSetsByKind[$kind]) -Kind $kind
  }

  $entries = New-Object System.Collections.Generic.List[object]
  foreach ($url in ($byUrl.Keys | Sort-Object)) {
    $types = @($byUrl[$url] | Sort-Object)
    $entries.Add([PSCustomObject]@{
      url             = $url
      sourceTypes     = $types
      sourceTypeLabel = ($types -join "_")
    })
  }

  return $entries
}

function Invoke-DownloadManifest {
  param(
    [System.Collections.Generic.List[object]]$Entries,
    [string]$ResolvedImagesOutputDir,
    [int]$RetryCount,
    [int]$TimeoutSec
  )

  if (-not (Test-Path -LiteralPath $ResolvedImagesOutputDir)) {
    New-Item -ItemType Directory -Path $ResolvedImagesOutputDir -Force | Out-Null
  }

  $results = New-Object System.Collections.Generic.List[object]
  $index = 0

  foreach ($entry in $Entries) {
    $index++
    $url = [string]$entry.url
    $urlHash = Get-UrlHash -Url $url
    $sourceTypeLabel = [string]$entry.sourceTypeLabel

    $urlExt = Get-UrlExtension -Url $url
    $contentType = $null
    $fileSize = $null
    $status = "failed"
    $errorMessage = $null
    $attempts = 0
    $localPath = $null
    $fileName = $null

    $downloaded = $false
    while (-not $downloaded -and $attempts -le $RetryCount) {
      $attempts++
      $tmpPath = Join-Path -Path $ResolvedImagesOutputDir -ChildPath ("tmp_{0}_{1}.bin" -f $index, $urlHash)

      try {
        if (Test-Path -LiteralPath $tmpPath) {
          Remove-Item -LiteralPath $tmpPath -Force
        }

        $response = Invoke-WebRequest -Uri $url -OutFile $tmpPath -TimeoutSec $TimeoutSec -UseBasicParsing
        if ($response -and $response.Headers) {
          $contentType = [string]$response.Headers["Content-Type"]
        }

        $contentExt = Get-ExtensionFromContentType -ContentType $contentType
        $finalExt = $urlExt
        if (-not $finalExt) {
          $finalExt = $contentExt
        }
        if (-not $finalExt) {
          $finalExt = ".bin"
        }

        $fileName = "{0}_{1}{2}" -f $sourceTypeLabel, $urlHash, $finalExt
        $localPath = Join-Path -Path $ResolvedImagesOutputDir -ChildPath $fileName

        Move-Item -LiteralPath $tmpPath -Destination $localPath -Force
        $fileSize = (Get-Item -LiteralPath $localPath).Length
        $status = "success"
        $downloaded = $true
      } catch {
        $errorMessage = $_.Exception.Message
        if ($attempts -le $RetryCount) {
          Start-Sleep -Seconds ([Math]::Min(2 * $attempts, 6))
        }
      } finally {
        if (Test-Path -LiteralPath $tmpPath) {
          Remove-Item -LiteralPath $tmpPath -Force
        }
      }
    }

    if (-not $fileName) {
      $fallbackExt = $urlExt
      if (-not $fallbackExt) {
        $fallbackExt = ".bin"
      }
      $fileName = "{0}_{1}{2}" -f $sourceTypeLabel, $urlHash, $fallbackExt
    }

    if (-not $localPath) {
      $localPath = Join-Path -Path $ResolvedImagesOutputDir -ChildPath $fileName
    }

    $results.Add([PSCustomObject]@{
      url         = $url
      sourceTypes = $entry.sourceTypes
      status      = $status
      attempts    = $attempts
      localPath   = $localPath
      fileName    = $fileName
      byteSize    = $fileSize
      contentType = $contentType
      error       = $errorMessage
    })
  }

  $succeededCount = @($results | Where-Object { $_.status -eq "success" }).Count
  $failedCount = $results.Count - $succeededCount

  return [PSCustomObject]@{
    enabled         = $true
    imagesOutputDir = $ResolvedImagesOutputDir
    requestedCount  = $results.Count
    succeededCount  = $succeededCount
    failedCount     = $failedCount
    files           = $results
  }
}

$resolvedSourcePath = Resolve-SourceFile -Path $SourcePath
$resolvedOutputPath = Build-OutputPath -ResolvedSourcePath $resolvedSourcePath -ExplicitOutputPath $OutputPath

$raw = Get-Content -LiteralPath $resolvedSourcePath -Raw -Encoding UTF8
$json = $raw | ConvertFrom-Json

if (-not ($json.PSObject.Properties.Name -contains "ObjectStates") -or -not $json.ObjectStates) {
  throw "Invalid TTS JSON: missing ObjectStates in $resolvedSourcePath"
}

$entries = Get-TtsObjects -RootJson $json -IncludeStates ([bool]$IncludeStates)
$deckRows = Get-DeckRows -Entries $entries
$deckMap = Get-DeckTextureMap -Rows $deckRows

$uniqueFaceURLs = @($deckMap.faceURL | Where-Object { $_ } | Sort-Object -Unique)
$uniqueBackURLs = @($deckMap.backURL | Where-Object { $_ } | Sort-Object -Unique)

$summary = [ordered]@{
  objectStatesCount     = $json.ObjectStates.Count
  traversedObjectCount  = $entries.Count
  includeStates         = [bool]$IncludeStates
  customDeckRows        = $deckRows.Count
  uniqueDeckTextureDefs = $deckMap.Count
  uniqueFaceURLCount    = $uniqueFaceURLs.Count
  uniqueBackURLCount    = $uniqueBackURLs.Count
}

$outputData = [ordered]@{
  sourceFile     = $resolvedSourcePath
  generatedAtUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  summary        = [PSCustomObject]$summary
  uniqueFaceURLs = $uniqueFaceURLs
  uniqueBackURLs = $uniqueBackURLs
  deckTextureMap = $deckMap
}

$tileRows = @()
$tileMap = @()
$uniqueTileImageURLs = @()
$uniqueTileSecondaryURLs = @()

if ($IncludeTiles) {
  $tileRows = @(Get-TileRows -Entries $entries)
  $tileMap = @(Get-TileTextureMap -Rows $tileRows)
  $uniqueTileImageURLs = @($tileRows | ForEach-Object imageURL | Where-Object { $_ } | Sort-Object -Unique)
  $uniqueTileSecondaryURLs = @($tileRows | ForEach-Object imageSecondaryURL | Where-Object { $_ } | Sort-Object -Unique)

  $outputData["uniqueTileImageURLs"] = $uniqueTileImageURLs
  $outputData["uniqueTileSecondaryURLs"] = $uniqueTileSecondaryURLs
  $outputData["tileImageMap"] = $tileMap

  $summary["customImageRows"] = $tileRows.Count
  $summary["uniqueTileTextureDefs"] = $tileMap.Count
  $summary["uniqueTileImageURLCount"] = $uniqueTileImageURLs.Count
  $summary["uniqueTileSecondaryURLCount"] = $uniqueTileSecondaryURLs.Count
}

$modelRows = @()
$modelMap = @()
$uniqueModelMeshURLs = @()
$uniqueModelDiffuseURLs = @()
$uniqueModelNormalURLs = @()
$uniqueModelColliderURLs = @()

if ($IncludeModels) {
  $modelRows = @(Get-ModelRows -Entries $entries)
  $modelMap = @(Get-ModelTextureMap -Rows $modelRows)
  $uniqueModelMeshURLs = @($modelRows | ForEach-Object meshURL | Where-Object { $_ } | Sort-Object -Unique)
  $uniqueModelDiffuseURLs = @($modelRows | ForEach-Object diffuseURL | Where-Object { $_ } | Sort-Object -Unique)
  $uniqueModelNormalURLs = @($modelRows | ForEach-Object normalURL | Where-Object { $_ } | Sort-Object -Unique)
  $uniqueModelColliderURLs = @($modelRows | ForEach-Object colliderURL | Where-Object { $_ } | Sort-Object -Unique)

  $outputData["uniqueModelMeshURLs"] = $uniqueModelMeshURLs
  $outputData["uniqueModelDiffuseURLs"] = $uniqueModelDiffuseURLs
  $outputData["uniqueModelNormalURLs"] = $uniqueModelNormalURLs
  $outputData["uniqueModelColliderURLs"] = $uniqueModelColliderURLs
  $outputData["modelMeshMap"] = $modelMap

  $summary["customMeshRows"] = $modelRows.Count
  $summary["uniqueModelMeshDefs"] = $modelMap.Count
  $summary["uniqueModelMeshURLCount"] = $uniqueModelMeshURLs.Count
  $summary["uniqueModelDiffuseURLCount"] = $uniqueModelDiffuseURLs.Count
  $summary["uniqueModelNormalURLCount"] = $uniqueModelNormalURLs.Count
  $summary["uniqueModelColliderURLCount"] = $uniqueModelColliderURLs.Count
}

$outputData["summary"] = [PSCustomObject]$summary
$output = [PSCustomObject]$outputData

if ($DownloadImages) {
  $urlSetsByKind = @{}
  $urlSetsByKind["card_face"] = $uniqueFaceURLs
  $urlSetsByKind["card_back"] = $uniqueBackURLs

  if ($IncludeTiles) {
    $urlSetsByKind["tile_primary"] = $uniqueTileImageURLs
    $urlSetsByKind["tile_secondary"] = $uniqueTileSecondaryURLs
  }

  if ($IncludeModels) {
    $urlSetsByKind["model_mesh"] = $uniqueModelMeshURLs
    $urlSetsByKind["model_diffuse"] = $uniqueModelDiffuseURLs
    $urlSetsByKind["model_normal"] = $uniqueModelNormalURLs
    $urlSetsByKind["model_collider"] = $uniqueModelColliderURLs
  }

  $downloadEntries = Get-DownloadEntriesByKind -UrlSetsByKind $urlSetsByKind
  $resolvedImagesOutputDir = Build-ImagesOutputDir -ResolvedSourcePath $resolvedSourcePath -ExplicitImagesOutputDir $ImagesOutputDir
  $downloadResult = Invoke-DownloadManifest -Entries $downloadEntries -ResolvedImagesOutputDir $resolvedImagesOutputDir -RetryCount $RetryCount -TimeoutSec $TimeoutSec
  $output | Add-Member -NotePropertyName "download" -NotePropertyValue $downloadResult
}

$outputDir = Split-Path -Parent $resolvedOutputPath
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$output | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $resolvedOutputPath -Encoding UTF8

Write-Output "Wrote: $resolvedOutputPath"
Write-Output ("Summary: customDeckRows={0}, uniqueDeckTextureDefs={1}, uniqueFaceURLCount={2}, uniqueBackURLCount={3}, includeStates={4}" -f `
  $deckRows.Count, $deckMap.Count, $uniqueFaceURLs.Count, $uniqueBackURLs.Count, [bool]$IncludeStates)

if ($IncludeTiles) {
  Write-Output ("Tiles: customImageRows={0}, uniqueTileTextureDefs={1}, uniqueTileImageURLCount={2}, uniqueTileSecondaryURLCount={3}" -f `
    $tileRows.Count, $tileMap.Count, $uniqueTileImageURLs.Count, $uniqueTileSecondaryURLs.Count)
}

if ($IncludeModels) {
  Write-Output ("Models: customMeshRows={0}, uniqueModelMeshDefs={1}, mesh/diffuse/normal/collider URLs={2}/{3}/{4}/{5}" -f `
    $modelRows.Count, $modelMap.Count, $uniqueModelMeshURLs.Count, $uniqueModelDiffuseURLs.Count, $uniqueModelNormalURLs.Count, $uniqueModelColliderURLs.Count)
}

if ($DownloadImages) {
  Write-Output ("Downloaded: requested={0}, succeeded={1}, failed={2}, dir={3}" -f `
    $output.download.requestedCount, $output.download.succeededCount, $output.download.failedCount, $output.download.imagesOutputDir)
}
