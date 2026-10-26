function getHistory() {
  try { const entries=JSON.parse(localStorage.getItem('stack-history-v1')); return Array.isArray(entries)?entries.filter(entry => ['field','article','category'].includes(entry.change?.kind)):[]; } catch { return []; }
}
function storeHistory(entries) { persist('stack-history-v1',entries); }
function undoIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M9 5 3 11l6 6M3 11h10a7 7 0 0 1 7 7"/></svg>'; }
function recordHistory(label, change) {
  if(!['field','article','category'].includes(change.kind)) return;
  const entries=getHistory();
  const last=entries[0], now=Date.now();
  if(last && !last.undone && last.change.kind===change.kind && ['field','count'].includes(change.kind) && last.change.id===change.id && last.change.field===change.field && now-last.time<15000) {
    last.change.after=change.after; last.label=label; last.time=now;
  } else entries.unshift({id:crypto.randomUUID(),time:now,label,change,undone:false});
  storeHistory(entries); showChangeNotice(entries[0]);
  if(document.getElementById('historyDialog').open) renderHistory();
}
function showChangeNotice(entry, message) {
  const notice=document.getElementById('changeNotice'); notice.replaceChildren();
  const text=document.createElement('span'); text.textContent=message || entry.label; text.title=text.textContent; notice.append(text);
  if(!message && !entry.undone) { const undo=document.createElement('button'); undo.type='button'; undo.className='icon-button undo-change'; undo.title='Änderung rückgängig machen'; undo.setAttribute('aria-label','Änderung rückgängig machen'); undo.innerHTML=undoIcon(); undo.onclick=()=>undoHistory(entry.id); notice.append(undo); }
}
function undoHistory(id) {
  const entries=getHistory(), entry=entries.find(item=>item.id===id); if(!entry || entry.undone)return;
  const change=entry.change; let conflict=false;
  if(change.kind==='field') {
    const article=articles.find(item=>item.id===change.id);
    if(!article || article[change.field]!==change.after) conflict=true;
    else {article[change.field]=change.before; saveArticles();}
  } else if(change.kind==='article') {
    const index=articles.findIndex(item=>item.id===change.id);
    if(change.before===null) {
      if(index<0 || JSON.stringify(articles[index])!==JSON.stringify(change.after)) conflict=true;
      else { articles.splice(index,1); saveArticles(); }
    } else {
      if(index>=0)conflict=true;
      else {articles.splice(Math.min(change.index,articles.length),0,change.before);saveArticles();}
    }
  } else if(change.kind==='category') {
    if(articles.some(item=>item.category===change.name))conflict=true;
    else {categories=categories.filter(name=>name!==change.name);persist('stack-categories-v1',categories);if(selectedCategory===change.name)selectedCategory='';}
  } else if(change.kind==='count') {
    const counts=readCounts(); const current=counts[change.id]||0;
    if(current!==change.after)conflict=true;
    else {counts[change.id]=change.before;persist('stack-counts-v1',counts);}
  }
  if(conflict) {showChangeNotice(entry,'Spätere Änderung zuerst zurücksetzen.');return;}
  entry.undone=true;storeHistory(entries);showChangeNotice(entry,'Änderung zurückgesetzt.');renderCategories();renderArticles();renderHistory();
}
function renderHistory() {
  const container=document.getElementById('historyEntries');container.replaceChildren();
  const entries=getHistory();
  if(!entries.length){const empty=document.createElement('p');empty.className='history-empty';empty.textContent='Noch keine Änderungen vorhanden.';container.append(empty);return;}
  entries.forEach(entry=>{
    const row=document.createElement('div');row.className='history-entry';
    const info=document.createElement('div'); const text=document.createElement('p');text.textContent=entry.label;
    const time=document.createElement('small');time.textContent=new Date(entry.time).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'})+(entry.undone?' · Zurückgesetzt':'');info.append(text,time);row.append(info);
    if(!entry.undone){const undo=document.createElement('button');undo.type='button';undo.className='icon-button';undo.title='Rückgängig';undo.setAttribute('aria-label',entry.label+' rückgängig machen');undo.innerHTML=undoIcon();undo.onclick=()=>undoHistory(entry.id);row.append(undo);}
    container.append(row);
  });
}
document.getElementById('openHistory').onclick=()=>{renderHistory();document.getElementById('historyDialog').showModal();};
document.getElementById('closeHistory').onclick=()=>document.getElementById('historyDialog').close();
