function evaluationValues(){
  return {
    cumplimiento_diligencia:Number($('ev_cumplimiento_diligencia').value)||0,
    responsabilidad:Number($('ev_responsabilidad').value)||0,
    comunicacion:Number($('ev_comunicacion').value)||0,
    uso_recursos:Number($('ev_uso_recursos').value)||0
  };
}

function evaluationScore(c){
  return Number((c.cumplimiento_diligencia*.40+c.responsabilidad*.35+c.comunicacion*.20+c.uso_recursos*.05).toFixed(2));
}

function updateEvaluationTotal(){
  const c=evaluationValues(),score=evaluationScore(c);
  $('evalTotal').textContent=score.toFixed(2)+' / 100';
  document.querySelectorAll('.score-box').forEach((el,i)=>{
    const vals=[c.cumplimiento_diligencia,c.responsabilidad,c.comunicacion,c.uso_recursos],weights=[.40,.35,.20,.05];
    el.value=(vals[i]*weights[i]).toFixed(2);
  });
  return score;
}

document.querySelectorAll('.eval-score').forEach(x=>x.addEventListener('input',updateEvaluationTotal));

function clearEvaluation(){
  ['ev_cumplimiento_diligencia','ev_responsabilidad','ev_comunicacion','ev_uso_recursos'].forEach(id=>$(id).value=0);
  $('evalObs').value='';
  $('evalDiligence').value='';
  $('evaluationFormTitle').textContent='Nueva evaluación';
  $('saveEvaluation').textContent='Guardar evaluación';
  $('saveEvaluation').dataset.editId='';
  updateEvaluationTotal();
}
$('clearEvaluation').onclick=clearEvaluation;

function formatDiligenceOption(d,p,ev){
  const evaluator=profiles.find(x=>String(x.id)===String(d.evaluador_id));
  const state=ev?'EVALUADA':'PENDIENTE';
  return `<option value="${d.id}">#${d.id} · ${esc(d.date||'')} · ${esc(p?.full_name||d.colaborador||'Mensajero')} · ${esc(d.destino||'')} · ${state}</option>`;
}

async function loadEvaluationData(){
  if(!user)return;
  await loadProfiles();
  fillCollaboratorSelects();  const {data:allDiligencias,error:dErr}=await sb.from('diligencias').select('id,date,month,q,colaborador,colaborador_id,evaluador_id,destino,motivo,salida,regreso,obs,aprob,operational_status,started_at,finished_at').order('date',{ascending:false}).limit(2000);
  if(dErr){$('evaluationPendingList').innerHTML='<div class="empty">No se pudieron cargar las diligencias asignadas.</div>';return}
  const {data:evs,error:eErr}=await sb.from('evaluaciones').select('*').order('created_at',{ascending:false}).limit(2000);
  if(eErr){$('evaluationList').innerHTML='<div class="empty">No se pudieron cargar las evaluaciones.</div>';return}
  const evaluationsArr=evs||[];
  const evalByDiligence=new Map(evaluationsArr.filter(x=>x.diligencia_id!=null).map(x=>[String(x.diligencia_id),x]));
  // Las diligencias anuladas no deben aparecer como pendientes ni ser evaluables.
  let visible=(allDiligencias||[]).filter(d=>String(d.aprob||'').trim().toUpperCase()!=='ANULADO');
  if(isEvaluator()) visible=visible.filter(d=>String(d.evaluador_id)===String(user.id));
  if(isOperator()) visible=visible.filter(d=>String(d.colaborador_id)===String(user.id));
  const month=$('evalMonth')?.value||today().slice(0,7);
  if($('evalMonth')) $('evalMonth').value=month;
  const [anio,mes]=month.split('-').map(Number);
  visible=visible.filter(d=>String(d.month||'')===month);

  const pending=visible.filter(d=>!evalByDiligence.has(String(d.id)));
  const evaluated=visible.filter(d=>evalByDiligence.has(String(d.id)));
  const operatorProfile=profiles.find(p=>String(p.id)===String(user.id));

  if($('evalDiligence')){
    const prev=$('evalDiligence').value;
    const choices=(isAdmin()?visible:pending);
    $('evalDiligence').innerHTML=choices.length?choices.map(d=>formatDiligenceOption(d,profiles.find(p=>String(p.id)===String(d.colaborador_id)),evalByDiligence.get(String(d.id)))).join(''):'<option value="">No hay diligencias disponibles</option>';
    if(prev && choices.some(d=>String(d.id)===String(prev))) $('evalDiligence').value=prev;
    else if(choices.length) $('evalDiligence').value=choices[0].id;
  }

  $('evaluationPendingList').innerHTML=pending.length?pending.map(d=>{
    const p=profiles.find(x=>String(x.id)===String(d.colaborador_id));
    const ev=profiles.find(x=>String(x.id)===String(d.evaluador_id));
    return `<article class="entry"><div class="entrytop"><div><h3>Diligencia #${d.id} · ${esc(d.destino||'')}</h3><p>${esc(d.date||'')} · ${esc(p?.full_name||d.colaborador||'')} · ${esc(d.motivo||'')}</p></div><span class="pill">PENDIENTE</span></div><p>Evaluador asignado: ${esc(ev?.full_name||ev?.email||d.evaluador_id||'')}</p><div class="actions"><button class="btn secondary" type="button" onclick="showDiligencePhotos('${d.id}')">📷 Ver evidencias</button><button class="btn primary" type="button" onclick="selectEvaluationDiligence(${d.id})">Evaluar</button></div></article>`;
  }).join(''):'<div class="empty">No hay diligencias pendientes de evaluación para este período.</div>';

  const listRows=isAdmin()?visible:evaluated;
  $('evaluationList').innerHTML=listRows.filter(d=>evalByDiligence.has(String(d.id))).map(d=>{
    const x=evalByDiligence.get(String(d.id));
    const p=profiles.find(z=>String(z.id)===String(d.colaborador_id));
    const ev=profiles.find(z=>String(z.id)===String(x.evaluado_por));
    return `<article class="entry"><div class="entrytop"><div><h3>Diligencia #${d.id} · ${esc(p?.full_name||d.colaborador||'')}</h3><p>${esc(d.date||'')} · ${esc(d.destino||'')} · ${esc(x.periodo||'')}</p></div><span class="pill">${Number(x.puntuacion).toFixed(2)}/100</span></div><p>Evaluador: ${esc(ev?.full_name||ev?.email||x.evaluado_por)}</p><div class="actions"><button class="btn secondary" type="button" onclick="showDiligencePhotos('${d.id}')">📷 Ver evidencias</button></div>${x.observaciones?`<p>${esc(x.observaciones)}</p>`:''}<p>Registrada: ${new Date(x.created_at).toLocaleString('es-PA')}</p>${isAdmin()?`<div class="actions"><button class="btn secondary" type="button" onclick="editEvaluation('${x.id}',${d.id})">Corregir evaluación</button></div>`:''}</article>`;
  }).join('')||'<div class="empty">No hay evaluaciones registradas para este período.</div>';

  const performed=visible.length, evaluatedCount=evaluated.length, pendingCount=pending.length, coverage=performed?((evaluatedCount/performed)*100):0;
  const avg=evaluatedCount?(evaluated.reduce((sum,d)=>sum+Number(evalByDiligence.get(String(d.id)).puntuacion||0),0)/evaluatedCount):null;
  $('evaluationCoverage').innerHTML=`<div class="stat"><span>Realizadas</span><strong>${performed}</strong></div><div class="stat"><span>Evaluadas</span><strong>${evaluatedCount}</strong></div><div class="stat"><span>Pendientes</span><strong>${pendingCount}</strong></div><div class="stat"><span>Cobertura</span><strong>${coverage.toFixed(2)}%</strong></div><div class="stat"><span>Promedio</span><strong>${avg===null?'—':avg.toFixed(2)}</strong></div>`;
  if($('evaluationRoleHint')){
    $('evaluationRoleHint').textContent=isEvaluator()?`Rol EVALUADOR: solo ve las diligencias asignadas a ${esc(operatorProfile?.full_name||user.email)} y puede evaluar cada diligencia una sola vez.`:isOperator()?'Rol OPERADOR: consulta sus evaluaciones y cobertura.': 'Rol ADMIN: puede consultar todas las diligencias y corregir evaluaciones.';
  }
}

window.selectEvaluationDiligence=function(id){
  if($('evalDiligence')){ $('evalDiligence').value=String(id); $('evaluationFormTitle').textContent='Evaluar diligencia #'+id; $('evalDiligence').focus(); window.scrollTo({top:0,behavior:'smooth'}); }
};

window.editEvaluation=async function(evalId,diligenceId){
  if(!isAdmin())return msg('Solo ADMIN puede corregir evaluaciones.','error');
  const x=(await sb.from('evaluaciones').select('*').eq('id',evalId).maybeSingle()).data;
  if(!x)return msg('No se encontró la evaluación.','error');
  $('evalDiligence').value=String(diligenceId);
  $('ev_cumplimiento_diligencia').value=x.criterios?.cumplimiento_diligencia??0;
  $('ev_responsabilidad').value=x.criterios?.responsabilidad??0;
  $('ev_comunicacion').value=x.criterios?.comunicacion??0;
  $('ev_uso_recursos').value=x.criterios?.uso_recursos??0;
  $('evalObs').value=x.observaciones||'';
  $('evaluationFormTitle').textContent='Corregir evaluación de diligencia #'+diligenceId;
  $('saveEvaluation').textContent='Guardar corrección';
  $('saveEvaluation').dataset.editId=evalId;
  updateEvaluationTotal();
  window.scrollTo({top:0,behavior:'smooth'});
};

$('saveEvaluation').onclick=async()=>{
  if(!(isAdmin()||isEvaluator()))return msg('Su rol no puede registrar evaluaciones.','error');
  const diligenceId=Number($('evalDiligence').value);
  if(!diligenceId)return msg('Seleccione una diligencia.','error');
  const {data:d,error:dErr}=await sb.from('diligencias').select('id,colaborador_id,month,q,date,evaluador_id').eq('id',diligenceId).maybeSingle();
  if(dErr||!d)return msg('No se pudo consultar la diligencia seleccionada.','error');
  if(isEvaluator() && String(d.evaluador_id)!==String(user.id))return msg('Esta diligencia no está asignada a este evaluador.','error');
  const criterios=evaluationValues();
  if(Object.values(criterios).some(v=>v<0||v>100))return msg('Cada criterio debe estar entre 0 y 100.','error');
  const puntuacion=evaluationScore(criterios);
  const [anio,mes]=String(d.month).split('-').map(Number);
  const periodo=Number(d.q||1)===1?'1-15':'16-FIN';
  const editId=$('saveEvaluation').dataset.editId||'';
  const row={diligencia_id:diligenceId,colaborador_id:d.colaborador_id,anio,mes,periodo,puntuacion,criterios,observaciones:$('evalObs').value.trim()||null,evaluado_por:user.id};
  let result;
  if(editId){
    if(!isAdmin())return msg('Solo ADMIN puede corregir evaluaciones.','error');
    result=await sb.from('evaluaciones').update(row).eq('id',editId);
  }else{
    result=await sb.from('evaluaciones').insert(row);
  }
  if(result.error)return msg('No se pudo guardar la evaluación: '+result.error.message,'error');
  msg(editId?'Evaluación corregida correctamente.':'Evaluación guardada correctamente.','ok');
  clearEvaluation();
  await loadEvaluationData();
};

$('evalMonth').value=$('evalMonth').value||today().slice(0,7);
$('evalMonth').onchange=loadEvaluationData;
