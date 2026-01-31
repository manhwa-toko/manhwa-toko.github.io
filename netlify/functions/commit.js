// netlify/functions/commit.js
// Netlify function: menerima POST { manhwas: [...], images: [{ filename, content_base64 }] }
// Write images -> media/<filename> and update manhwas.json in repo via GitHub API
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const TOKEN = process.env.GITHUB_TOKEN;
const EDITOR_SECRET = process.env.EDITOR_SECRET || null;
const API_BASE = 'https://api.github.com';

const headersCommon = (token) => ({
  Authorization: `token ${token}`,
  'User-Agent': 'netlify-function',
  'Content-Type': 'application/json',
});

async function getFileSha(path){
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`;
  const res = await fetch(url, { headers: { Authorization: `token ${TOKEN}`, 'User-Agent': 'netlify-function' } });
  if(res.status === 200){
    const j = await res.json();
    return j.sha;
  }
  if(res.status === 404) return null;
  const txt = await res.text();
  throw new Error(`getFileSha ${path} failed: ${res.status} ${txt}`);
}

async function putFile(path, base64Content, commitMessage, sha){
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
  const body = {
    message: commitMessage,
    content: base64Content,
    branch: BRANCH,
  };
  if(sha) body.sha = sha;
  const res = await fetch(url, { method: 'PUT', headers: headersCommon(TOKEN), body: JSON.stringify(body) });
  const text = await res.text();
  if(!res.ok) throw new Error(`putFile ${path} failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

export async function handler(event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-editor-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if(event.httpMethod === 'OPTIONS'){
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    if(!TOKEN || !OWNER || !REPO) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok:false, error: 'Missing GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO' }) };
    }

    // Optional secret check: if EDITOR_SECRET set, require same header
    if(EDITOR_SECRET){
      const incoming = (event.headers && (event.headers['x-editor-secret'] || event.headers['X-Editor-Secret'])) || '';
      if(incoming !== EDITOR_SECRET){
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ ok:false, error: 'Invalid editor secret' }) };
      }
    }

    const body = JSON.parse(event.body || '{}');
    const manhwas = body.manhwas || null;
    const images = Array.isArray(body.images) ? body.images : [];

    // upload images first
    for(const im of images){
      if(!im.filename || !im.content_base64) continue;
      const path = `media/${im.filename}`;
      // sanity: limit (~8MB base64)
      const maxBase64 = 8 * 1024 * 1024 * 4 / 3;
      if(im.content_base64.length > maxBase64) {
        throw new Error(`Image ${im.filename} too large`);
      }
      const existingSha = await getFileSha(path);
      await putFile(path, im.content_base64, `Add/Update image ${im.filename}`, existingSha || undefined);
    }

    // update manhwas.json
    if(manhwas){
      const path = 'manhwas.json';
      const existingSha = await getFileSha(path);
      const contentBase64 = Buffer.from(JSON.stringify(manhwas, null, 2)).toString('base64');
      await putFile(path, contentBase64, 'Update manhwas.json', existingSha || undefined);
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok:true }) };

  } catch(err) {
    console.error(err);
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin':'*' }, body: JSON.stringify({ ok:false, error: err.message }) };
  }
}
