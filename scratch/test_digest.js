import crypto from 'node:crypto';

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

async function getFreshNonce(url) {
  const res = await fetch(url);
  const wwwAuth = res.headers.get('www-authenticate') || '';
  const realmMatch = wwwAuth.match(/realm="([^"]+)"/);
  const nonceMatch = wwwAuth.match(/nonce="([^"]+)"/);
  const qopMatch = wwwAuth.match(/qop="([^"]+)"/);

  return {
    realm: realmMatch ? realmMatch[1] : '',
    nonce: nonceMatch ? nonceMatch[1] : '',
    qop: qopMatch ? qopMatch[1] : '',
    raw: wwwAuth
  };
}

async function testFreshDigest() {
  const url = 'http://192.168.3.220:80/ISAPI/System/deviceInfo?format=json';
  const uri = '/ISAPI/System/deviceInfo?format=json';
  const user = 'admin';
  const pass = 'Control.1';
  const method = 'GET';
  const cnonce = '0a4f113b836120a4';
  const nc = '00000001';

  // Test 1: Standard RFC 2617 with qop="auth"
  {
    const ch = await getFreshNonce(url);
    const ha1 = md5(`${user}:${ch.realm}:${pass}`);
    const ha2 = md5(`${method}:${uri}`);
    const response = md5(`${ha1}:${ch.nonce}:${nc}:${cnonce}:auth:${ha2}`);
    const header = `Digest username="${user}", realm="${ch.realm}", nonce="${ch.nonce}", uri="${uri}", response="${response}", qop="auth", nc=${nc}, cnonce="${cnonce}"`;
    const res = await fetch(url, { headers: { Authorization: header } });
    console.log('Test 1 (qop="auth", fresh nonce) Status:', res.status, await res.text());
  }

  // Test 2: qop=auth (no quotes on qop value)
  {
    const ch = await getFreshNonce(url);
    const ha1 = md5(`${user}:${ch.realm}:${pass}`);
    const ha2 = md5(`${method}:${uri}`);
    const response = md5(`${ha1}:${ch.nonce}:${nc}:${cnonce}:auth:${ha2}`);
    const header = `Digest username="${user}", realm="${ch.realm}", nonce="${ch.nonce}", uri="${uri}", response="${response}", qop=auth, nc=${nc}, cnonce="${cnonce}"`;
    const res = await fetch(url, { headers: { Authorization: header } });
    console.log('Test 2 (qop=auth, fresh nonce) Status:', res.status, await res.text());
  }

  // Test 3: Standard digest without qop parameter
  {
    const ch = await getFreshNonce(url);
    const ha1 = md5(`${user}:${ch.realm}:${pass}`);
    const ha2 = md5(`${method}:${uri}`);
    const response = md5(`${ha1}:${ch.nonce}:${ha2}`);
    const header = `Digest username="${user}", realm="${ch.realm}", nonce="${ch.nonce}", uri="${uri}", response="${response}"`;
    const res = await fetch(url, { headers: { Authorization: header } });
    console.log('Test 3 (no qop in header/hash, fresh nonce) Status:', res.status, await res.text());
  }

  // Test 4: XML ISAPI path without format=json query parameter: /ISAPI/System/deviceInfo
  {
    const xmlUrl = 'http://192.168.3.220:80/ISAPI/System/deviceInfo';
    const xmlUri = '/ISAPI/System/deviceInfo';
    const ch = await getFreshNonce(xmlUrl);
    const ha1 = md5(`${user}:${ch.realm}:${pass}`);
    const ha2 = md5(`${method}:${xmlUri}`);
    const response = md5(`${ha1}:${ch.nonce}:${nc}:${cnonce}:auth:${ha2}`);
    const header = `Digest username="${user}", realm="${ch.realm}", nonce="${ch.nonce}", uri="${xmlUri}", response="${response}", qop="auth", nc=${nc}, cnonce="${cnonce}"`;
    const res = await fetch(xmlUrl, { headers: { Authorization: header } });
    console.log('Test 4 (XML ISAPI /ISAPI/System/deviceInfo) Status:', res.status, await res.text());
  }
}

testFreshDigest();
