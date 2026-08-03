import fs from 'fs';

const extractedLogs = JSON.parse(fs.readFileSync('./src/data/extractedBiometricLogs.json', 'utf-8'));

const REAL_BIOMETRIC_USERS = [
  { employeeNo: '1000', name: 'Jaime' },
  { employeeNo: '2', name: 'Yei' },
  { employeeNo: '3', name: 'Moni' },
  { employeeNo: '4', name: 'Jhon' },
  { employeeNo: '5', name: 'Luis' },
  { employeeNo: '6', name: 'Fernanda' },
  { employeeNo: '8', name: 'Jose' },
  { employeeNo: '9', name: 'Jaider' },
  { employeeNo: '10', name: 'Yisela' },
  { employeeNo: '11', name: 'Yesica' },
  { employeeNo: '12', name: 'Valentina' },
  { employeeNo: '13', name: 'Lorena' },
  { employeeNo: '14', name: 'Kevin' },
  { employeeNo: '15', name: 'Fernando' },
  { employeeNo: '16', name: 'Felipe' },
  { employeeNo: '17', name: 'Miller' },
  { employeeNo: '18', name: 'Laura' },
  { employeeNo: '19', name: 'Leo' },
  { employeeNo: '20', name: 'Johana' },
  { employeeNo: '21', name: 'Eduwin' },
  { employeeNo: '22', name: 'Cristian' },
  { employeeNo: '23', name: 'Esteban' },
  { employeeNo: '24', name: 'Arlin' },
  { employeeNo: '25', name: 'Hugo' },
  { employeeNo: '27', name: 'Juli' },
  { employeeNo: '28', name: 'Yeimy' },
  { employeeNo: '29', name: 'Sandra Q' },
  { employeeNo: '30', name: 'Duber' },
  { employeeNo: '31', name: 'Nelcy' },
  { employeeNo: '32', name: 'Jime' },
  { employeeNo: '33', name: 'Leidy' },
  { employeeNo: '34', name: 'Sandra Paladinez' },
  { employeeNo: '35', name: 'Argenis' },
  { employeeNo: '36', name: 'Napo' },
  { employeeNo: '37', name: 'Javier' },
  { employeeNo: '38', name: 'Edilma' },
  { employeeNo: '39', name: 'Maye' },
  { employeeNo: '40', name: 'Brigith' },
  { employeeNo: '41', name: 'Vic' }
];

const empMap = new Map();
REAL_BIOMETRIC_USERS.forEach(u => empMap.set(u.employeeNo, u.name));

const todayStr = '2026-08-03';
const todayLogs = extractedLogs.filter(l => (l.timestamp || '').startsWith(todayStr));

console.log(`=== INGRESOS REGISTRADOS HOY (${todayStr}) ===`);
if (todayLogs.length === 0) {
  console.log('No hay marcaciones de ingreso registadas aún para hoy.');
} else {
  todayLogs.forEach(l => {
    const name = empMap.get(l.employeeNo) || `Empleado #${l.employeeNo}`;
    const time = l.timestamp.slice(11, 19);
    console.log(`- #${l.employeeNo} ${name}: Marcación a las ${time} (${l.type})`);
  });
}
