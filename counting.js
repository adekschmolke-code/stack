function readCounts() {
  try {
    const saved = JSON.parse(localStorage.getItem('stack-counts-v1'));
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch { return {}; }
}
function renderCounting() {
  const grid = document.getElementById('counting');
  grid.replaceChildren();
  const counts = readCounts();
  const order = readCountOrder();
  const sorted = [...articles].sort((a, b) => { const ai = order.indexOf(a.id), bi = order.indexOf(b.id); return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi); });
  const visible = sorted.filter(item => !selectedCategory || (selectedCategory === '__unassigned__' ? !item.category : item.category === selectedCategory));
  visible.forEach(item => {
    const card = document.createElement('article');
    card.className = 'counter-card';
    card.dataset.id = item.id;
    card.tabIndex = 0;
    card.setAttribute('aria-label', item.name + ': Halten zum Verschieben; Alt und Pfeiltasten zum Sortieren.');
    bindCountDrag(card, item);
    const name = document.createElement('h2');
    name.textContent = item.name;
    const category = document.createElement('small');
    category.className = 'count-category';
    category.textContent = item.category || 'Nicht zugeteilt';
    const controls = document.createElement('div');
    controls.className = 'counter-controls';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.setAttribute('aria-label', item.name + ': Zählung verringern');
    const output = document.createElement('input');
    output.type = 'number'; output.min = '0'; output.max = String(Number.MAX_SAFE_INTEGER); output.step = '1'; output.inputMode = 'numeric'; output.className = 'quantity-input';
    output.setAttribute('aria-label', item.name + ': Zählerstand');

    let count = Number.isSafeInteger(counts[item.id]) && counts[item.id] >= 0 ? counts[item.id] : 0;
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'primary';
    plus.textContent = '+';
    plus.setAttribute('aria-label', item.name + ': Zählung erhöhen');
    const refresh = () => { output.value = String(count); minus.disabled = count === 0; plus.disabled = count === Number.MAX_SAFE_INTEGER; };
    const change = delta => {
      count = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, count + delta));
      counts[item.id] = count;

      try { localStorage.setItem('stack-counts-v1', JSON.stringify(counts)); }
      catch { status.textContent = 'Zählerstand kann nicht dauerhaft gespeichert werden.'; }
      output.setCustomValidity(''); status.textContent = ''; refresh();
    };
    const status = document.getElementById('countStatus');
    status.className = 'counter-status';
    status.setAttribute('role', 'status');
    output.oninput = () => {
      const value = output.value.trim();
      const quantity = Number(value);
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(quantity) || quantity < 0) {
        output.setCustomValidity('Bitte eine ganze Zahl ab 0 eingeben.');
        status.textContent = 'Bitte eine ganze Zahl ab 0 eingeben.';
        return;
      } count = quantity; output.setCustomValidity(''); status.textContent = '';
      counts[item.id] = count;

      try { localStorage.setItem('stack-counts-v1', JSON.stringify(counts)); }
      catch { status.textContent = 'Zählerstand kann nicht dauerhaft gespeichert werden.'; }
      minus.disabled = count === 0; plus.disabled = count === Number.MAX_SAFE_INTEGER;
    };
    output.onblur = () => { output.setCustomValidity(''); status.textContent = ''; refresh(); };
    output.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); output.blur(); } if (event.key === 'Escape') { refresh(); output.blur(); } };
    minus.onclick = () => change(-1);
    plus.onclick = () => change(1);
    minus.addEventListener('click', event => { if (Date.now() < countSuppressUntil) event.stopImmediatePropagation(); }, true);
    plus.addEventListener('click', event => { if (Date.now() < countSuppressUntil) event.stopImmediatePropagation(); }, true);
    refresh();
    controls.append(minus, output, plus);
    card.append(name, category, controls);
    grid.append(card);
  });
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-articles';
    empty.textContent = 'Keine Artikel vorhanden.';
    grid.append(empty);
  }
}


var countSuppressUntil = 0;
function readCountOrder() {
  try { const order = JSON.parse(localStorage.getItem('stack-count-order-v1')); return Array.isArray(order) ? order.filter(id => typeof id === 'string') : []; } catch { return []; }
}
function reorderCount(id, targetId) {
  const stored = readCountOrder();
  const ids = [...articles].sort((a,b) => { const ai=stored.indexOf(a.id), bi=stored.indexOf(b.id); return (ai<0?stored.length:ai)-(bi<0?stored.length:bi); }).map(item => item.id);
  const from = ids.indexOf(id), to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  persist('stack-count-order-v1', ids);
  renderCounting();
}
function bindCountDrag(card, item) {
  card.addEventListener('keydown', event => {
    if (event.target !== card || !event.altKey || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault(); const cards = [...document.getElementById('counting').children]; const index = cards.indexOf(card); const target = cards[index + (['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1)];
    if (target?.dataset.id) { reorderCount(item.id, target.dataset.id); [...document.getElementById('counting').children].find(el => el.dataset.id === item.id)?.focus(); }
  });
  card.addEventListener('contextmenu', event => event.preventDefault());
  card.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('input')) return;
    let dragging = false, targetId = null;
    const x = event.clientX, y = event.clientY;
    const timer = setTimeout(() => { dragging = true; countSuppressUntil = Date.now() + 1000; card.classList.add('count-dragging'); document.body.classList.add('reordering'); card.setPointerCapture(event.pointerId); }, 450);
    const move = e => {
      if (e.pointerId !== event.pointerId) return;
      if (!dragging) { if (Math.hypot(e.clientX-x,e.clientY-y)>9) clearTimeout(timer); return; }
      e.preventDefault(); card.style.transform = `translateY(${e.clientY-y}px)`;
      card.style.pointerEvents = 'none'; const target = document.elementFromPoint(e.clientX,e.clientY)?.closest('.counter-card'); card.style.pointerEvents = '';
      document.querySelectorAll('.count-drop-target').forEach(el=>el.classList.remove('count-drop-target'));
      targetId = target && target.dataset.id !== item.id ? target.dataset.id : null; if (targetId) target.classList.add('count-drop-target');
      if (e.clientY<80) window.scrollBy(0,-12); else if(e.clientY>innerHeight-80) window.scrollBy(0,12);
    };
    const end = e => {
      if(e.pointerId!==event.pointerId)return;
      clearTimeout(timer); window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',end); window.removeEventListener('pointercancel',end);
      card.style.transform=''; card.classList.remove('count-dragging'); document.body.classList.remove('reordering'); document.querySelectorAll('.count-drop-target').forEach(el=>el.classList.remove('count-drop-target'));
      if(dragging) { countSuppressUntil=Date.now()+700; if(e.type==='pointerup' && targetId) reorderCount(item.id,targetId); }
    };
    window.addEventListener('pointermove',move,{passive:false}); window.addEventListener('pointerup',end); window.addEventListener('pointercancel',end);
  });
}




