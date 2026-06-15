const https = require('https');
const fs = require('fs');

const envContent = fs.readFileSync('e:/Igen/Architect-Assistant/.env', 'utf8');
const piapiLine = envContent.split('\n').find(l => l.startsWith('PIAPI_API_KEY='));
const rawVal = piapiLine.split('=').slice(1).join('=').trim();
const key = rawVal.replace(/^["']|["']$/g, '');
console.log('Key prefix:', key.substring(0, 10));

function makeReq(body) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    const opts = {
      hostname: 'api.piapi.ai',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'Authorization': 'Bearer ' + key
      }
    };
    const r = https.request(opts, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, raw: data.substring(0, 500) }); }
      });
    });
    r.on('error', e => resolve({ error: e.message }));
    r.write(bodyStr); r.end();
  });
}

(async () => {
  // Test 1: JSON mode with gpt-4o-mini
  console.log('\n=== Test 1: JSON mode (gpt-4o-mini) ===');
  const t1 = await makeReq({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Respond only in valid JSON. No markdown.' },
      { role: 'user', content: 'Give me 2 colors as JSON: {"colors": ["red", "blue"]}' }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 100
  });
  console.log('Status:', t1.status);
  const c1 = t1.json?.choices?.[0]?.message?.content;
  console.log('Content:', c1);
  try { console.log('Valid JSON:', JSON.parse(c1)); } catch { console.log('NOT valid JSON'); }

  await new Promise(r => setTimeout(r, 500));

  // Test 2: Vision with gpt-4o
  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  console.log('\n=== Test 2: Vision (gpt-4o) ===');
  const t2 = await makeReq({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'data:image/png;base64,' + tinyPng } },
        { type: 'text', text: 'What color is this 1x1 pixel image? One word answer.' }
      ]
    }],
    max_tokens: 20
  });
  console.log('Status:', t2.status);
  const c2 = t2.json?.choices?.[0]?.message?.content;
  console.log('Content:', c2 || JSON.stringify(t2.json?.error || t2.raw).substring(0, 200));

  await new Promise(r => setTimeout(r, 500));

  // Test 3: Complex JSON schema prompt (like Upscale analysis)
  console.log('\n=== Test 3: JSON schema in system prompt (gpt-4o-mini) ===');
  const t3 = await makeReq({
    model: 'gpt-4o-mini',
    messages: [
      { 
        role: 'system', 
        content: `You are an image analyzer. Respond ONLY in valid JSON matching this exact schema:
{
  "image_content_analysis": "string describing what you see",
  "optimized_upscale_prompt": "string with upscale prompt",
  "negative_prompt": "string with negative prompt"
}
No markdown, no extra text.` 
      },
      { role: 'user', content: 'Analyze a modern living room with white walls and wooden floors.' }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 300
  });
  console.log('Status:', t3.status);
  const c3 = t3.json?.choices?.[0]?.message?.content;
  try {
    const parsed = JSON.parse(c3);
    console.log('Keys:', Object.keys(parsed));
    console.log('Valid structured JSON: YES');
  } catch { console.log('Content:', c3?.substring(0, 300)); }

  console.log('\nDone!');
})();
