import crypto from 'node:crypto';
import { md5 } from '../src/services/hikvisionIsapiService.ts';

const input = 'admin:DS-K1T8003MF:Control.1';
const expected = crypto.createHash('md5').update(input).digest('hex');
const actual = md5(input);

console.log('Input:', input);
console.log('Expected (crypto):', expected);
console.log('Actual (md5):      ', actual);
console.log('Match?:', expected === actual);
