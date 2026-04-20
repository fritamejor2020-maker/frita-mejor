$file = 'C:\Users\GIGABYTE\.gemini\antigravity\scratch\frita_mejor\src\components\admin\AdminFinancesTab.tsx'
$lines = [System.IO.File]::ReadAllLines($file)
$newLines = New-Object System.Collections.Generic.List[string]

for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($i -eq 271) {
    $newLines.Add('                    <div>')
    $newLines.Add('                       <div className="flex items-center gap-2">')
    $newLines.Add('                         <span className="font-black text-gray-800 text-base">{closing.pointName}</span>')
    $newLines.Add('                         {closing.pointLabel && (')
    $newLines.Add('                           <span className="bg-red-50 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">{closing.pointLabel}</span>')
    $newLines.Add('                         )}')
    $newLines.Add('                         <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">{closing.shift}</span>')
    $newLines.Add("                         {(closing as any).type === 'DEJADOR' && (")
    $newLines.Add('                           <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">DEJADOR</span>')
    $newLines.Add('                         )}')
    $newLines.Add('                       </div>')
    $newLines.Add('                       <p className="text-xs text-gray-400 font-bold mt-0.5">{closing.date}</p>')
    $newLines.Add("                       {(closing as any).type === 'DEJADOR' && ((closing as any).anotadorName || (closing as any).dejadorName) && (")
    $newLines.Add('                         <div className="flex flex-wrap gap-1.5 mt-1.5">')
    $newLines.Add('                           {(closing as any).anotadorName && (')
    $newLines.Add('                             <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">' + [char]0x1F4CB + ' {(closing as any).anotadorName}</span>')
    $newLines.Add('                           )}')
    $newLines.Add('                           {(closing as any).dejadorName && (')
    $newLines.Add('                             <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">' + [char]0x1F6F5 + ' {(closing as any).dejadorName}</span>')
    $newLines.Add('                           )}')
    $newLines.Add('                         </div>')
    $newLines.Add('                       )}')
    $newLines.Add('                     </div>')
    $i = 280  # skip original lines 272-281 (0-indexed 271-280)
  } else {
    $newLines.Add($lines[$i])
  }
}

[System.IO.File]::WriteAllLines($file, $newLines, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done - AdminFinancesTab updated"
