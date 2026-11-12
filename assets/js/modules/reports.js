function reportWorkingDays(startDate,endDate){
  let count=0;
  const d=new Date(startDate+'T00:00:00'), end=new Date(endDate+'T00:00:00');
  while(d<=end){const day=d.getDay();if(day!==0&&day!==6)count++;d.setDate(d.getDate()+1);}
  return count;
}
function reportPeriodDates(month,period){
  const [y,m]=month.split('-').map(Number), last=new Date(y,m,0).getDate();
  return period==='1-15'?[`${month}-01`,`${month}-15`]:[`${month}-16`,`${month}-${String(last).padStart(2,'0')}`];
}
function reportNameFor(id){const p=profiles.find(x=>x.id===id);return p?.full_name||p?.email||id||'Mensajero';}
async function loadReportSelectors(){
  await loadProfiles();
  const select=$('reportCollaborator');
  const current=select.value;
  const operators=profiles.filter(p=>p.active && p.role==='OPERADOR');
  select.innerHTML=operators.map(p=>`<option value="${esc(p.id)}">${esc(p.full_name||p.email)}</option>`).join('');
  if(current && operators.some(p=>p.id===current)) select.value=current;
  else if(!isAdmin() && user?.id && operators.some(p=>p.id===user.id)) select.value=user.id;
  else if(operators.length) select.value=operators[0].id;
  $('reportMonth').value=$('reportMonth').value||today().slice(0,7);
}
async function generateQuincenalReport(){
  if(!user)return;
  await loadReportSelectors();
  const month=$('reportMonth').value||today().slice(0,7), period=$('reportPeriod').value||'1-15';
  const collaboratorId=$('reportCollaborator').value||(isAdmin()?null:user.id);
  if(!collaboratorId)return msg('Seleccione un mensajero.','error');
  const [start,end]=reportPeriodDates(month,period), [anio,mes]=month.split('-').map(Number);
  const name=reportNameFor(collaboratorId);

  const [{data:diligencias,error:dErr},{data:evaluacionesQuincena,error:evaluationError},{data:fuel,error:fErr},{data:periodCfg},{data:appSettings}]=await Promise.all([
    sb.from('diligencias').select('*').gte('date',start).lte('date',end).eq('colaborador_id',collaboratorId).order('date'),
    sb.from('evaluaciones').select('*').eq('anio',anio).eq('mes',mes).eq('colaborador_id',collaboratorId).eq('periodo',period).order('created_at'),
    sb.from('combustible').select('*').gte('fecha',start).lte('fecha',end).eq('colaborador_id',collaboratorId).order('fecha'),
    sb.from('periodos_mensajero').select('*').eq('anio',anio).eq('mes',mes).eq('colaborador_id',collaboratorId).maybeSingle(),
    sb.from('app_settings').select('key,value')
  ]);
  if(evaluationError)return msg('No se pudieron cargar las evaluaciones quincenales: '+evaluationError.message,'error');
  const evaluationRecords=(evaluacionesQuincena||[]).filter(x=>x.puntuacion!==null&&x.puntuacion!==undefined&&Number.isFinite(Number(x.puntuacion)));
  const criterionKeys=['cumplimiento_diligencia','responsabilidad','comunicacion','uso_recursos'];
  const averageCriteria={};
  criterionKeys.forEach(key=>{
    const values=evaluationRecords
      .map(x=>Number(x.criterios?.[key]))
      .filter(value=>Number.isFinite(value));
    averageCriteria[key]=values.length
      ? values.reduce((sum,value)=>sum+value,0)/values.length
      : null;
  });
  const evaluation=evaluationRecords.length?{
    puntuacion:evaluationRecords.reduce((sum,x)=>sum+Number(x.puntuacion),0)/evaluationRecords.length,
    criterios:averageCriteria,
    observaciones:'',
    total_registros:evaluationRecords.length
  }:null;
  if(dErr)return msg('No se pudieron cargar las diligencias del reporte: '+dErr.message,'error');
  if(fErr)return msg('No se pudo cargar combustible del reporte: '+fErr.message,'error');

  const isJhonatan=/jhonatan\s+valencia/i.test(name);
  const productivityBonus=isJhonatan&&evaluation?Math.max(0,Math.min(100,Number(evaluation.puntuacion)))/100*75:null;
  const settings={};(appSettings||[]).forEach(x=>settings[x.key]=x.value);
  const target=Number(settings.meta_diligencias_quincenal||0)||null;
  const validDiligencias=(diligencias||[]).filter(x=>String(x.aprob||'').toUpperCase()!=='ANULADO'), count=validDiligencias.length;
  const compliance=target!==null?Math.min(100,count/target*100):null;
  const hours=validDiligencias.reduce((a,x)=>a+Number(x.hours||0),0);
  const targetHours=count*Number(settings.horas_objetivo_por_diligencia||0);
  const efficiency=targetHours>0?Math.min(100,targetHours/hours*100):null;
  const fuelCost=(fuel||[]).reduce((a,x)=>a+Number(x.costo_total||0),0);
  const fuelObjective=Number(settings.costo_combustible_objetivo_por_diligencia||0);
  const fuelControl=fuelObjective>0&&count>0?Math.min(100,(fuelObjective*count)/fuelCost*100):null;

  const components=[
    {name:'Cumplimiento de diligencias',score:compliance,weight:25},
    {name:'Evaluación de desempeño',score:evaluation?Number(evaluation.puntuacion):null,weight:40},
    {name:'Eficiencia de tiempo',score:efficiency,weight:20},
    {name:'Control de combustible/costos',score:fuelControl,weight:15}
  ];
  const available=components.filter(x=>x.score!==null&&Number.isFinite(x.score));
  const availableWeight=available.reduce((a,x)=>a+x.weight,0);
  const productivity=availableWeight?available.reduce((a,x)=>a+x.score*x.weight,0)/availableWeight:null;
  const points=available.reduce((a,x)=>a+x.score*x.weight/100,0);
  const status=availableWeight===100?'COMPLETO':'PROVISIONAL';
  const periodLabel=period==='1-15'?'1 al 15':'16 al '+new Date(anio,mes,0).getDate();
  const generated=new Date().toLocaleString('es-PA',{dateStyle:'medium',timeStyle:'short'});
  const logo=new URL('assets/images/report-logo.png',window.location.href).href;

  const {data:evaluacionesDiligencias,error:evalDiligenciasError}=await sb.from('evaluaciones').select('diligencia_id,created_at,evaluado_por').not('diligencia_id','is',null).limit(5000);
  if(evalDiligenciasError)return msg('No se pudo comprobar qué diligencias fueron evaluadas: '+evalDiligenciasError.message,'error');
  const idsDiligencias=new Set((evaluacionesDiligencias||[]).map(ev=>String(ev.diligencia_id)));
  const diligenceRows=validDiligencias.map(x=>{const fueEvaluada=idsDiligencias.has(String(x.id));const estadoEvaluacion=fueEvaluada?'Evaluada':'Pendiente de evaluación';return `<tr><td>${esc(x.date||'')}</td><td>${esc(x.destino||'')}</td><td>${esc(x.motivo||'')}</td><td class="num">${Number(x.hours||0).toFixed(2)}</td><td>${estadoEvaluacion}</td></tr>`}).join('')||`<tr><td colspan="5" style="text-align:center">No se registraron diligencias en la quincena.</td></tr>`;
  const evalRows=evaluation?`
    <tr><td>Promedio combinado de ${evaluation.total_registros} evaluación(es) de la quincena</td><td class="num">${Number(evaluation.puntuacion).toFixed(2)} / 100</td></tr>
    <tr><td colspan="2">Promedios por criterio calculados con las evaluaciones registradas durante este período.</td></tr>
    <tr><td>1. Cumplimiento de diligencia (40%)</td><td class="num">${evaluation.criterios?.cumplimiento_diligencia==null?'—':Number(evaluation.criterios.cumplimiento_diligencia).toFixed(2)}</td></tr>
    <tr><td>2. Responsabilidad (35%)</td><td class="num">${evaluation.criterios?.responsabilidad==null?'—':Number(evaluation.criterios.responsabilidad).toFixed(2)}</td></tr>
    <tr><td>3. Comunicación (20%)</td><td class="num">${evaluation.criterios?.comunicacion==null?'—':Number(evaluation.criterios.comunicacion).toFixed(2)}</td></tr>
    <tr><td>4. Uso de recursos (5%)</td><td class="num">${evaluation.criterios?.uso_recursos==null?'—':Number(evaluation.criterios.uso_recursos).toFixed(2)}</td></tr>
    <tr><td><strong>Puntuación quincenal</strong></td><td class="num"><strong>${Number(evaluation.puntuacion).toFixed(2)}</strong></td></tr>`
    :`<tr><td colspan="2" style="text-align:center">Evaluación pendiente para esta quincena.</td></tr>`;
  const fuelRows=(fuel||[]).map(x=>`<tr><td>${esc(x.fecha||'')}</td><td class="num">${Number(x.galones||0).toFixed(3)} gal</td><td class="num">B/. ${money(x.precio_galon)}</td><td class="num">B/. ${money(x.costo_total)}</td><td>${esc(x.tipo_carga||'')}</td></tr>`).join('')||`<tr><td colspan="5" style="text-align:center">No se registraron abastecimientos en la quincena.</td></tr>`;

  $('reportPreview').innerHTML=`
  <div class="report-preview-wrap"><article class="report-page">
    <header class="report-header">
      <div><img class="report-logo" src="${logo}" alt="PANLOGISTICS GROUP"></div>
      <div class="report-company"><h1>PANLOGISTICS GROUP, S.A.</h1><p>CONTROL OPERATIVO · GESTIÓN DE MENSAJERÍA</p></div>
      <div class="report-doc"><strong>REPORTE QUINCENAL</strong>Documento interno<br>Generado: ${esc(generated)}</div>
    </header>
    <div class="report-title"><h2>REPORTE QUINCENAL DE PRODUCTIVIDAD</h2><p>Evaluación del desempeño operativo · Formato Carta</p></div>
    <div class="report-meta">
      <div><span>Mensajero</span><strong>${esc(name)}</strong></div>
      <div><span>Período</span><strong>${esc(periodLabel)} de ${anio}-${String(mes).padStart(2,'0')}</strong></div>
      <div><span>Estado</span><strong><span class="report-status ${status==='COMPLETO'?'complete':''}">${status}</span></strong></div>
    </div>
    <div class="report-kpis">
      <div class="report-kpi"><span>Diligencias</span><strong>${count}</strong></div>
      <div class="report-kpi"><span>▮ Cumplimiento</span><strong>${compliance===null?'—':compliance.toFixed(2)+'%'}</strong></div>
      <div class="report-kpi"><span>Productividad</span><strong>${productivity===null?'—':productivity.toFixed(2)}</strong></div>
    </div>
    <div class="report-section-title">Resumen de productividad</div>
    <table class="report-table"><thead><tr><th>Componente</th><th>Puntuación</th><th>Peso</th><th>Aporte</th><th>Estado</th></tr></thead>
      <tbody>${components.map(c=>`<tr><td>${c.name}</td><td class="num">${c.score===null?'Pendiente':c.score.toFixed(2)}</td><td class="num">${c.weight}%</td><td class="num">${c.score===null?'—':(c.score*c.weight/100).toFixed(2)}</td><td>${c.score===null?'Pendiente':'Disponible'}</td></tr>`).join('')}</tbody>
    </table>
    <div class="report-total">
      <div class="report-note"><strong>Resultado:</strong> ${points.toFixed(2)} puntos disponibles en la quincena. La productividad se calcula con los componentes disponibles y permanece <strong>${status}</strong> mientras existan componentes pendientes.
      ${fuelControl===null&&fuel.length?`<br><br><strong>Combustible:</strong> se registraron B/. ${money(fuelCost)}; el objetivo de costo por diligencia aún no está configurado.`:''}</div>
      <div class="report-score"><span>Resultado quincenal</span><strong>${productivity===null?'—':productivity.toFixed(2)}</strong><small>/ 100 puntos de productividad</small></div>
      ${isJhonatan?`<div class="report-bonus"><span>💰 Bono de productividad</span><strong>${productivityBonus===null?'—':'B/. '+money(productivityBonus)}</strong><small>${productivityBonus===null?'Pendiente de evaluación':'100% = B/. 75.00 · '+Number(evaluation.puntuacion).toFixed(2)+'% de evaluación'}</small></div>`:`<div class="report-score"><span>Resultado quincenal</span><strong>${productivity===null?'—':productivity.toFixed(2)}</strong><small>/ 100 puntos</small></div>`}
    </div>
    <div class="report-section-title">Diligencias realizadas</div>
    <table class="report-table"><thead><tr><th>Fecha</th><th>Destino / cliente</th><th>Motivo</th><th>Horas</th><th>Estado de evaluación</th></tr></thead><tbody>${diligenceRows}</tbody></table>
    <div class="report-section-title">Evaluación de desempeño</div>
    <table class="report-table"><thead><tr><th>Criterio</th><th>Puntuación</th></tr></thead><tbody>${evalRows}</tbody></table>
    <div class="report-section-title">Combustible registrado</div>
    <table class="report-table"><thead><tr><th>Fecha</th><th>Galones</th><th>Precio/galón</th><th>Costo</th><th>Carga</th></tr></thead><tbody>${fuelRows}</tbody></table>
    <div class="report-section-title">Observaciones</div>
    <div class="report-note">${esc(evaluation?.observaciones||'Sin observaciones registradas para la quincena.')}</div>
    <div class="report-signatures"><div class="report-sign">Elaborado / generado por<br><strong>PANLOGISTICS GROUP, S.A.</strong></div><div class="report-sign">Revisado / aprobado por<br><strong>Firma y nombre</strong></div></div>
    <footer class="report-footer"><span>Documento interno · PANLOGISTICS GROUP, S.A.</span><span>Reporte quincenal · ${anio}-${String(mes).padStart(2,'0')}</span></footer>
  </article></div>`;
  $('printReport').disabled=false;
  requestAnimationFrame(()=> $('reportPreview')?.scrollIntoView({behavior:'smooth',block:'start'}));
}
$('generateReport').onclick=generateQuincenalReport;
