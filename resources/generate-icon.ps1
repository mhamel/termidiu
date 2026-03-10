Add-Type -AssemblyName System.Drawing

$outDir = $PSScriptRoot

# Draw the icon at a given size, return Bitmap
function New-IconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode   = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  # Background
  $bg = [System.Drawing.Color]::FromArgb(255, 10, 14, 23)
  $g.FillRectangle([System.Drawing.SolidBrush]::new($bg), 0, 0, $size, $size)

  # ">_" centered in accent blue
  $fg       = [System.Drawing.Color]::FromArgb(255, 0, 150, 230)
  $fontSize = [float]($size * 0.36)
  $font     = New-Object System.Drawing.Font("Consolas", $fontSize, [System.Drawing.FontStyle]::Bold)
  $brush    = [System.Drawing.SolidBrush]::new($fg)
  $sf       = New-Object System.Drawing.StringFormat
  $sf.Alignment     = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = [System.Drawing.RectangleF]::new(0, 0, $size, $size)
  $g.DrawString(">_", $font, $brush, $rect, $sf)

  $g.Dispose()
  return $bmp
}

# Save as PNG (used by Electron in dev)
$bmp256 = New-IconBitmap 256
$bmp256.Save((Join-Path $outDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved icon.png"

# Pack into ICO: modern Windows accepts PNG inside ICO (Vista+)
# ICO format: 6-byte header + 16-byte dir entry per image + PNG bytes
$sizes = @(16, 32, 48, 256)
$pngStreams = @()
foreach ($s in $sizes) {
  $b  = New-IconBitmap $s
  $ms = New-Object System.IO.MemoryStream
  $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngStreams += $ms
  $b.Dispose()
}

$icoPath   = Join-Path $outDir "icon.ico"
$icoStream = [System.IO.File]::Create($icoPath)
$writer    = New-Object System.IO.BinaryWriter($icoStream)

$count  = $sizes.Count
$headerSize = 6
$dirSize    = 16 * $count
$offset     = $headerSize + $dirSize

# Header
$writer.Write([uint16]0)       # reserved
$writer.Write([uint16]1)       # type = ICO
$writer.Write([uint16]$count)  # image count

# Directory entries
foreach ($i in 0..($count - 1)) {
  $s    = $sizes[$i]
  $w    = if ($s -eq 256) { 0 } else { $s }
  $h    = if ($s -eq 256) { 0 } else { $s }
  $data = $pngStreams[$i].ToArray()

  $writer.Write([byte]$w)        # width
  $writer.Write([byte]$h)        # height
  $writer.Write([byte]0)         # colorCount
  $writer.Write([byte]0)         # reserved
  $writer.Write([uint16]1)       # planes
  $writer.Write([uint16]32)      # bitCount
  $writer.Write([uint32]$data.Length)
  $writer.Write([uint32]$offset)
  $offset += $data.Length
}

# Image data
foreach ($ms in $pngStreams) {
  $writer.Write($ms.ToArray())
  $ms.Dispose()
}

$writer.Dispose()
$icoStream.Dispose()
Write-Host "Saved icon.ico with $count sizes: $($sizes -join ', ')px"
