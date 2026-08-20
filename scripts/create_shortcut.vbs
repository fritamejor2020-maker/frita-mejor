Set WshShell = CreateObject("WScript.Shell")
Set shortcut = WshShell.CreateShortcut("C:\Users\GIGABYTE\Documents\Frita App\Frita Mejor POS.lnk")
shortcut.TargetPath = "C:\Users\GIGABYTE\Documents\Frita App\build-out\win-unpacked\Frita Mejor POS.exe"
shortcut.WorkingDirectory = "C:\Users\GIGABYTE\Documents\Frita App\build-out\win-unpacked"
shortcut.Description = "Frita Mejor POS y Control de Asistencias"
shortcut.Save
