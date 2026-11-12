function fillCollaboratorSelects(){
  const messengers=profiles.filter(p=>String(p.role??'').trim().toUpperCase()==='OPERADOR' && p.active===true);
  const opts=messengers.map(p=>`<option value="${p.id}">${esc(p.full_name||p.email)}</option>`).join('');

  if($('entryCollaborator')) $('entryCollaborator').innerHTML=opts||'<option value="">No hay operadores activos</option>';
  if($('evalCollaborator')) $('evalCollaborator').innerHTML=opts||'<option value="">No hay operadores activos</option>';
  if($('resultCollaborator')) $('resultCollaborator').innerHTML='<option value="">Todos los mensajeros</option>'+opts;

  if(isOperator()){
    const own=messengers.find(p=>String(p.id)===String(user?.id));
    if($('entryCollaborator')) $('entryCollaborator').value=own?.id||user?.id||'';
    if($('colaborador')) $('colaborador').value=own?.full_name||own?.email||'';
    if($('evalCollaborator')){ $('evalCollaborator').innerHTML=own?`<option value="${own.id}">${esc(own.full_name||own.email)}</option>`:'<option value="">Mi perfil no está disponible</option>'; $('evalCollaborator').value=own?.id||user?.id||''; }
    if($('resultCollaborator')){ $('resultCollaborator').innerHTML=own?`<option value="${own.id}">${esc(own.full_name||own.email)}</option>`:'<option value="">Mi perfil</option>'; $('resultCollaborator').value=own?.id||user?.id||''; }
  }else if(isAdmin()){
    if(messengers.length){
      if($('entryCollaborator')) $('entryCollaborator').value=$('entryCollaborator').value||messengers[0].id;
      if($('evalCollaborator')) $('evalCollaborator').value=messengers[0].id;
      if($('resultCollaborator')) $('resultCollaborator').value='';
    }
  }
  if($('colaborador')) $('colaborador').value=messengers.find(p=>String(p.id)===String($('entryCollaborator')?.value))?.full_name||'';
}

async function loadEvaluators(){
  const {data,error}=await sb.from('profiles').select('id,full_name,email,role,active').eq('active',true).eq('role','EVALUADOR').order('full_name');
  if(error){msg('No se pudieron cargar los evaluadores: '+error.message,'error');return []}
  const arr=data||[];
  if($('entryEvaluator')){
    const prev=$('entryEvaluator').value;
    $('entryEvaluator').innerHTML=arr.length?arr.map(p=>`<option value="${p.id}">${esc(p.full_name||p.email)}</option>`).join(''):'<option value="">No hay evaluadores activos</option>';
    if(prev && arr.some(p=>String(p.id)===String(prev))) $('entryEvaluator').value=prev;
    else if(arr.length) $('entryEvaluator').value=arr[0].id;
  }
  return arr;
}


async function loadVehicles(){
  const {data,error}=await sb.from('vehiculos').select('id,placa,marca,modelo,anio,tipo_combustible,colaborador_id,activo').eq('activo',true).order('placa');
  if(error){msg('No se pudieron cargar los vehículos: '+error.message,'error');return []}
  vehicles=data||[]; return vehicles;
}
