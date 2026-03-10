$shell       = New-Object -ComObject WScript.Shell
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcut    = $shell.CreateShortcut("$desktopPath\TERMIDIU.lnk")

$shortcut.TargetPath       = "D:\DEVS\TERMIDIU\dist\win-unpacked\TERMIDIU.exe"
$shortcut.WorkingDirectory = "D:\DEVS\TERMIDIU\dist\win-unpacked"
$shortcut.IconLocation     = "D:\DEVS\TERMIDIU\resources\icon.ico"
$shortcut.Description      = "TERMIDIU"
$shortcut.Save()

Write-Host "Shortcut updated on Desktop -> dist\win-unpacked\TERMIDIU.exe"
Write-Host "Right-click it -> 'Pin to taskbar'"
