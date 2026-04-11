$file = 'C:\Users\GIGABYTE\.gemini\antigravity\scratch\frita_mejor\src\components\admin\AdminFinancesTab.tsx'
$content = Get-Content $file -Raw -Encoding UTF8

$old = "                            {(closing as any).anotadorName && (`r`n                            )}`r`n                            {(closing as any).dejadorName && (`r`n                            )}"
$oldLF = "                            {(closing as any).anotadorName && (`n                            )}`n                            {(closing as any).dejadorName && (`n                            )}"

$new = "                            {(closing as any).anotadorName && (`n                              <span className=""inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full"">'\u{1F4CB}' {(closing as any).anotadorName}</span>`n                            )}`n                            {(closing as any).dejadorName && (`n                              <span className=""inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full"">'\u{1F6F5}' {(closing as any).dejadorName}</span>`n                            )}"

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    Write-Host "Replaced CRLF version"
} elseif ($content.Contains($oldLF)) {
    $content = $content.Replace($oldLF, $new)
    Write-Host "Replaced LF version"
} else {
    Write-Host "NOT FOUND - checking surrounding"
    $idx = $content.IndexOf("anotadorName && (")
    Write-Host "Found at index: $idx"
    Write-Host $content.Substring([Math]::Max(0,$idx-20), [Math]::Min(200, $content.Length-$idx+20))
}

[System.IO.File]::WriteAllText($file, $content, (New-Object System.Text.UTF8Encoding $false))
