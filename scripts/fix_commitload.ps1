$file = 'C:\Users\GIGABYTE\.gemini\antigravity\scratch\frita_mejor\src\store\useLogisticsStore.js'
$content = [System.IO.File]::ReadAllText($file)

# Fix commitLoad: replace the set(state=>) + syncKey([entry, ...get()]) pattern with a single newHistory variable
$old = "    set(state => ({ loadHistory: [entry, ...state.loadHistory] }));`r`n    syncKey('loadHistory', [entry, ...get().loadHistory]);"
$new = "    const newHistory = [entry, ...get().loadHistory];`r`n    set({ loadHistory: newHistory });`r`n    syncKey('loadHistory', newHistory);"

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText($file, $content, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "Fixed commitLoad double-insert bug"
} else {
    Write-Host "Pattern not found, checking alternative..."
    # Try with LF only
    $old2 = "    set(state => ({ loadHistory: [entry, ...state.loadHistory] }));`n    syncKey('loadHistory', [entry, ...get().loadHistory]);"
    if ($content.Contains($old2)) {
        $new2 = "    const newHistory = [entry, ...get().loadHistory];`n    set({ loadHistory: newHistory });`n    syncKey('loadHistory', newHistory);"
        $content = $content.Replace($old2, $new2)
        [System.IO.File]::WriteAllText($file, $content, (New-Object System.Text.UTF8Encoding $false))
        Write-Host "Fixed with LF variant"
    } else {
        Write-Host "ERROR: Could not find pattern to replace"
        # Show the relevant lines
        $lines = $content -split "`n"
        for ($i = 144; $i -lt [Math]::Min(154, $lines.Count); $i++) {
            Write-Host "Line $($i+1): $($lines[$i])"
        }
    }
}
