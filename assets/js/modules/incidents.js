// Registro, consulta y actualización de incidencias.
function clearIncident(){
  $('incidentDate').value=today();$('incidentPeriod').value=(Number(today().slice(-2))<=15?'1-15':'16-FIN');$('incidentDescription').value='';$('incidentStatus').value='ABIERTA';
  if($('incidentDiligence'))$('incidentDiligence').innerHTML='<option value="">Sin vincular</option>';
  if(isOperator()&&user){$('incidentCollaborator').value=user.id}
}

async function loadIncidentData(){
  if(!user)return;
  await loadProfiles();
  fillCollaboratorSelects();

  const messengers=profiles.filter(p=>String(p.role||'').toUpperCase()==='OPERADOR'&&p.active===true);
  const iopts=messengers.map(p=>`<option value="${p.id}">${esc(p.full_name||p.email)}</option>`).join('');
  $('incidentCollaborator').innerHTML=iopts||'<option value="">No hay operadores activos</option>';

  if(isOperator()) $('incidentCollaborator').value=user.id;
  else if(iopts && !$('incidentCollaborator').value) $('incidentCollaborator').value=messengers[0].id;

  let q=sb.from('incidencias').select('*').order('fecha',{ascending:false}).order('created_at',{ascending:false});
  if(isOperator())q=q.eq('colaborador_id',user.id);
  if(isEvaluator())q=q.eq('reportado_por',user.id);

  const {data,error}=await q;
  if(error){
    $('incidentList').innerHTML='<div class="status error">No se pudieron cargar las incidencias: '+esc(error.message)+'</div>';
    return;
  }

  const arr=data||[];

  // Cargar diligencias disponibles para vincular, no solamente las ya vinculadas a incidencias.
  const selectedCollaborator=$('incidentCollaborator').value;
  let dq=sb.from('diligencias')
    .select('id,date,destino,colaborador_id,evaluador_id')
    .order('date',{ascending:false})
    .limit(2000);

  if(isEvaluator()){
    dq=dq.eq('evaluador_id',user.id);
  }else if(isOperator()){
    dq=dq.eq('colaborador_id',user.id);
  }else if(selectedCollaborator){
    dq=dq.eq('colaborador_id',selectedCollaborator);
  }

  const {data:ds,error:dErr}=await dq;
  if(dErr){
    $('incidentDiligence').innerHTML='<option value="">Sin vincular</option>';
  }else{
    const linkedIds=new Set(arr.map(x=>String(x.diligencia_id||'')).filter(Boolean));
    $('incidentDiligence').innerHTML='<option value="">Sin vincular</option>'+
      (ds||[]).map(d=>`<option value="${d.id}">${esc(d.date)} · Diligencia #${d.id} · ${esc(d.destino||'')}</option>`).join('');
    // Si ya existe una incidencia vinculada, conservar su opción sin duplicarla.
    for(const id of linkedIds){
      if(![...$('incidentDiligence').options].some(o=>String(o.value)===id)){
        $('incidentDiligence').insertAdjacentHTML('beforeend',`<option value="${id}">Diligencia #${id}</option>`);
      }
    }
  }

  $('incidentList').innerHTML=arr.length?arr.map(x=>{
    const p=profiles.find(z=>String(z.id)===String(x.colaborador_id)),
          ev=profiles.find(z=>String(z.id)===String(x.reportado_por));
    const statusAdmin=isAdmin()
      ?`<select class="incident-status" onchange="updateIncidentStatus('${x.id}',this.value)">
          <option ${x.estado==='ABIERTA'?'selected':''}>ABIERTA</option>
          <option ${x.estado==='REVISADA'?'selected':''}>REVISADA</option>
          <option ${x.estado==='CERRADA'?'selected':''}>CERRADA</option>
        </select>`
      :`<span class="pill">${esc(x.estado)}</span>`;
    return `<article class="entry">
      <div class="entrytop">
        <div><h3>${esc(p?.full_name||x.colaborador_id)}</h3><p>${esc(x.fecha)} · ${esc(x.periodo)}</p></div>
        ${statusAdmin}
      </div>
      <p>${esc(x.descripcion)}</p>
      <p>Reportada por: ${esc(ev?.full_name||x.reportado_por)}</p>
      ${x.diligencia_id?`<p>Diligencia #${esc(x.diligencia_id)}</p>`:''}
    </article>`;
  }).join(''):'<div class="empty">No hay incidencias registradas.</div>';
}

window.updateIncidentStatus=async(id,estado)=>{
  if(!isAdmin())return msg('Solo ADMIN puede actualizar el estado.','error');
  const {error}=await sb.from('incidencias').update({estado,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return msg('No se pudo actualizar la incidencia: '+error.message,'error');
  msg('Estado de incidencia actualizado.','ok');await loadIncidentData();
};

$('saveIncident').onclick=async()=>{
  if(!(isAdmin()||isEvaluator()))return msg('Su rol no puede registrar incidencias.','error');
  const colaborador_id=$('incidentCollaborator').value,fecha=$('incidentDate').value||today(),descripcion=$('incidentDescription').value.trim();
  if(!colaborador_id||!descripcion)return msg('Seleccione mensajero y describa la incidencia.','error');
  const d=new Date(fecha+'T12:00:00');const anio=d.getFullYear(),mes=d.getMonth()+1,periodo=$('incidentPeriod').value;
  const row={colaborador_id,reportado_por:user.id,diligencia_id:$('incidentDiligence').value?Number($('incidentDiligence').value):null,fecha,anio,mes,periodo,descripcion,estado:isAdmin()?$('incidentStatus').value:'ABIERTA'};
  const {error}=await sb.from('incidencias').insert(row);
  if(error)return msg('No se pudo registrar la incidencia: '+error.message,'error');
  msg('Incidencia registrada correctamente.','ok');clearIncident();await loadIncidentData();
};
$('clearIncident').onclick=clearIncident;$('incidentDate').value=today();
