function collectDiligenceRow(existing=null){
  const d=$('date').value||today();
  const collaboratorId=$('entryCollaborator').value||user?.id||'';
  return {
    date:d,month:d.slice(0,7),q:Math.ceil(Number(d.slice(8,10))/15),
    colaborador:profiles.find(p=>String(p.id)===String(collaboratorId))?.full_name || $('colaborador').value.trim() || currentProfile?.full_name || user?.email || '',
    colaborador_id:collaboratorId,
    evaluador_id:$('entryEvaluator')?.value||'',
    departamento:$('departamento').value.trim(),cargo:$('cargo').value.trim(),
    destino:$('destino').value.trim(),motivo:$('motivo').value,
    salida:existing?.salida||'',regreso:existing?.regreso||'',hours:Number(existing?.hours||0),
    sobre:Number($('sobre').value)||0,viatico:Number($('viatico').value)||0,
    codigo:$('codigo').value.trim(),supervisor:$('supervisor').value.trim(),
    obs:$('obs').value.trim(),aprob:existing?.aprob||'Pendiente',created_by:existing?.created_by||user.id
  };
}
function validateBeforeStart(){
  if(!$('destino').value.trim())return 'Introduce el destino / cliente.';
  if(!$('motivo').value)return 'Selecciona el motivo de la diligencia.';
  if(!$('supervisor').value.trim())return 'Introduce el supervisor.';
  if(!$('entryEvaluator')?.value)return 'Selecciona el evaluador asignado.';
  return '';
}
// El operador no guarda manualmente al principio: COMIENZO crea el registro operativo
// y registra la hora. FINALIZAR guarda los cambios, adjunta las fotos y cierra la diligencia.
$('entryForm').onsubmit=async e=>{
  e.preventDefault();
  return msg('Sigue el flujo operativo: completa los datos y pulsa COMIENZO. Al regresar, adjunta las fotos y pulsa FINALIZAR DILIGENCIA para guardar y cerrar.','info');
};

window.startDiligence=async id=>{
  if(!user||!isOperator())return msg('Solo un operador activo puede comenzar diligencias.','error');
  const validation=validateBeforeStart();if(validation)return msg(validation,'error');
  if(!id){
    if(String($('entryCollaborator').value)!==String(user.id))$('entryCollaborator').value=user.id;
    const row=collectDiligenceRow();
    const {data,error}=await sb.from('diligencias').insert(row).select('id').single();
    if(error)return msg('No se pudo preparar la diligencia: '+error.message,'error');
    id=data.id;activeFormDiligenceId=id;$('entryId').value=id;
  }
  const item=(records||[]).find(x=>String(x.id)===String(id));
  if(item && String(item.colaborador_id)!==String(user.id))return msg('Solo puedes comenzar tus propias diligencias.','error');
  if(item && String(item.aprob||'').toUpperCase()==='ANULADO')return msg('No puedes comenzar una diligencia anulada.','error');
  const {data,error}=await sb.rpc('start_diligence',{p_id:id});
  if(error)return msg('El registro quedó preparado, pero no se pudo iniciar: '+error.message,'error');
  if(!data?.ok)return msg(data?.message||'Supabase no permitió comenzar la diligencia.','error');
  activeFormDiligenceId=id;$('entryId').value=id;
  msg('Mensajería iniciada. La hora de salida se registró automáticamente.','ok');
  await loadRecords();updateFormOperationalButtons();
};

window.finishDiligence=async id=>{
  if(!user||!isOperator())return msg('Solo un operador activo puede finalizar diligencias.','error');
  id=id||activeFormDiligenceId||$('entryId')?.value;
  if(!id)return msg('Primero pulsa COMIENZO para iniciar la mensajería.','error');
  const item=(records||[]).find(x=>String(x.id)===String(id));
  if(item && String(item.colaborador_id)!==String(user.id))return msg('Solo puedes finalizar tus propias diligencias.','error');
  if(item && !item.started_at && String(item.operational_status||'').toUpperCase()!=='EN_CURSO')return msg('Primero debes iniciar la mensajería con COMIENZO.','error');
  if(item && (item.finished_at || String(item.operational_status||'').toUpperCase()==='FINALIZADA'))return msg('Esta diligencia ya fue finalizada.','error');
  if(!confirm('¿Confirmas que deseas finalizar la mensajería? Se guardarán los datos, las fotografías, la hora de regreso y la duración.'))return;
  const photos=[...diligencePhotoFiles];
  try{const signatureFile=await getClientSignatureFile();if(signatureFile)photos.push(signatureFile);}catch(err){return msg(err.message,'error');}
  if(photos.length){
    try{await uploadDiligencePhotos(id,photos);diligencePhotoFiles=[];diligencePhotoObjectUrls.forEach(url=>URL.revokeObjectURL(url));diligencePhotoObjectUrls=[];if($('diligencePhotos'))$('diligencePhotos').value='';if($('diligenceGalleryPhotos'))$('diligenceGalleryPhotos').value='';if($('diligencePhotoPreview'))$('diligencePhotoPreview').innerHTML='Fotos y firma guardadas correctamente.';clearClientSignature();}
    catch(err){return msg('No se pudieron guardar las fotos; la mensajería sigue en curso: '+err.message,'error');}
  }
  // Guardar los últimos cambios del formulario antes de cerrar la diligencia.
  const row=collectDiligenceRow(item||null);
  const {error:updateError}=await sb.from('diligencias').update(row).eq('id',id).eq('colaborador_id',user.id);
  if(updateError)return msg('No se pudieron guardar los datos finales: '+updateError.message,'error');
  const {data,error}=await sb.rpc('finish_diligence',{p_id:id});
  if(error)return msg('Los datos quedaron guardados, pero no se pudo finalizar: '+error.message,'error');
  if(!data?.ok)return msg(data?.message||'Supabase no permitió finalizar la diligencia.','error');
  activeFormDiligenceId=id;$('entryId').value=id;
  msg(`Mensajería finalizada y guardada. Duración: ${Number(data.hours||0).toFixed(2)} horas.`,'ok');
  await loadRecords();updateFormOperationalButtons();
};

function updateFormOperationalButtons(){
  const start=$('formStartBtn'),finish=$('formFinishBtn'),hint=$('formOperationalHint');
  if(!start||!finish)return;
  const id=activeFormDiligenceId||editing||$('entryId')?.value||null;
  const x=(records||[]).find(r=>String(r.id)===String(id));
  const owns=!!x&&String(x.colaborador_id)===String(user?.id);
  const started=!!x?.started_at||String(x?.operational_status||'').toUpperCase()==='EN_CURSO'||String(x?.operational_status||'').toUpperCase()==='FINALIZADA';
  const finished=!!x?.finished_at||String(x?.operational_status||'').toUpperCase()==='FINALIZADA';
  const allowed=!!user&&isOperator()&&(!id||!x||owns)&&String(x?.aprob||'').toUpperCase()!=='ANULADO';
  start.disabled=!allowed||started;
  finish.disabled=!allowed||!id||!started||finished;
  if(hint){
    if(!user||!isOperator())hint.textContent='Inicia sesión con el usuario OPERADOR para comenzar y finalizar la mensajería.';
    else if(finished)hint.textContent=`Mensajería finalizada y guardada · salida ${x?.salida||'—'} · regreso ${x?.regreso||'—'} · ${Number(x?.hours||0).toFixed(2)} horas.`;
    else if(started)hint.textContent=`Mensajería en curso desde ${x?.salida||'la hora registrada'}. Toma fotos o elígelas de la galería; al regresar pulsa FINALIZAR DILIGENCIA para guardar todo.`;
    else hint.textContent='Completa destino, motivo y supervisor. Pulsa COMIENZO al salir; el registro se crea automáticamente.';
  }
}
$('formStartBtn')?.addEventListener('click',async()=>{
  const id=activeFormDiligenceId||editing||$('entryId')?.value||null;
  await window.startDiligence(id);
});
$('formFinishBtn')?.addEventListener('click',async()=>{
  const id=activeFormDiligenceId||editing||$('entryId')?.value||null;
  await window.finishDiligence(id);
});

