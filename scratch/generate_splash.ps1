Add-Type -AssemblyName System.Drawing

$resBase = "c:\Users\danie\OneDrive\Desktop\Trabajo\wala-master\android\app\src\main\res"

# Load original high-res splash to extract the logo
$logoPath = "$resBase\drawable-port-xxxhdpi\splash.png"
$logoOriginal = [System.Drawing.Bitmap]::new($logoPath)

# Extract only the white parts of the logo (the W, tag shape, WALÁ text are white in the original)
# The original logo is: purple circle bg + white icon elements on top
# We want: just the white elements as white on transparent background
$logoCopy = [System.Drawing.Bitmap]::new($logoOriginal)

for ($x = 0; $x -lt $logoCopy.Width; $x++) {
    for ($y = 0; $y -lt $logoCopy.Height; $y++) {
        $pixel = $logoCopy.GetPixel($x, $y)
        # Check if pixel is white or near-white (the icon elements)
        if ($pixel.R -gt 230 -and $pixel.G -gt 230 -and $pixel.B -gt 230) {
            # Keep as fully transparent (this is the background)
            $logoCopy.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        } else {
            # Non-white pixels = the logo elements. Make them white with appropriate alpha
            # Calculate luminance to determine opacity
            $brightness = (0.299 * $pixel.R + 0.587 * $pixel.G + 0.114 * $pixel.B) / 255.0
            $alpha = [int]((1 - $brightness) * 255)
            $alpha = [Math]::Max(0, [Math]::Min(255, $alpha))
            
            if ($alpha -lt 20) {
                $logoCopy.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
            } else {
                $logoCopy.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
            }
        }
    }
}

# Crop to bounding box
$minX = $logoCopy.Width; $minY = $logoCopy.Height; $maxX = 0; $maxY = 0
for ($x = 0; $x -lt $logoCopy.Width; $x++) {
    for ($y = 0; $y -lt $logoCopy.Height; $y++) {
        $pixel = $logoCopy.GetPixel($x, $y)
        if ($pixel.A -gt 20) {
            if ($x -lt $minX) { $minX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

$pad = 10
$minX = [Math]::Max(0, $minX - $pad)
$minY = [Math]::Max(0, $minY - $pad)
$maxX = [Math]::Min($logoCopy.Width - 1, $maxX + $pad)
$maxY = [Math]::Min($logoCopy.Height - 1, $maxY + $pad)

$cropW = $maxX - $minX + 1
$cropH = $maxY - $minY + 1
$cropRect = New-Object System.Drawing.Rectangle($minX, $minY, $cropW, $cropH)
$croppedLogo = $logoCopy.Clone($cropRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

Write-Host "Logo cropped to white elements: $cropW x $cropH"

$logoCopy.Dispose()
$logoOriginal.Dispose()

# Define all targets
$targets = @{
    "drawable"                      = @(320, 480)
    "drawable-port-ldpi"            = @(240, 320)
    "drawable-port-mdpi"            = @(320, 480)
    "drawable-port-hdpi"            = @(480, 800)
    "drawable-port-xhdpi"           = @(720, 1280)
    "drawable-port-xxhdpi"          = @(960, 1600)
    "drawable-port-xxxhdpi"         = @(1280, 1920)
    "drawable-land-ldpi"            = @(320, 240)
    "drawable-land-mdpi"            = @(480, 320)
    "drawable-land-hdpi"            = @(800, 480)
    "drawable-land-xhdpi"           = @(1280, 720)
    "drawable-land-xxhdpi"          = @(1600, 960)
    "drawable-land-xxxhdpi"         = @(1920, 1280)
    "drawable-night"                = @(320, 240)
    "drawable-xxhdpi"               = @(960, 1600)
    "drawable-port-night-ldpi"      = @(240, 320)
    "drawable-port-night-mdpi"      = @(320, 480)
    "drawable-port-night-hdpi"      = @(480, 800)
    "drawable-port-night-xhdpi"     = @(720, 1280)
    "drawable-port-night-xxhdpi"    = @(960, 1600)
    "drawable-port-night-xxxhdpi"   = @(1280, 1920)
    "drawable-land-night-ldpi"      = @(320, 240)
    "drawable-land-night-mdpi"      = @(480, 320)
    "drawable-land-night-hdpi"      = @(800, 480)
    "drawable-land-night-xhdpi"     = @(1280, 720)
    "drawable-land-night-xxhdpi"    = @(1600, 960)
    "drawable-land-night-xxxhdpi"   = @(1920, 1280)
}

foreach ($folder in $targets.Keys) {
    $w = $targets[$folder][0]
    $h = $targets[$folder][1]
    
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # Draw gradient background
    $color1 = [System.Drawing.Color]::FromArgb(255, 139, 92, 246)
    $color2 = [System.Drawing.Color]::FromArgb(255, 91, 33, 182)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $color1, $color2, [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
    $g.FillRectangle($brush, $rect)
    
    # Logo size: 30% of smallest dimension
    $minDim = [Math]::Min($w, $h)
    $logoSize = [int]($minDim * 0.35)
    
    $logoAspect = $croppedLogo.Width / $croppedLogo.Height
    if ($logoAspect -gt 1) {
        $drawW = $logoSize
        $drawH = [int]($logoSize / $logoAspect)
    } else {
        $drawH = $logoSize
        $drawW = [int]($logoSize * $logoAspect)
    }
    
    $logoX = [int](($w - $drawW) / 2)
    $logoY = [int](($h - $drawH) / 2)
    
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $g.DrawImage($croppedLogo, $logoX, $logoY, $drawW, $drawH)
    
    $g.Dispose()
    $brush.Dispose()
    
    $outDir = "$resBase\$folder"
    if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
    $outPath = "$outDir\splash.png"
    
    try {
        $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "OK: $folder ($w x $h)"
    } catch {
        $tmpPath = "$outDir\splash_new.png"
        $bmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
        Remove-Item $outPath -Force -ErrorAction SilentlyContinue
        Rename-Item $tmpPath "splash.png"
        Write-Host "OK (via temp): $folder ($w x $h)"
    }
    
    $bmp.Dispose()
}

$croppedLogo.Dispose()
Write-Host "`nAll splash screens generated!"
