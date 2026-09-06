Add-Type -AssemblyName System.Drawing

function New-Icon($size, $path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)

  # rounded rounded-square background
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
  $r = $size * 0.22
  $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $path2.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
  $path2.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
  $path2.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
  $path2.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
  $path2.CloseFigure()
  $g.FillPath($brush, $path2)

  # white "check" glyph (fill mark)
  $pen = New-Object System.Drawing.Pen -ArgumentList @([System.Drawing.Color]::White, [float]($size * 0.14))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $x0 = $size * 0.28; $y0 = $size * 0.52
  $x1 = $size * 0.44; $y1 = $size * 0.66
  $x2 = $size * 0.74; $y2 = $size * 0.34
  $g.DrawLine($pen, $x0, $y0, $x1, $y1)
  $g.DrawLine($pen, $x1, $y1, $x2, $y2)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-Icon 16 "icons/icon16.png"
New-Icon 48 "icons/icon48.png"
New-Icon 128 "icons/icon128.png"
Write-Output "icons done"