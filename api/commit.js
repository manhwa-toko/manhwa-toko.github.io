const OWNER = process.env.GITHUB_OWNER
const REPO = process.env.GITHUB_REPO
const BRANCH = process.env.GITHUB_BRANCH || 'main'
const TOKEN = process.env.GITHUB_TOKEN
const EDITOR_SECRET = process.env.EDITOR_SECRET || null

const API_BASE = 'https://api.github.com'

const headersCommon = {
  Authorization: `token ${TOKEN}`,
  'User-Agent': 'vercel-function',
  'Content-Type': 'application/json',
}

async function getFileSha(path) {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`
  const res = await fetch(url, { headers: headersCommon })
  if (res.status === 200) {
    const j = await res.json()
    return j.sha
  }
  if (res.status === 404) return null
  throw new Error(await res.text())
}

async function putFile(path, base64, message, sha) {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`
  const body = {
    message,
    content: base64,
    branch: BRANCH,
  }
  if (sha) body.sha = sha

  const res = await fetch(url, {
    method: 'PUT',
    headers: headersCommon,
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(await res.text())
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false })
  }

  try {
    if (!TOKEN || !OWNER || !REPO) {
      return res.status(500).json({ ok: false, error: 'Missing env config' })
    }

    if (EDITOR_SECRET) {
      if (req.headers['x-editor-secret'] !== EDITOR_SECRET) {
        return res.status(401).json({ ok: false, error: 'Invalid editor secret' })
      }
    }

    const { manhwas, images = [] } = req.body || {}

    // upload images
    for (const im of images) {
      const path = `media/${im.filename}`
      const sha = await getFileSha(path)
      await putFile(path, im.content_base64, `Add image ${im.filename}`, sha)
    }

    // update manhwas.json
    if (manhwas) {
      const sha = await getFileSha('manhwas.json')
      const base64 = Buffer
        .from(JSON.stringify(manhwas, null, 2))
        .toString('base64')

      await putFile('manhwas.json', base64, 'Update manhwas.json', sha)
    }

    res.json({ ok: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
}
