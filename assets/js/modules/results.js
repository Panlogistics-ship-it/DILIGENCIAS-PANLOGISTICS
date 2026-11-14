// Consulta y presentación de resultados mensuales y quincenales.
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


