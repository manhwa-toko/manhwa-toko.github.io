const OWNER = process.env.GITHUB_OWNER
const REPO = process.env.GITHUB_REPO
const BRANCH = process.env.GITHUB_BRANCH || 'main'
const TOKEN = process.env.GITHUB_TOKEN
const SECRET = process.env.EDITOR_SECRET

const API = 'https://api.github.com'

const headers = {
  Authorization: `token ${TOKEN}`,
  'User-Agent': 'vercel-function',
  'Content-Type': 'application/json',
}

async function getSha(path) {
  const r = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, { headers })
  if (r.status === 404) return null
  const j = await r.json()
  return j.sha
}

async function putFile(path, content, msg, sha) {
  const body = { message: msg, content, branch: BRANCH }
  if (sha) body.sha = sha
  const r = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (req.headers['x-editor-secret'] !== SECRET)
    return res.status(401).json({ ok: false })

  try {
    const { filename, content_base64 } = req.body
    const path = `media/${filename}`
    const sha = await getSha(path)
    await putFile(path, content_base64, `Upload ${filename}`, sha)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
