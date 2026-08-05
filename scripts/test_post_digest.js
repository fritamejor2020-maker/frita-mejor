import { isapiDigestFetch, DEFAULT_DEVICE_CONFIG } from '../src/services/hikvisionIsapiService.ts';

async function testPost() {
  const payload = JSON.stringify({
    AcsEventCond: {
      searchID: "1",
      searchResultPosition: 0,
      maxResults: 10,
      major: 0,
      minor: 0
    }
  });

  const res = await isapiDigestFetch(DEFAULT_DEVICE_CONFIG, '/ISAPI/AccessControl/AcsEvent?format=json', {
    method: 'POST',
    body: payload
  });

  console.log('Status:', res.status);
  console.log('OK?:', res.ok);
  console.log('Body snippet:', res.text.slice(0, 300));
}

testPost();
