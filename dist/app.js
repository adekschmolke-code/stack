const pages = { bestand: 'Bestand', zaehlung: 'Zählung', listen: 'Listen' };
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function persist(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { document.getElementById('storageStatus').textContent = 'Änderungen können nur für diese Sitzung gespeichert werden.'; } }
let categories = read('stack-categories-v1', []);
if (!Array.isArray(categories)) categories = [];
categories = categories.filter(name => typeof name === 'string' && name.trim());
let articles = read('stack-articles-v1', [{ id: 'example-article', name: 'Beispielartikel', category: '' }]);
if (!Array.isArray(articles)) articles = [];
articles = articles.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.category === 'string');
if (!read('stack-demo-twelve-v1', false)) {
  for (let i = 1; i <= 12; i++) if (!categories.includes(`Kategorie ${i}`)) categories.push(`Kategorie ${i}`);
  for (let i = 2; i <= 12; i++) if (!articles.some(item => item.id === `example-article-${i}`)) articles.push({ id: `example-article-${i}`, name: `Beispielartikel ${i}`, category: `Kategorie ${i - 1}` });
  persist('stack-categories-v1', categories);
  persist('stack-articles-v1', articles);
  persist('stack-demo-twelve-v1', true);
}
let selectedCategory = '';
let draft = {name:'', category:''};
let suppressClickUntil = 0;
const select = document.getElementById('categorySelect');
const articleList = document.getElementById('articleList');
const dialog = document.getElementById('categoryDialog');
const nameInput = document.getElementById('categoryName');
const error = document.getElementById('categoryError');
function saveArticles() { persist('stack-articles-v1', articles); }
function categoryOptions(field, value) {
  field.replaceChildren(new Option('Nicht zugeteilt', ''));
  [...new Set([...categories, ...(value ? [value] : [])])].forEach(name => field.add(new Option(name, name)));
  field.value = value;
}
function renderCategories() {
  select.replaceChildren(new Option('Alle Kategorien', ''), new Option('Nicht zugeteilt', '__unassigned__'));
  categories.forEach(name => select.add(new Option(name, name)));
  select.value = selectedCategory;
}
function visibleArticles() { return articles.filter(item => !selectedCategory || (selectedCategory === '__unassigned__' ? !item.category : item.category === selectedCategory)); }
function renderPage() {
  const page = Object.hasOwn(pages, location.hash.slice(1)) ? location.hash.slice(1) : 'bestand';
  document.getElementById('pageTitle').textContent = pages[page];
  document.title = `${pages[page]} · Stack`;
  document.getElementById('categoryControls').hidden = page === 'listen';
  document.querySelector('.header-actions').hidden = page !== 'bestand';
  if(page !== 'bestand') document.getElementById('historyDialog').close();
  document.getElementById('countWorkspace').hidden = page !== 'zaehlung';
  document.getElementById('savedLists').hidden = page !== 'listen';
  if (page === 'listen') renderSavedLists();
  document.getElementById('inventory').hidden = page !== 'bestand';
  document.getElementById('counting').hidden = page !== 'zaehlung';
  document.querySelectorAll('[data-page]').forEach(link => { if (link.dataset.page === page) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
}
function editName(item, button) {
  const input = document.createElement('input');
  input.className = 'inline-name'; input.value = item.name; input.maxLength = 100; input.setAttribute('aria-label', 'Artikelname');
  button.replaceWith(input); input.focus(); input.select();
  let done = false;
  const finish = cancel => { if (done) return; done = true; if (!cancel && input.value.trim()) { const previous = item.name; item.name = input.value.trim(); saveArticles(); if(previous !== item.name) recordHistory('1 Artikel umbenannt: '+item.name, {kind:'field', id:item.id, field:'name', before:previous, after:item.name}); } renderArticles(); };
  input.onblur = () => finish(false);
  input.onkeydown = event => { if (event.key === 'Enter') finish(false); if (event.key === 'Escape') finish(true); };
}
function renderArticles() {
  articleList.replaceChildren();
  if (draft) renderDraft();
  visibleArticles().forEach(item => {
    const row = document.createElement('div'); row.className = 'article-row'; row.dataset.id = item.id; row.tabIndex = 0;
    row.setAttribute('aria-label', `${item.name}. Entf zum Löschen, Alt und Pfeiltasten zum Verschieben.`);
    const info = document.createElement('div'); info.className = 'article-info';
    const name = document.createElement('button'); name.type = 'button'; name.className = 'article-name'; name.textContent = item.name; name.title = 'Name ändern';
    name.onclick = () => { if (Date.now() > suppressClickUntil) editName(item, name); };
    const category = document.createElement('select'); category.className = 'inline-category'; category.setAttribute('aria-label', `${item.name}: Kategorie ändern`); categoryOptions(category, item.category);
    category.onchange = () => { const previous=item.category; item.category = category.value; saveArticles(); if(previous !== item.category) recordHistory('1 Artikel neu zugeteilt: '+item.name, {kind:'field',id:item.id,field:'category',before:previous,after:item.category}); renderArticles(); };
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-confirm'; remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>'; remove.title = 'Artikel löschen'; remove.hidden = true; remove.setAttribute('aria-label', item.name + ' endgültig löschen');
    remove.onclick = event => { event.stopPropagation(); deleteArticle(item); };
    info.append(name, category); row.append(remove, info); articleList.append(row);
    bindGestures(row, item);
    row.onkeydown = event => {
      if (event.target !== row) return;
      if (event.key === 'Delete') { event.preventDefault(); revealDelete(row, 1); }
      if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); const visible = visibleArticles(); const index = visible.indexOf(item); const target = visible[index + (event.key === 'ArrowUp' ? -1 : 1)];
        if (target) { reorderArticle(item.id, target.id); [...articleList.children].find(el => el.dataset.id === item.id)?.focus(); }
      }
    };
  });
  if (!visibleArticles().length && !draft) { const empty = document.createElement('p'); empty.className = 'empty-articles'; empty.textContent = 'Keine Artikel vorhanden.'; articleList.append(empty); }
  renderCounting();
}
function renderDraft() {
  const form = document.createElement('form'); form.className = 'article-row article-draft';
  const info = document.createElement('div'); info.className = 'article-info';
  const input = document.createElement('input'); input.className = 'inline-name'; input.placeholder = 'Artikelname'; input.required = true; input.maxLength = 100; input.value = draft.name; input.setAttribute('aria-label', 'Neuer Artikelname'); input.oninput = () => { draft.name = input.value; input.setCustomValidity(''); };
  const field = document.createElement('select'); field.className = 'inline-category'; field.setAttribute('aria-label', 'Kategorie für neuen Artikel'); categoryOptions(field, draft.category); field.onchange = () => draft.category = field.value;
  info.append(input, field);
  const save = document.createElement('button'); save.className = 'icon-button primary'; save.type = 'submit'; save.textContent = '✓'; save.setAttribute('aria-label', 'Artikel speichern');
  const cancel = document.createElement('button'); cancel.className = 'icon-button'; cancel.type = 'button'; cancel.textContent = '×'; cancel.setAttribute('aria-label', 'Anlegen abbrechen'); cancel.onclick = () => { draft = {name:'',category:''}; renderArticles(); };
  form.append(info, save, cancel); articleList.append(form);
  form.onsubmit = event => { event.preventDefault(); if (!input.value.trim()) { input.setCustomValidity('Bitte einen Namen eingeben.'); input.reportValidity(); return; } const item={ id: crypto.randomUUID(), name: input.value.trim(), category: field.value }; articles.unshift(item); draft = {name:'',category:field.value}; saveArticles(); recordHistory('1 Artikel hinzugefügt: '+item.name,{kind:'article',id:item.id,before:null,after:{...item},index:0}); renderArticles(); articleList.querySelector('input').focus(); };
}
function deleteArticle(item) {
  const index=articles.indexOf(item); if(index<0)return;
  const previous={...item}; articles.splice(index,1); saveArticles(); renderArticles();
  recordHistory('1 Artikel gelöscht: '+item.name,{kind:'article',id:item.id,before:previous,after:null,index});
}
function reorderArticle(id, targetId) { const from = articles.findIndex(item => item.id === id); const to = articles.findIndex(item => item.id === targetId); if (from < 0 || to < 0 || from === to) return; const [item] = articles.splice(from, 1); articles.splice(to, 0, item); saveArticles(); renderArticles(); }
function bindGestures(row, item) {
  row.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('select,input,.delete-confirm')) return;
    const startX = event.clientX, startY = event.clientY; let mode = 'pending', dx = 0, targetId = null;
    const timer = setTimeout(() => { if (mode !== 'pending') return; mode = 'drag'; row.classList.add('is-dragging'); document.body.classList.add('reordering'); suppressClickUntil = Date.now() + 1000; row.setPointerCapture(event.pointerId); }, 450);
    const move = e => {
      if (e.pointerId !== event.pointerId) return;
      dx = e.clientX - startX; const dy = e.clientY - startY;
      if (mode === 'pending' && Math.hypot(dx, dy) > 9) { clearTimeout(timer); mode = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'swipe' : 'scroll'; }
      if (mode === 'swipe') { row.querySelector('.article-info').style.transform = `translateX(${Math.max(-140,Math.min(140,dx))}px)`; row.classList.add('swiping'); suppressClickUntil = Date.now() + 700; }
      if (mode === 'drag') {
        e.preventDefault(); row.style.transform = `translateY(${dy}px)`;
        row.style.pointerEvents = 'none'; const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.article-row'); row.style.pointerEvents = '';
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target')); targetId = target && target.dataset.id !== item.id ? target.dataset.id : null; if (targetId) target.classList.add('drop-target');
        if (e.clientY < 80) window.scrollBy(0, -12); else if (e.clientY > innerHeight - 80) window.scrollBy(0, 12);
      }
    };
    const end = e => {
      if (e.pointerId !== event.pointerId) return;
      clearTimeout(timer); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
      row.style.transform = ''; row.querySelector('.article-info').style.transform = ''; row.classList.remove('is-dragging', 'swiping'); document.body.classList.remove('reordering'); document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
      if (mode === 'drag') suppressClickUntil = Date.now() + 700;
      if (e.type !== 'pointerup') return;
      if (mode === 'swipe' && Math.abs(dx) >= Math.min(70, row.clientWidth * .22)) revealDelete(row, dx);
      else if (mode === 'swipe') closeDelete(row);
      else if (mode === 'drag' && targetId) reorderArticle(item.id, targetId);
    };
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  });
  row.addEventListener('contextmenu', e => e.preventDefault());
}
select.onchange = () => { selectedCategory = select.value; renderArticles(); };
document.getElementById('cancelCategory').onclick = () => dialog.close();
nameInput.oninput = () => { nameInput.setCustomValidity(''); error.textContent = ''; };
document.getElementById('categoryForm').onsubmit = event => { event.preventDefault(); const name = nameInput.value.trim(); if (!name) { nameInput.setCustomValidity('Bitte einen Namen eingeben.'); nameInput.reportValidity(); return; } if (categories.some(existing => existing.localeCompare(name, 'de', { sensitivity: 'accent' }) === 0)) { error.textContent = 'Diese Kategorie gibt es bereits.'; return; } categories.push(name); persist('stack-categories-v1', categories); recordHistory('1 Kategorie hinzugefügt: '+name,{kind:'category',name}); selectedCategory = name; renderCategories(); renderArticles(); dialog.close(); };
window.addEventListener('hashchange', renderPage);
renderCategories(); renderArticles(); renderPage();
window.addEventListener('touchmove', event => { if (document.body.classList.contains('reordering')) event.preventDefault(); }, { passive: false });

function renderSavedLists() {
  const container = document.getElementById('savedLists');
  container.replaceChildren();
  const saved = read('stack-saved-lists-v1', []);
  if (!Array.isArray(saved) || !saved.length) { const empty = document.createElement('p'); empty.className = 'empty-articles'; empty.textContent = 'Noch keine Listen gespeichert. Speichere eine Zählung über „Speichern“ unter Zählung.'; container.append(empty); return; }
  saved.forEach(list => {
    const details = document.createElement('details'); details.className = 'saved-list';
    const summary = document.createElement('summary'); summary.textContent = formatListDate(list.createdAt);
    details.append(summary);
    list.items.forEach(item => { const row = document.createElement('div'); row.className = 'saved-count-row'; const name = document.createElement('span'); name.textContent = item.name; const count = document.createElement('strong'); count.textContent = String(item.count); row.append(name,count); details.append(row); });
    details.addEventListener('toggle', updateListDock);
    container.append(details);
  });
}
document.getElementById('saveCounting').onclick = () => {
  const status = document.getElementById('saveCountStatus');
  const saved = read('stack-saved-lists-v1', []);
  const lists = Array.isArray(saved) ? saved : [];
  const counts = readCounts(), order = readCountOrder();
  const items = [...articles].sort((a,b) => { const ai=order.indexOf(a.id),bi=order.indexOf(b.id); return (ai<0?order.length:ai)-(bi<0?order.length:bi); }).map(item => ({...item, count:Number.isSafeInteger(counts[item.id]) && counts[item.id]>=0 ? counts[item.id] : 0}));
  const now = new Date();
  const list = { id:crypto.randomUUID(), name:formatListDate(now.toISOString()), createdAt:now.toISOString(), items };
  try { localStorage.setItem('stack-saved-lists-v1', JSON.stringify([list,...lists])); status.textContent = 'Zählung gespeichert. '; const link = document.createElement('a'); link.href = '#listen'; link.textContent = 'Liste ansehen'; status.replaceChildren(document.createTextNode('Zählung gespeichert. '),link); }
  catch { status.textContent = 'Speichern fehlgeschlagen. Bitte den Browserspeicher prüfen.'; }
};

function closeDelete(row) {
  row.classList.remove('delete-open', 'delete-left');
  row.querySelector('.article-info').style.transform = '';
  row.querySelector('.delete-confirm').hidden = true;
}
function revealDelete(row, direction) {
  document.querySelectorAll('.article-row.delete-open').forEach(other => { if (other !== row) closeDelete(other); });
  row.classList.add('delete-open');
  row.classList.toggle('delete-left', direction > 0);
  row.querySelector('.article-info').style.transform = `translateX(${direction > 0 ? 104 : -104}px)`;
  row.querySelector('.delete-confirm').hidden = false;
}
document.addEventListener('click', event => {
  document.querySelectorAll('.article-row.delete-open').forEach(row => { if (!row.contains(event.target)) closeDelete(row); });
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelectorAll('.article-row.delete-open').forEach(closeDelete); });

function formatListDate(value) {
  return new Date(value).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Berlin' });
}
function updateListDock() {
  const dock = document.getElementById('listDock');
  if (location.hash !== '#listen') { dock.hidden = true; return; }
  const headerBottom = document.querySelector('header').getBoundingClientRect().bottom;
  const active = [...document.querySelectorAll('.saved-list[open]')].find(details => {
    const title = details.querySelector('summary').getBoundingClientRect();
    const rect = details.getBoundingClientRect();
    return title.bottom <= headerBottom && rect.bottom > headerBottom + 55 && rect.top < innerHeight;
  });
  dock.hidden = !active;
  if (!active) return;
  dock.textContent = '▴ ' + active.querySelector('summary').textContent;
  dock.setAttribute('aria-label', active.querySelector('summary').textContent + ' zuklappen');
  dock.onclick = () => { active.open = false; dock.hidden = true; const summary = active.querySelector('summary'); summary.scrollIntoView({block:'start'}); summary.focus({preventScroll:true}); };
}
function updateHeaderMetrics() {
  document.documentElement.style.setProperty('--header-height', document.querySelector('header').getBoundingClientRect().height + 'px');
  updateListDock();
}
window.addEventListener('scroll', updateListDock, {passive:true});
window.addEventListener('resize', updateHeaderMetrics);
window.addEventListener('hashchange', updateListDock);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateHeaderMetrics).observe(document.querySelector('header'));
updateHeaderMetrics();

