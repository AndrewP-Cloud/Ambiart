param(
  [string]$AmbiartUrl = "http://127.0.0.1:8787",
  [string]$Adb = "adb",
  [string]$Device = "",
  [string]$Orientation = "landscape",
  [int]$Width = 3840,
  [string]$RemotePath = "/sdcard/Pictures/Ambiart/nga-wallpaper.jpg"
)

$ErrorActionPreference = "Stop"

function Invoke-Adb {
  $adbArgs = $args

  if ($Device) {
    & $Adb -s $Device @adbArgs
  } else {
    & $Adb @adbArgs
  }

  if ($LASTEXITCODE -ne 0) {
    throw "adb command failed: $($adbArgs -join ' ')"
  }
}

$downloadUri = "$AmbiartUrl/v1/nga/wallpapers/random.jpg?orientation=$Orientation&width=$Width"
$localPath = Join-Path $env:TEMP "ambiart-nga-wallpaper.jpg"

Write-Host "Downloading NGA wallpaper from $downloadUri"
Invoke-WebRequest -Uri $downloadUri -OutFile $localPath -MaximumRedirection 5

Write-Host "Preparing Android TV folder"
Invoke-Adb "shell" "mkdir" "-p" "/sdcard/Pictures/Ambiart"

Write-Host "Pushing wallpaper to $RemotePath"
Invoke-Adb "push" $localPath $RemotePath

Write-Host "Refreshing Android media index"
Invoke-Adb "shell" "am" "broadcast" "-a" "android.intent.action.MEDIA_SCANNER_SCAN_FILE" "-d" "file://$RemotePath"

Write-Host "Trying Android wallpaper service"
try {
  Invoke-Adb "shell" "cmd" "wallpaper" "set-image" $RemotePath
  Write-Host "Wallpaper set through Android wallpaper service."
} catch {
  Write-Warning "Android did not accept 'cmd wallpaper set-image'. The image is on the streamer at $RemotePath."
  Write-Warning "Open Projectivy or Android wallpaper settings and select the Ambiart image from Pictures/Ambiart."
}

Write-Host "Done."
