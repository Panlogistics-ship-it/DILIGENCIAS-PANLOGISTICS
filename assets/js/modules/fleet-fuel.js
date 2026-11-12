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
function fillFuelSelectors(){
  const messengers=profiles.filter(p=>
    p.active===true &&
    String(p.role??'').trim().toUpperCase()==='OPERADOR'
  );

  const opts=messengers.map(p=>
    `<option value="${p.id}">${esc(p.full_name||p.email)}</option>`
  ).join('');

  if(isAdmin()){
    const current=$('fuelCollaborator').value;
    $('fuelCollaborator').innerHTML=opts||'<option value="6ee6abb9-19de-4c3e-b20d-258faa0c1e65">Jhonatan Valencia</option>';
    $('fuelCollaborator').disabled=false;
    if(messengers.length===1){
      $('fuelCollaborator').value=String(messengers[0].id);
    }else if(messengers.length>1 && messengers.some(p=>String(p.id)===String(current))){
      $('fuelCollaborator').value=current;
    }else if(messengers.length>1){
      $('fuelCollaborator').value=String(messengers[0].id);
    }else{
      $('fuelCollaborator').value='6ee6abb9-19de-4c3e-b20d-258faa0c1e65';
    }
  }else{
    const own=messengers.find(p=>String(p.id)===String(user?.id));
    $('fuelCollaborator').innerHTML=own
      ? `<option value="${own.id}">${esc(own.full_name||own.email)}</option>`
      : '<option value="6ee6abb9-19de-4c3e-b20d-258faa0c1e65">Jhonatan Valencia</option>';
    $('fuelCollaborator').disabled=true;
    $('fuelCollaborator').value=String(own?.id||user?.id||'6ee6abb9-19de-4c3e-b20d-258faa0c1e65');
  }

  refreshFuelVehicles();
  $('fuelDataHint').textContent = messengers.length ? `Operadores activos disponibles: ${messengers.length} · Vehículos activos cargados: ${vehicles.length}` : '';

  if(!messengers.length){
    msg('No se encontraron operadores activos para registrar combustible. Verifique el rol/estado en Perfiles.','error');
  }
}
function refreshFuelVehicles(){
  const collaboratorId=$('fuelCollaborator').value;
  const previous=$('fuelVehicle').value;
  const list=vehicles.filter(v=>
    v.activo===true &&
    String(v.colaborador_id??'')===String(collaboratorId??'')
  );

  if(list.length){
    $('fuelVehicle').innerHTML=list.map(v=>`<option value="${v.id}">${esc(v.placa)} · ${esc(v.marca||'')} ${esc(v.modelo||'')}</option>`).join('');
    $('fuelVehicle').value=list.some(v=>String(v.id)===String(previous))?previous:String(list[0].id);
  }else if(previous){
    // Keep the seeded/previous vehicle visible while the data refresh is settling.
    $('fuelVehicle').innerHTML='<option value="'+esc(previous)+'">EE8016 · HYUNDAI GRAND I10</option>';
    $('fuelVehicle').value=previous;
  }else{
    $('fuelVehicle').innerHTML='<option value="">No hay vehículo activo asignado</option>';
  }
}
function clearFuel(){
  $('fuelDate').value=today();$('fuelOdometer').value='';$('fuelLiters').value='';$('fuelPriceLiter').value='';
  $('fuelLoadType').value='COMPLETA';$('fuelStation').value='';$('fuelObs').value='';
  if(!isAdmin() && user?.id)$('fuelCollaborator').value=user.id;
  refreshFuelVehicles();updateFuelPreview();
}
function updateFuelPreview(){
  const gallons=Number($('fuelLiters').value)||0,price=Number($('fuelPriceLiter').value)||0;
  $('fuelCostPreview').textContent='B/. '+money(gallons*price);
}
function renderFuelList(){
  const rows=fuelRecords||[];
  $('fuelList').innerHTML=rows.length?rows.map(x=>{
    const v=vehicles.find(z=>z.id===x.vehiculo_id),p=profiles.find(z=>z.id===x.colaborador_id);
    const gallons=Number(x.galones||0),price=Number(x.precio_galon||0),cost=Number(x.costo_total||gallons*price||0);
    return `<article class="fuel-card"><div class="entrytop"><div><h3>${esc(x.fecha)} · ${esc(v?.placa||'Vehículo')}</h3><p>${esc(p?.full_name||x.colaborador_id)} · ${esc(v?.marca||'')} ${esc(v?.modelo||'')}</p></div><span class="pill">${esc(x.tipo_carga||'PARCIAL')}</span></div><p>${gallons.toFixed(3)} gal · B/. ${price.toFixed(4)}/gal · <strong>B/. ${money(cost)}</strong></p><p>Odómetro: ${x.odometro==null?'—':Number(x.odometro).toLocaleString('es-PA')} km · ${esc(x.estacion||'Sin estación')}</p>${x.observacion?`<p>${esc(x.observacion)}</p>`:''}</article>`;
  }).join(''):'<div class="empty">No hay abastecimientos registrados.</div>';
}
async function loadFuelData(){
  if(!user)return;

  // Obtener SIEMPRE el perfil del usuario autenticado directamente.
  const {data:me,error:meError}=await sb
    .from('profiles')
    .select('id,full_name,email,role,active')
    .eq('id',user.id)
    .maybeSingle();

  if(meError){
    $('fuelList').innerHTML='<div class="status error">No se pudo verificar el perfil: '+esc(meError.message)+'</div>';
    return;
  }

  if(me){
    currentProfile=me;
  }

  const {data:profileData,error:profileError}=await sb
    .from('profiles')
    .select('id,full_name,email,role,active')
    .eq('active',true)
    .order('full_name');

  if(profileError){
    $('fuelList').innerHTML='<div class="status error">No se pudieron cargar los mensajeros: '+esc(profileError.message)+'</div>';
    return;
  }

  profiles=profileData||[];

  const {data:vehicleData,error:vehicleError}=await sb
    .from('vehiculos')
    .select('id,placa,marca,modelo,anio,tipo_combustible,colaborador_id,activo')
    .eq('activo',true)
    .order('placa');

  if(vehicleError){
    $('fuelList').innerHTML='<div class="status error">No se pudieron cargar los vehículos: '+esc(vehicleError.message)+'</div>';
    return;
  }

  vehicles=vehicleData||[];
  fillFuelSelectors();

  // ADMIN: consulta todos los abastecimientos permitidos por RLS.
  // OPERADOR: consulta únicamente los suyos.
  let q=sb.from('combustible')
    .select('*')
    .order('fecha',{ascending:false})
    .order('created_at',{ascending:false})
    .limit(100);

  const adminUser = String(currentProfile?.role??'').trim().toUpperCase()==='ADMIN'
    && currentProfile?.active===true;

  if(!adminUser){
    q=q.eq('colaborador_id',user.id);
  }

  const {data,error}=await q;

  if(error){
    $('fuelList').innerHTML='<div class="status error">No se pudieron cargar los abastecimientos: '+esc(error.message)+'</div>';
    return;
  }

  fuelRecords=data||[];

  const roleText=adminUser?'ADMIN':'OPERADOR';
  $('fuelDataHint').textContent=
    `Usuario: ${esc(currentProfile?.full_name||user.email)} · Rol: ${roleText} · Abastecimientos visibles: ${fuelRecords.length}`;

  renderFuelList();
  updateFuelPreview();
}
$('fuelCollaborator').onchange=refreshFuelVehicles;
$('fuelLiters').oninput=updateFuelPreview;
$('fuelPriceLiter').oninput=updateFuelPreview;
$('clearFuel').onclick=clearFuel;
$('saveFuel').onclick=async()=>{
  if(!user)return msg('Inicie sesión antes de guardar.','error');
  if(!isAdmin())return msg('Solo ADMIN puede registrar combustible.','error');
  const colaborador_id=$('fuelCollaborator').value,vehiculo_id=$('fuelVehicle').value;
  const galones=Number($('fuelLiters').value),precio_galon=Number($('fuelPriceLiter').value);
  if(!colaborador_id||!vehiculo_id)return msg('Seleccione mensajero y vehículo.','error');
  if(!(galones>0)||precio_galon<0)return msg('Indique galones y precio por galón válidos.','error');
  const row={fecha:$('fuelDate').value||today(),colaborador_id,vehiculo_id,odometro:$('fuelOdometer').value===''?null:Number($('fuelOdometer').value),galones,precio_galon,tipo_carga:$('fuelLoadType').value,estacion:$('fuelStation').value.trim()||null,observacion:$('fuelObs').value.trim()||null,created_by:user.id};
  const {error}=await sb.from('combustible').insert(row);
  if(error)return msg('No se pudo guardar el combustible: '+error.message,'error');
  msg('Abastecimiento guardado correctamente.','ok');clearFuel();await loadFuelData();
};

