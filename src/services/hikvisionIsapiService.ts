/**
 * Servicio Hikvision ISAPI - Extracción Completa de Biométrico DS-K1T8003MF
 * Autenticación HTTP Digest (RFC 2617) nativa, búsqueda paginada de Usuarios y AcsEvents.
 */

export interface HikvisionDeviceConfig {
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  timeoutMs?: number;
}

export const DEFAULT_DEVICE_CONFIG: HikvisionDeviceConfig = {
  ipAddress: '192.168.3.220',
  port: 80,
  username: 'admin',
  password: 'Control.1',
};

export interface DeviceInfo {
  deviceName?: string;
  deviceID?: string;
  model?: string;
  serialNumber?: string;
  macAddress?: string;
  firmwareVersion?: string;
  encoderVersion?: string;
  [key: string]: any;
}

export interface DeviceUser {
  employeeNo: string;
  name: string;
  userType?: string;
  doorRight?: string | number;
  password?: string;
  userVerifyMode?: string;
  RightPlan?: any;
  Right?: any;
  [key: string]: any;
}

export interface AcsEvent {
  employeeNoString?: string;
  cardNo?: string;
  time?: string;
  serialNo?: number;
  currentVerifyMode?: string;
  attendanceStatus?: string;
  major?: number;
  minor?: number;
  doorNo?: number;
  [key: string]: any;
}

export interface CompleteDeviceData {
  deviceInfo: DeviceInfo;
  users: DeviceUser[];
  events: AcsEvent[];
  extractedAt: string;
  summary: {
    totalUsers: number;
    totalEvents: number;
    deviceIp: string;
  };
}

// ── 1. Algoritmo MD5 (Con fallback nativo node:crypto en entorno Node) ──────────────
export function md5(input: string): string {
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const crypto = require('crypto');
      return crypto.createHash('md5').update(input, 'utf8').digest('hex');
    } catch (e) {
      // Fallback a versión pure JS
    }
  }

  function rotateLeft(lValue: number, iShiftBits: number) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }

  function addUnsigned(lX: number, lY: number) {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      else return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    } else {
      return lResult ^ lX8 ^ lY8;
    }
  }

  function F(x: number, y: number, z: number) { return (x & y) | (~x & z); }
  function G(x: number, y: number, z: number) { return (x & z) | (y & ~z); }
  function H(x: number, y: number, z: number) { return x ^ y ^ z; }
  function I(x: number, y: number, z: number) { return y ^ (x | ~z); }

  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(str: string) {
    const lMessageLength = str.length;
    const lNumberOfWords_temp1 = lMessageLength + 8;
    const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1);
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }

  function wordToHex(lValue: number) {
    let WordToHexValue = '', WordToHexValue_temp = '', lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      WordToHexValue_temp = '0' + lByte.toString(16);
      WordToHexValue = WordToHexValue + WordToHexValue_temp.slice(-2);
    }
    return WordToHexValue;
  }

  function utf8Encode(str: string) {
    str = str.replace(/\r\n/g, '\n');
    let utftext = '';
    for (let n = 0; n < str.length; n++) {
      const c = str.charCodeAt(n);
      if (c < 128) {
        utftext += String.fromCharCode(c);
      } else if ((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      } else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
    }
    return utftext;
  }

  let x: number[] = [];
  let k: number, AA: number, BB: number, CC: number, DD: number;
  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  const encodedStr = utf8Encode(input);
  x = convertToWordArray(encodedStr);
  let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;

  for (k = 0; k < x.length; k += 16) {
    AA = a; BB = b; CC = c; DD = d;
    a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
    b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
    a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
    c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
    c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);

    a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
    a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
    d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
    a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);

    a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
    a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
    c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);

    a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
    c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
    b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
    c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
    d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
    c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
    a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
    d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
    b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);

    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// ── 2. Parser y Generador de Autenticación HTTP Digest (RFC 2617) ──────────────
interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

function parseWwwAuthenticate(headerStr: string | null): DigestChallenge | null {
  if (!headerStr || !headerStr.toLowerCase().includes('digest')) {
    return null;
  }
  const params: Record<string, string> = {};
  const regex = /(\w+)=(?:"([^"]*)"|([^\s,]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(headerStr)) !== null) {
    params[match[1]] = match[2] !== undefined ? match[2] : match[3];
  }
  return {
    realm: params.realm || '',
    nonce: params.nonce || '',
    qop: params.qop || '',
    opaque: params.opaque || '',
    algorithm: params.algorithm || 'MD5',
  };
}

function generateDigestAuthHeader(
  user: string,
  pass: string,
  method: string,
  uri: string,
  challenge: DigestChallenge,
  ncCount: number = 1
): string {
  const { realm, nonce, qop, opaque } = challenge;
  const ncHex = ncCount.toString(16).padStart(8, '0');
  const cnonce = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

  const ha1 = md5(`${user}:${realm}:${pass}`);
  const ha2 = md5(`${method.toUpperCase()}:${uri}`);

  let response: string;
  if (qop && (qop.includes('auth') || qop.includes('auth-int'))) {
    response = md5(`${ha1}:${nonce}:${ncHex}:${cnonce}:auth:${ha2}`);
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
  }

  let header = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  if (qop) {
    header += `, qop=auth, nc=${ncHex}, cnonce="${cnonce}"`;
  }
  if (opaque) {
    header += `, opaque="${opaque}"`;
  }
  return header;
}

async function getFreshChallenge(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<DigestChallenge | null> {
  try {
    const res = await fetch(url, { method, headers, body });
    if (res.status === 401) {
      const wwwAuth = res.headers.get('www-authenticate');
      return parseWwwAuthenticate(wwwAuth);
    }
  } catch (e) {}
  return null;
}

// ── 3. Motor de Peticiones con HTTP Digest Autenticación Nativa ────────────────
export async function isapiDigestFetch(
  config: HikvisionDeviceConfig,
  path: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {}
): Promise<{ status: number; text: string; ok: boolean; headers: any }> {
  const method = (options.method || 'GET').toUpperCase();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  
  // Probar proxy local de Vite (/isapi-proxy), IP directa del dispositivo y proxies locales
  const urlsToTry = [
    `${origin}/isapi-proxy${path}`,
    `http://${config.ipAddress}:${config.port}${path}`,
    `http://localhost:8080${path}`,
    `http://127.0.0.1:8080${path}`,
    `http://localhost:9099/isapi${path}`
  ];

  let lastError: any = null;

  for (const url of urlsToTry) {
    const bodyLength = options.body ? new TextEncoder().encode(options.body).length : 0;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=UTF-8',
      'Accept': 'application/json',
      ...(bodyLength > 0 ? { 'Content-Length': String(bodyLength) } : {}),
      ...(options.headers || {}),
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body,
      });
    } catch (err: any) {
      lastError = err;
      continue;
    }

    // Si nos devuelve 401 Unauthorized, procesamos el challenge Digest (RFC 2617) con el nonce original
    if (response.status === 401) {
      const wwwAuth = response.headers.get('www-authenticate');
      const challenge = parseWwwAuthenticate(wwwAuth);

      if (challenge && challenge.realm && challenge.nonce) {
        const basePath = path.split('?')[0];
        const urisToTry = [path, basePath];
        const qopVariants = [challenge.qop, 'auth', ''];

        let successResponse: Response | null = null;

        for (const uriCandidate of urisToTry) {
          for (const qopCandidate of qopVariants) {
            const testChallenge = { ...challenge, qop: qopCandidate };

            const digestHeader = generateDigestAuthHeader(
              config.username,
              config.password,
              method,
              uriCandidate,
              testChallenge
            );

            try {
              const retryRes = await fetch(url, {
                method,
                headers: {
                  ...headers,
                  'Authorization': digestHeader,
                },
                body: options.body,
              });

              if (retryRes.status !== 401) {
                successResponse = retryRes;
                break;
              }
            } catch (err) {
              /* retry attempt error */
            }
          }
          if (successResponse) break;
        }

        if (successResponse) {
          response = successResponse;
        }
      }
    }

    const text = await response.text();

    if (text.includes('<lockStatus>lock</lockStatus>') || text.includes('"lockStatus":"lock"')) {
      console.warn('⚠️ [Hikvision ISAPI] El equipo está en bloqueo de seguridad temporal (lockStatus: lock). Espere el tiempo de desbloqueo.');
    }

    return {
      status: response.status,
      ok: response.ok,
      text,
      headers: response.headers,
    };
  }

  throw lastError || new Error(`No se pudo conectar al biométrico en ${config.ipAddress}:${config.port} ni a los proxies locales.`);
}

// ── 4. Obtención de Información del Dispositivo (DeviceInfo) ───────────────────
export async function fetchDeviceInfo(config: HikvisionDeviceConfig = DEFAULT_DEVICE_CONFIG): Promise<DeviceInfo> {
  const path = '/ISAPI/System/deviceInfo?format=json';
  try {
    const res = await isapiDigestFetch(config, path, { method: 'GET' });
    if (res.ok && res.text) {
      try {
        const parsed = JSON.parse(res.text);
        return parsed.DeviceInfo || parsed;
      } catch (e) {
        // Fallback si el dispositivo responde en XML
        const modelMatch = res.text.match(/<model>([^<]+)<\/model>/i);
        const serialMatch = res.text.match(/<serialNumber>([^<]+)<\/serialNumber>/i);
        const nameMatch = res.text.match(/<deviceName>([^<]+)<\/deviceName>/i);
        return {
          model: modelMatch ? modelMatch[1] : 'DS-K1T8003MF',
          serialNumber: serialMatch ? serialMatch[1] : undefined,
          deviceName: nameMatch ? nameMatch[1] : undefined,
          ipAddress: config.ipAddress,
        };
      }
    }
  } catch (err) {
    console.warn('[Hikvision ISAPI] Error al consultar deviceInfo:', err);
  }
  return { model: 'DS-K1T8003MF', ipAddress: config.ipAddress };
}

// ── 5. Extracción TOTAL de Usuarios (Bucle Paginado POST de 10 en 10) ──────────
export async function fetchAllUsers(config: HikvisionDeviceConfig = DEFAULT_DEVICE_CONFIG): Promise<DeviceUser[]> {
  const path = '/ISAPI/AccessControl/UserInfo/Search?format=json';
  const pageSize = 10; // Paginación estricta de 10 en 10
  let position = 0;
  let totalMatches = Infinity;
  const allUsers: DeviceUser[] = [];

  while (position < totalMatches) {
    const payload = JSON.stringify({
      UserInfoSearchCond: {
        searchID: "1",
        searchResultPosition: position,
        maxResults: pageSize,
      },
    });

    try {
      const res = await isapiDigestFetch(config, path, { method: 'POST', body: payload });
      if (!res.ok || !res.text) {
        console.warn(`[Hikvision ISAPI] User Search falló en posición ${position} con HTTP ${res.status}`);
        break;
      }

      const data = JSON.parse(res.text);
      const searchResult = data.UserInfoSearch || {};

      if (typeof searchResult.totalMatches === 'number') {
        totalMatches = searchResult.totalMatches;
      }

      let userList = searchResult.UserInfo || [];
      if (!Array.isArray(userList)) {
        userList = [userList];
      }

      if (userList.length === 0) {
        break;
      }

      allUsers.push(...userList);
      position += userList.length;

      // Si ya alcanzamos el total de matches o no hay más en la página, rompemos el bucle
      if (position >= totalMatches || userList.length < pageSize) {
        break;
      }
    } catch (err) {
      console.error(`[Hikvision ISAPI] Excepción al buscar usuarios en posición ${position}:`, err);
      break;
    }
  }

  return allUsers;
}

// ── 6. Extracción Rápida y Directa de Eventos del Biométrico (Sin Bloqueos de Socket) ─────────
export async function fetchAllEvents(
  config: HikvisionDeviceConfig = DEFAULT_DEVICE_CONFIG,
  options?: { startTime?: string; endTime?: string; maxEvents?: number }
): Promise<AcsEvent[]> {
  const path = '/ISAPI/AccessControl/AcsEvent?format=json';
  const allEventsMap = new Map<string, AcsEvent>();

  const startTime = options?.startTime;
  const endTime = options?.endTime;

  try {
    // 1. Obtener primera página y totalMatches exacto del biométrico
    const initCond: any = {
      searchID: "1",
      searchResultPosition: 0,
      maxResults: 10,
      major: 0,
      minor: 0,
    };
    if (startTime) initCond.startTime = startTime;
    if (endTime) initCond.endTime = endTime;

    const res1 = await isapiDigestFetch(config, path, { method: 'POST', body: JSON.stringify({ AcsEventCond: initCond }) });
    if (!res1.ok || !res1.text) return [];

    const data1 = JSON.parse(res1.text);
    const totalMatches = data1.AcsEvent?.totalMatches || 0;
    if (totalMatches === 0) return [];

    // 2. Traer el lote completo de las últimas 200 marcaciones recientes en 1 sola petición HTTP
    const startPos = Math.max(0, totalMatches - 200);
    const batchCond: any = {
      searchID: "1",
      searchResultPosition: startPos,
      maxResults: 200,
      major: 0,
      minor: 0,
    };
    if (startTime) batchCond.startTime = startTime;
    if (endTime) batchCond.endTime = endTime;

    const res2 = await isapiDigestFetch(config, path, { method: 'POST', body: JSON.stringify({ AcsEventCond: batchCond }) });
    if (res2.ok && res2.text) {
      const data2 = JSON.parse(res2.text);
      let lote = data2.AcsEvent?.InfoList || [];
      if (!Array.isArray(lote)) lote = [lote];
      lote.forEach((ev: AcsEvent) => {
        const key = ev.serialNo ? `S-${ev.serialNo}` : `T-${ev.employeeNoString || ev.cardNo}-${ev.time}`;
        allEventsMap.set(key, ev);
      });
    }
  } catch (err) {
    console.error('[Hikvision ISAPI] Error en consulta directa de eventos:', err);
  }

  const result = Array.from(allEventsMap.values());
  return result.sort((a, b) => new Date(a.time || 0).getTime() - new Date(b.time || 0).getTime());
}

// ── 7. Función Consolidada Reutilizable: fetchCompleteDeviceData ───────────────
export async function fetchCompleteDeviceData(
  config: HikvisionDeviceConfig = DEFAULT_DEVICE_CONFIG
): Promise<CompleteDeviceData> {
  const deviceInfo = await fetchDeviceInfo(config);
  const users = await fetchAllUsers(config);
  const events = await fetchAllEvents(config);

  return {
    deviceInfo,
    users,
    events,
    extractedAt: new Date().toISOString(),
    summary: {
      totalUsers: users.length,
      totalEvents: events.length,
      deviceIp: config.ipAddress,
    },
  };
}
