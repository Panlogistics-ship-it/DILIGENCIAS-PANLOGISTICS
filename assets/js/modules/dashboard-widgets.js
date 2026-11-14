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
