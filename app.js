// app.js — mengambil data dari manhwas.json dan merender UI
document.addEventListener('DOMContentLoaded', () => {
  const listRoot = document.getElementById('list-root');
  const emptyEl = document.getElementById('empty');
  const search = document.getElementById('search');
  const clearBtn = document.getElementById('clear');

  let DB = { manhwas: [] };

  // ambil JSON eksternal (manhwas.json)
  fetch('manhwas.json')
    .then(res => {
      if (!res.ok) throw new Error('Gagal memuat manhwas.json');
      return res.json();
    })
    .then(json => {
      DB = json || { manhwas: [] };
      renderList();
      // jika ada hash saat load, tampilkan detail
      const initialId = parseHash();
      if (initialId) renderDetail(initialId);
    })
    .catch(err => {
      console.error('Fetch error:', err);
      DB = { manhwas: [] };
      renderList();
    });

  function renderList(filter=''){
    listRoot.innerHTML = '';
    const all = (DB.manhwas||[]).filter(m=>{
      if(!filter) return true;
      const q = filter.toLowerCase();
      if((m.title||'').toLowerCase().includes(q)) return true;
      if((m.genres||[]).some(g=>g.toLowerCase().includes(q))) return true;
      if((m.synopsis||'').toLowerCase().includes(q)) return true;
      return false;
    });
    if(all.length===0){ emptyEl.classList.remove('d-none'); return } else { emptyEl.classList.add('d-none') }

    all.forEach(m=>{
      const col = document.createElement('div'); col.className = 'col-12 col-sm-6 col-md-4 col-lg-3';
      col.innerHTML = `
        <div class="card card-manhwa h-100 shadow-sm" tabindex="0" role="button" data-id="${m.id}">
          <img src="${m.poster||'https://placehold.co/600x900?text=No+Image'}" alt="${escapeHtml(m.title)}" class="poster w-100" />
          <div class="card-body">
            <h6 class="card-title mb-1" style="color:var(--text)">${escapeHtml(m.title)}</h6>
            <div class="muted small">Chapters: ${m.chapters||'?'}</div>
            <div class="mt-2 d-flex flex-wrap gap-1">
              ${(m.genres||[]).map(g=>`<span class="badge badge-genre">${escapeHtml(g)}</span>`).join(' ')}
            </div>
          </div>
        </div>`;
      listRoot.appendChild(col);
    });

    // attach click
    listRoot.querySelectorAll('[data-id]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const id = el.getAttribute('data-id');
        location.hash = `#manhwa/${encodeURIComponent(id)}`;
      });
    });
  }

  // helper: render action chapters as chips with "+N" dropdown
  function renderActionChips(actionChapters = [], maxVisible = 3) {
    if (!Array.isArray(actionChapters) || actionChapters.length === 0) return '';
    const visible = actionChapters.slice(0, maxVisible);
    const remaining = actionChapters.length - visible.length;

    // render visible chips
    const chipsHtml = visible.map(x => `<span class="chip">${escapeHtml(x)}</span>`).join('');

    if (remaining <= 0) return `<div class="chips-wrap">${chipsHtml}</div>`;

    // create unique id for dropdown
    const uid = 'ac_' + Math.random().toString(36).slice(2, 9);

    // dropdown button + menu (Bootstrap)
    const dropdown = `
      <div class="dropdown d-inline">
        <button class="chip dropdown-toggle" id="${uid}" data-bs-toggle="dropdown" aria-expanded="false" style="background:transparent;">
          +${remaining} more
        </button>
        <ul class="dropdown-menu dropdown-menu-end dropdown-action-chapters" aria-labelledby="${uid}">
          ${actionChapters.slice(maxVisible).map(x => `<li><button class="dropdown-item small" type="button">${escapeHtml(x)}</button></li>`).join('')}
        </ul>
      </div>
    `;

    return `<div class="chips-wrap">${chipsHtml}${dropdown}</div>`;
  }

  function renderDetail(id){
    const m = (DB.manhwas||[]).find(x=>x.id===id);
    const detail = document.getElementById('detail');
    if(!m){ detail.classList.add('d-none'); return }
    document.getElementById('detail-title').textContent = m.title;
    document.getElementById('detail-poster').src = m.poster || 'https://placehold.co/600x900?text=No+Image';
    document.getElementById('detail-genres').innerHTML = (m.genres||[]).map(g=>`<span class="badge badge-genre me-1">${escapeHtml(g)}</span>`).join(' ');
    document.getElementById('detail-chapters').textContent = m.chapters||'?';
    document.getElementById('detail-synopsis').textContent = m.synopsis||'';

    const chars = document.getElementById('chars');
    chars.innerHTML='';
    (m.characters||[]).forEach(c=>{
      const row = document.createElement('div');
      row.className='list-group-item bg-transparent d-flex gap-3 align-items-start';
      row.innerHTML = `
        <img src="${c.image||'https://placehold.co/200x200?text=No+Image'}" class="character-img" alt="${escapeHtml(c.name)}" />
        <div class="flex-grow-1">
          <div class="d-flex align-items-start justify-content-between">
            <div>
              <div class="fw-semibold">${escapeHtml(c.name)}</div>
              <div class="muted small">Debut: ${c.debut_chapter||'?'} </div>
            </div>
            <div class="text-end small muted">
              ${renderActionChips(c.action_chapters || [], 1)}
            </div>
          </div>
          <div class="mt-2 muted small">${escapeHtml(c.description||'')}</div>
        </div>
      `;
      chars.appendChild(row);
    });

    detail.classList.remove('d-none');
    detail.scrollTop = 0;
  }

  function closeDetail(){
    history.pushState('', document.title, location.pathname + location.search);
    document.getElementById('detail').classList.add('d-none');
  }

  document.getElementById('close-detail').addEventListener('click', closeDetail);
  window.addEventListener('hashchange', ()=>{
    const id = parseHash();
    if(id) renderDetail(id); else closeDetail();
  });

  search.addEventListener('input', ()=>renderList(search.value.trim()));
  clearBtn.addEventListener('click', ()=>{ search.value=''; renderList(); });

  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ if(!document.getElementById('detail').classList.contains('d-none')) closeDetail(); }});

  function parseHash(){
    const h = location.hash || '';
    if(h.startsWith('#manhwa/')) return decodeURIComponent(h.split('/')[1]||'');
    return null;
  }

  // handle dropdown-item clicks for action chapters (delegation)
  document.getElementById('detail').addEventListener('click', (e)=>{
    const target = e.target;
    if (target.classList.contains('dropdown-item')) {
      const chapter = target.textContent.trim();
      // contoh aksi: log. Kamu bisa ganti jadi navigasi / jump to chapter
      console.log('User pilih chapter:', chapter);
      // tutup dropdown (Bootstrap)
      const parentDropdown = target.closest('.dropdown');
      if (parentDropdown) {
        const toggler = parentDropdown.querySelector('[data-bs-toggle="dropdown"]');
        if (toggler) {
          const dd = bootstrap.Dropdown.getInstance(toggler);
          if (dd) dd.hide();
        }
      }
    }
  });

  // utility
  function escapeHtml(s){ if(!s) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
});
