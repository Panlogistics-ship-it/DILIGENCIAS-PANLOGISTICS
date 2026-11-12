async function loadDashboardExtras(){
  if(!sb||!user)return;
  const put=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
  try{
    let fuelQuery=sb.from('combustible').select('id',{count:'exact',head:true});
    if(!isAdmin())fuelQuery=fuelQuery.eq('colaborador_id',user.id);
    const fuelResult=await fuelQuery;
    put('dashFuelCount',fuelResult.error?'—':String(fuelResult.count??0));
    put('dashFuelNote',fuelResult.error?'No disponible para este rol':'Registros cargados · Abrir combustible');
  }catch(_){put('dashFuelCount','—');}
  try{
    const [dRes,eRes]=await Promise.all([
      sb.from('diligencias').select('id,evaluador_id,colaborador_id,aprob'),
      sb.from('evaluaciones').select('diligencia_id')
    ]);
    if(dRes.error||eRes.error)put('dashEvalPending','—');
    else{
      const evaluated=new Set((eRes.data||[]).map(x=>String(x.diligencia_id)));
      const eligible=(dRes.data||[]).filter(d=>String(d.aprob||'').toUpperCase()!=='ANULADO'&&(!isEvaluator()||String(d.evaluador_id)===String(user.id))&&(!isOperator()||String(d.colaborador_id)===String(user.id)));
      put('dashEvalPending',String(eligible.filter(d=>!evaluated.has(String(d.id))).length));
    }
  }catch(_){put('dashEvalPending','—');}
  try{
    let incidentsQuery=sb.from('incidencias').select('id,estado',{count:'exact'}).not('estado','eq','CERRADA');
    const incidentResult=await incidentsQuery;
    put('dashAlertsCount',incidentResult.error?'—':String(incidentResult.count??(incidentResult.data||[]).length));
    put('dashAlertsNote',incidentResult.error?'No disponible para este rol':'Incidencias abiertas · Abrir alertas');
  }catch(_){put('dashAlertsCount','—');}
}


async function loadRecords(){
  if(!sb||!user)return;
  let {data,error}=await sb.from('diligencias').select('*').order('date',{ascending:false}).limit(2000);
  if(error){msg('Error al consultar: '+error.message,'error');return}
  records=data||[];render();renderDashboard();loadDashboardExtras();loadProductivityBonusDashboard();updateFormOperationalButtons();toast(`Historial actualizado (${records.length} registros).`,'ok');
}
function renderDashboard(){
  const all=records||[];const now=today();const active=all.filter(x=>String(x.aprob||'').toUpperCase()!=='ANULADO');
  const done=active.filter(x=>!!x.finished_at||String(x.operational_status||'').toUpperCase()==='FINALIZADA');
  const progress=active.filter(x=>(!!x.started_at||String(x.operational_status||'').toUpperCase()==='EN_CURSO')&&!x.finished_at&&String(x.operational_status||'').toUpperCase()!=='FINALIZADA');
  const pending=active.filter(x=>!x.started_at&&!x.finished_at&&String(x.operational_status||'').toUpperCase()!=='EN_CURSO'&&String(x.operational_status||'').toUpperCase()!=='FINALIZADA');
  const todayRows=active.filter(x=>String(x.date||'').slice(0,10)===now);
  const set=(id,v)=>{if($(id))$(id).textContent=v};
  set('dashToday',new Date().toLocaleDateString('es-PA',{timeZone:'America/Panama',weekday:'long',year:'numeric',month:'long',day:'numeric'}));
  set('dashTodayCount',todayRows.length);set('dashTodayNote',`${todayRows.length} diligencia(s) con fecha de hoy`);set('dashDoneCount',done.length);set('dashDoneNote',`${active.length?Math.round(done.length/active.length*100):0}% de las diligencias no anuladas`);set('dashProgressCount',progress.length);set('dashPendingCount',pending.length);
  set('dashHours',active.reduce((a,x)=>a+Number(x.hours||0),0).toFixed(2));set('dashAllowance','B/. '+money(active.reduce((a,x)=>a+Number(x.viatico||0),0)));
  const bars=$('dashWeekBars');if(bars){const days=[];const base=new Date();for(let i=6;i>=0;i--){const d=new Date(base);d.setDate(d.getDate()-i);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const dayRows=active.filter(x=>String(x.date||'').slice(0,10)===key);days.push({label:d.toLocaleDateString('es-PA',{timeZone:'America/Panama',weekday:'short'}).replace('.',''),done:dayRows.filter(x=>x.finished_at||String(x.operational_status||'').toUpperCase()==='FINALIZADA').length,other:dayRows.filter(x=>!x.finished_at&&String(x.operational_status||'').toUpperCase()!=='FINALIZADA').length});}const max=Math.max(1,...days.map(d=>d.done+d.other));bars.innerHTML=days.map(d=>`<div class="dash-day"><div class="dash-bar-track" title="${d.done} finalizadas, ${d.other} pendientes/en curso"><div class="dash-bar-fill" style="height:${Math.max(2,(d.done+d.other)/max*100)}%;background:linear-gradient(to top,#07945b 0%,#07945b ${d.done/(d.done+d.other||1)*100}%,#e7b64c ${d.done/(d.done+d.other||1)*100}%,#e7b64c 100%)"></div></div><span>${esc(d.label)}</span></div>`).join('');}
  const recent=$('dashRecentRows');if(recent){const rows=[...all].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,6);recent.innerHTML=rows.length?rows.map(x=>{const started=!!x.started_at||String(x.operational_status||'').toUpperCase()==='EN_CURSO'||String(x.operational_status||'').toUpperCase()==='FINALIZADA';const finished=!!x.finished_at||String(x.operational_status||'').toUpperCase()==='FINALIZADA';const annulled=String(x.aprob||'').toUpperCase()==='ANULADO';const owns=!!user&&String(x.colaborador_id)===String(user.id);const state=annulled?'Anulada':finished?'Finalizada':started?'En curso':'Pendiente';const cls=annulled?'alert':finished?'':'pending';const action=isOperator()&&owns&&!annulled?(!started?`<button class="btn primary" style="padding:5px 8px;min-height:30px;font-size:11px" onclick="startDiligence('${esc(x.id)}')">COMIENZO</button>`:!finished?`<button class="btn primary" style="padding:5px 8px;min-height:30px;font-size:11px" onclick="finishDiligence('${esc(x.id)}')">FINALIZAR</button>`:'—'):'—';return `<tr><td>${esc(x.date||'—')}</td><td>${esc(x.destino||'—')}</td><td>${esc(x.colaborador||'—')}</td><td><span class="dash-state ${cls}">${state}</span></td><td>${action}</td></tr>`}).join(''):'<tr><td colspan="5">No hay diligencias registradas.</td></tr>';}
}

function filtered(){
  let m=$('filterMonth').value,n=$('filterName').value.trim().toLowerCase();
  return records.filter(x=>(!m||x.month===m)&&(!n||(x.colaborador||'').toLowerCase().includes(n)));
}
function render(){
  let rows=filtered();
  $('count').textContent=rows.length;
  $('hours').textContent=rows.reduce((s,x)=>s+Number(x.hours||0),0).toFixed(2);
  $('allowance').textContent=money(rows.reduce((s,x)=>s+Number(x.viatico||0),0));
  $('entries').innerHTML=rows.length?rows.map(x=>{
    const started=!!x.started_at || String(x.operational_status||'').toUpperCase()==='EN_CURSO' || String(x.operational_status||'').toUpperCase()==='FINALIZADA';
    const finished=!!x.finished_at || String(x.operational_status||'').toUpperCase()==='FINALIZADA';
    const annulled=String(x.aprob||'').toUpperCase()==='ANULADO';
    const owns=!!user && String(x.colaborador_id)===String(user.id);
    const operationalStatus=annulled?'ANULADA':(finished?'FINALIZADA':(started?'EN CURSO':'PENDIENTE DE INICIO'));
    const statusClass=finished?'':(started?'pending':'pending');
    const actionButtons=isOperator()&&owns&&!annulled
      ? (!started?`<button class="btn primary" type="button" onclick="startDiligence('${esc(x.id)}')">▶ COMIENZO</button>`
        : (!finished?`<button class="btn primary" type="button" onclick="finishDiligence('${esc(x.id)}')">■ FINALIZAR DILIGENCIA</button>`:''))
      : '';
    return `<article class="entry">
      <div class="entrytop"><div><h3>${esc(x.destino)}</h3><p>${esc(x.date)} · ${esc(x.motivo)}</p></div>
      <span class="pill ${x.aprob==='Pendiente'?'pending':''}">${esc(x.aprob||'Pendiente')}</span></div>
      <p><strong>Estado operativo:</strong> <span class="pill ${statusClass}">${operationalStatus}</span></p>
      <p>${esc(x.colaborador)} · Salida: ${esc(x.salida||'—')} · Regreso: ${esc(x.regreso||'—')} · ${Number(x.hours||0).toFixed(2)} h</p>
      ${x.started_at?`<p><small>Comienzo registrado: ${esc(new Date(x.started_at).toLocaleString('es-PA',{timeZone:'America/Panama'}))}</small></p>`:''}
      ${x.finished_at?`<p><small>Finalización registrada: ${esc(new Date(x.finished_at).toLocaleString('es-PA',{timeZone:'America/Panama'}))}</small></p>`:''}
      <p>Viático B/. ${money(x.viatico)} · Sobre B/. ${money(x.sobre)}</p>
      ${x.obs?`<p>${esc(x.obs)}</p>`:''}
      <div class="entrybuttons">${actionButtons}<button class="btn secondary" type="button" onclick="showDiligencePhotos('${esc(x.id)}')">📷 Ver evidencias</button>${isAdmin()?`<button class="btn secondary" type="button" onclick="edit('${esc(x.id)}')">Editar</button>${annulled?'':`<button class="btn secondary" type="button" onclick="annul('${esc(x.id)}')">Anular</button>`}`:''}</div>
    </article>`;
  }).join(''):'<div class="empty">No hay registros para este filtro.</div>';
}
$('filterMonth').value=today().slice(0,7);$('evalMonth').value=today().slice(0,7);$('resultMonth').value=today().slice(0,7);$('fuelDate').value=today();
$('filterMonth').onchange=render;$('filterName').oninput=render;$('refresh').onclick=loadRecords;

window.edit=async id=>{
  let x=records.find(r=>String(r.id)===String(id));if(!x)return;
  editing=x.id;activeFormDiligenceId=x.id;$('entryId').value=x.id;fields.forEach(k=>$(k).value=x[k]??'');updateFormOperationalButtons();
  $('formTitle').textContent='Editar diligencia';tab('formView');window.scrollTo({top:0,behavior:'smooth'});
};

window.annul=async id=>{
  if(!isAdmin())return msg('Solo ADMIN puede anular diligencias.','error');
  const x=records.find(r=>String(r.id)===String(id));
  if(!x)return msg('No se encontró la diligencia.','error');
  if(String(x.aprob||'').toUpperCase()==='ANULADO')return msg('La diligencia ya está anulada.','error');
  const motivo=prompt('Indique el motivo de la anulación:');
  if(motivo===null)return;
  const reason=motivo.trim();
  if(!reason)return msg('Debe indicar un motivo para anular la diligencia.','error');
  if(!confirm('¿Confirma ANULAR esta diligencia?\n\nMotivo: '+reason))return;
  const obsPrev=String(x.obs||'').trim();
  const stamp='ANULACIÓN ADMIN: '+reason;
  const obs=obsPrev?obsPrev+'\n'+stamp:stamp;
  const {error}=await sb.from('diligencias').update({aprob:'ANULADO',obs}).eq('id',id);
  if(error)return msg('No se pudo anular: '+error.message,'error');
  msg('Diligencia anulada y registrada en auditoría.','ok');
  await loadRecords();
};


