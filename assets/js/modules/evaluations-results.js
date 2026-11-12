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

function componentCard(title,score,weight,colorValue){
  const available=score!==null && score!==undefined && Number.isFinite(Number(score));
  const s=available?Number(score):0;
  return `<div class="component">
    <div class="component-head"><span>${title}</span><span>${available?s.toFixed(2):'Pendiente'}${available?' / 100':''}</span></div>
    <div class="bar"><span style="width:${Math.max(0,Math.min(100,s))}%"></span></div>
    <p class="hint">Peso: ${weight}% · Aporte: ${available?(s*weight/100).toFixed(2):'—'} puntos</p>
  </div>`;
}

async function loadResultData(){
  if(!user)return;
  await loadProfiles();
  fillCollaboratorSelects();
  $('resultMonth').value=$('resultMonth').value||today().slice(0,7);
  const month=$('resultMonth').value;
  const selected=$('resultCollaborator').value;
  const period=$('resultPeriod')?.value||'1-15';
  const [anio,mes]=month.split('-').map(Number);
  const [start,end]=reportPeriodDates(month,period);
  const collaboratorId=selected||(isAdmin()?null:user.id);
  const operators=profiles.filter(p=>p.active!==false && String(p.role||'').toUpperCase()==='OPERADOR');
  const targets=collaboratorId?operators.filter(p=>p.id===collaboratorId):operators;
  if(!targets.length){$('resultsContent').innerHTML='<div class="empty">No hay mensajeros disponibles para consultar.</div>';return}
  const [{data:allDiligences,error:dErr},{data:allFuel,error:fErr},{data:allEvaluations,error:eErr},{data:appSettings,error:sErr}]=await Promise.all([
    sb.from('diligencias').select('*').gte('date',start).lte('date',end).order('date'),
    sb.from('combustible').select('*').gte('fecha',start).lte('fecha',end),
    sb.from('evaluaciones').select('*').eq('anio',anio).eq('mes',mes).eq('periodo',period),
    sb.from('app_settings').select('key,value')
  ]);
  if(dErr||fErr||eErr||sErr){
    const err=dErr||fErr||eErr||sErr;
    $('resultsContent').innerHTML=`<div class="status error">No se pudieron calcular los resultados: ${esc(err.message)}</div>`;
    return;
  }
  const settings={};(appSettings||[]).forEach(x=>settings[x.key]=x.value);
  const periodTargetSetting=Number(settings.meta_diligencias_quincenal||0);
  const hoursTarget=Number(settings.horas_objetivo_por_diligencia||0);
  const fuelObjective=Number(settings.costo_combustible_objetivo_por_diligencia||0);
  const target=periodTargetSetting>0?periodTargetSetting:null;
  const periodLabel=period==='1-15'?'1 al 15':'16 al '+new Date(anio,mes,0).getDate();
  const rows=targets.map(profile=>{
    const name=profile.full_name||profile.email||'Mensajero';
    const diligences=(allDiligences||[]).filter(x=>
      (x.colaborador_id===profile.id || x.colaborador===name) &&
      String(x.aprob||'').toUpperCase()!=='ANULADO'
    );
    const fuel=(allFuel||[]).filter(x=>x.colaborador_id===profile.id);
    const profileEvaluations=(allEvaluations||[]).filter(x=>String(x.colaborador_id)===String(profile.id)&&x.puntuacion!==null&&x.puntuacion!==undefined&&Number.isFinite(Number(x.puntuacion)));
    const evaluation=profileEvaluations.length?{puntuacion:profileEvaluations.reduce((sum,x)=>sum+Number(x.puntuacion),0)/profileEvaluations.length,count:profileEvaluations.length}:null;
    const count=diligences.length;
    const compliance=target!==null?Math.min(100,count/target*100):null;
    const hours=diligences.reduce((a,x)=>a+Number(x.hours||0),0);
    const targetHours=count*hoursTarget;
    const efficiency=targetHours>0&&hours>0?Math.min(100,targetHours/hours*100):null;
    const fuelCost=fuel.reduce((a,x)=>a+Number(x.costo_total||0),0);
    const fuelControl=fuelObjective>0&&count>0&&fuelCost>0?Math.min(100,(fuelObjective*count)/fuelCost*100):null;
    const components=[
      {name:'Cumplimiento de diligencias',score:compliance,weight:25},
      {name:'Evaluación de desempeño',score:evaluation?Number(evaluation.puntuacion):null,weight:40},
      {name:'Eficiencia de tiempo',score:efficiency,weight:20},
      {name:'Control de combustible/costos',score:fuelControl,weight:15}
    ];
    const available=components.filter(c=>c.score!==null&&Number.isFinite(c.score));
    const availableWeight=available.reduce((a,c)=>a+c.weight,0);
    const points=available.reduce((a,c)=>a+c.score*c.weight/100,0);
    const productivity=availableWeight?available.reduce((a,c)=>a+c.score*c.weight,0)/availableWeight:null;
    const status=availableWeight===100?'COMPLETO':'PROVISIONAL';
    const isJhonatan=/jhonatan\s+valencia/i.test(name);
    const bonus=isJhonatan&&evaluation?Math.max(0,Math.min(100,Number(evaluation.puntuacion)))/100*75:null;
    return {profile,name,count,target,compliance,efficiency,fuelCost,productivity,points,status,availableWeight,components,periodLabel,evaluationCount:profileEvaluations.length,bonus,isJhonatan};
  });
  $('resultsContent').innerHTML=rows.map(r=>{
    const prod=r.productivity;
    const estado=r.status;
    return `<div class="panel">
      <div class="entrytop"><div><h2>${esc(r.name)}</h2><p class="hint">Quincena ${r.periodLabel} · ${anio}-${String(mes).padStart(2,'0')} · Meta quincenal: ${r.target===null?'Pendiente de configurar':r.target.toFixed(0)+' diligencias'}</p></div>
      <span class="badge ${estado==='COMPLETO'?'ok':'warn'}">${esc(estado)}</span></div>
      <div class="kpi-grid" style="margin-top:12px">
        <div class="kpi"><span>🏆 Productividad</span><strong>${prod===null?'—':prod.toFixed(2)}</strong></div>
        <div class="kpi"><span>Diligencias del período</span><strong>${r.count}</strong></div>
        <div class="kpi"><span>Cumplimiento de meta</span><strong>${r.compliance===null?'Pendiente':r.compliance.toFixed(2)+'%'}</strong></div>
        <div class="kpi"><span>Peso disponible</span><strong>${r.availableWeight}%</strong></div>
      </div>
      ${r.isJhonatan?`<div class="bonus-kpi" style="margin:10px 0 14px"><span>💰 Bono de productividad · Quincena ${esc(r.periodLabel)}</span><strong>${r.bonus===null?'Pendiente de evaluación':'B/. '+money(r.bonus)}</strong><small>Evaluación: ${r.bonus===null?'sin puntuación disponible':Number(r.evaluationCount? r.components[1].score||0:0).toFixed(2)+'%'} · 100% = B/. 75.00</small></div>`:''}
      <div class="cone-wrap">
        <div class="cone-panel">
          <div class="cone-title">Nivel de productividad</div>
          <div class="cone"><div class="cone-shape"><div class="cone-fill" style="height:${prod===null?0:Math.max(0,Math.min(100,prod))}%"></div><div class="cone-lines"></div><div class="cone-label">${prod===null?'—':prod.toFixed(1)}<small>de 100 puntos</small></div></div></div>
          <div class="cone-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
        </div>
        <div><div class="result-summary"><div><div class="result-subtitle">Puntos obtenidos</div><strong>${r.points.toFixed(2)}</strong></div><span class="result-status ${estado==='COMPLETO'?'complete':''}">${esc(estado)}</span></div>
          <div class="legend">
            <div><span>Diligencias · 25%</span><strong>${r.compliance===null?'Pendiente':r.compliance.toFixed(2)}</strong></div>
            <div><span>Evaluación · 40%${r.evaluationCount?` · ${r.evaluationCount} registro(s)`:''}</span><strong>${r.components[1].score===null?'Pendiente':Number(r.components[1].score).toFixed(2)}</strong></div>
            <div><span>Eficiencia · 20%</span><strong>${r.efficiency===null?'Pendiente':r.efficiency.toFixed(2)}</strong></div>
            <div><span>Combustible · 15%</span><strong>${r.components[3].score===null?'Pendiente':Number(r.components[3].score).toFixed(2)}</strong></div>
          </div>
        </div>
      </div>
      ${r.components.map(c=>componentCard(c.name,c.score,c.weight)).join('')}
      <p class="hint">Puntos ponderados disponibles: ${r.points.toFixed(2)}. Resultado ${estado.toLowerCase()} mientras existan componentes pendientes. Combustible registrado en el período: B/. ${money(r.fuelCost)}.</p>
    </div>`;
  }).join('');
}
$('loadResults').onclick=loadResultData;
$('resultMonth').onchange=loadResultData;
$('resultPeriod').onchange=loadResultData;
$('resultCollaborator').onchange=loadResultData;


