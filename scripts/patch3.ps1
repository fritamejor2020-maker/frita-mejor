$file = 'C:\Users\GIGABYTE\.gemini\antigravity\scratch\frita_mejor\src\components\admin\AdminFinancesTab.tsx'
$lines = [System.IO.File]::ReadAllLines($file)  # reads stripping line endings

$result = New-Object System.Collections.Generic.List[string]
$i = 0
while ($i -lt $lines.Count) {
    $line = $lines[$i]
    # Detect the empty anotador block (line with only the && opening)
    if ($line.TrimEnd() -eq '                           {(closing as any).anotadorName && (' -and
        $i+1 -lt $lines.Count -and $lines[$i+1].TrimEnd() -eq '                           )}') {
        $result.Add('                           {(closing as any).anotadorName && (')
        $result.Add('                             <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">Anotador: {(closing as any).anotadorName}</span>')
        $result.Add('                           )}')
        $i += 2
    } elseif ($line.TrimEnd() -eq '                           {(closing as any).dejadorName && (' -and
              $i+1 -lt $lines.Count -and $lines[$i+1].TrimEnd() -eq '                           )}') {
        $result.Add('                           {(closing as any).dejadorName && (')
        $result.Add('                             <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">Dejador: {(closing as any).dejadorName}</span>')
        $result.Add('                           )}')
        $i += 2
    } else {
        $result.Add($line)
        $i++
    }
}

$encoding = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($file, $result, $encoding)
Write-Host "Done: $($result.Count) lines written"
