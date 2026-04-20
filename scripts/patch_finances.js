const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\GIGABYTE\\.gemini\\antigravity\\scratch\\frita_mejor\\src\\components\\admin\\AdminFinancesTab.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the closing row div
const oldBlock = `                    <div>\r\n                       <div className="flex items-center gap-2">\r\n                         <span className="font-black text-gray-800 text-base">{closing.pointName}</span>\r\n                         {closing.pointLabel && (\r\n                           <span className="bg-red-50 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">{closing.pointLabel}</span>\r\n                         )}\r\n                         <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">{closing.shift}</span>\r\n                       </div>\r\n                       <p className="text-xs text-gray-400 font-bold mt-0.5">{closing.date}</p>\r\n                     </div>`;

const newBlock = `                    <div>\r\n                       <div className="flex items-center gap-2">\r\n                         <span className="font-black text-gray-800 text-base">{closing.pointName}</span>\r\n                         {closing.pointLabel && (\r\n                           <span className="bg-red-50 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">{closing.pointLabel}</span>\r\n                         )}\r\n                         <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">{closing.shift}</span>\r\n                         {(closing as any).type === 'DEJADOR' && (\r\n                           <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">DEJADOR</span>\r\n                         )}\r\n                       </div>\r\n                       <p className="text-xs text-gray-400 font-bold mt-0.5">{closing.date}</p>\r\n                       {(closing as any).type === 'DEJADOR' && ((closing as any).anotadorName || (closing as any).dejadorName) && (\r\n                         <div className="flex flex-wrap gap-1.5 mt-1.5">\r\n                           {(closing as any).anotadorName && (\r\n                             <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">\u{1F4CB} {(closing as any).anotadorName}</span>\r\n                           )}\r\n                           {(closing as any).dejadorName && (\r\n                             <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">\u{1F6F5} {(closing as any).dejadorName}</span>\r\n                           )}\r\n                         </div>\r\n                       )}\r\n                     </div>`;

if (!content.includes(oldBlock)) {
  console.error('Block NOT FOUND. Check line endings or whitespace.');
  process.exit(1);
}

content = content.replace(oldBlock, newBlock);
fs.writeFileSync(filePath, content, 'utf8');
console.log('OK - AdminFinancesTab.tsx updated successfully');
