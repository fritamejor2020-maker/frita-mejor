$file = 'C:\Users\GIGABYTE\.gemini\antigravity\scratch\frita_mejor\src\components\admin\AdminFinancesTab.tsx'
$lines = [System.IO.File]::ReadAllLines($file)
# Keep lines 1..947 (0-indexed: 0..946) and lines from the AdminIncomesTab export onwards
# Find where AdminIncomesTab starts
$incomesLine = -1
for ($i = 947; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'export const AdminIncomesTab') {
        $incomesLine = $i
        break
    }
}
Write-Host "AdminIncomesTab found at line (0-indexed): $incomesLine"

if ($incomesLine -gt 0) {
    # Build new content: keep up to line 946 (0-indexed), then the closing </div> and ); for the return, then AdminIncomesTab onwards
    $result = [System.Collections.Generic.List[string]]::new()
    for ($i = 0; $i -le 946; $i++) {
        $result.Add($lines[$i])
    }
    # Add the proper closing of the AdminFinancesTab component
    $result.Add('  );')
    $result.Add('};')
    $result.Add('')
    # Add from AdminIncomesTab onwards
    for ($i = $incomesLine; $i -lt $lines.Count; $i++) {
        $result.Add($lines[$i])
    }
    [System.IO.File]::WriteAllLines($file, $result, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "Done. New line count: $($result.Count)"
} else {
    Write-Host "ERROR: AdminIncomesTab not found"
}
