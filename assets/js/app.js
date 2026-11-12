
const SUPABASE_URL='https://stujfwqzbtbqfapmvpog.supabase.co';
const SUPABASE_KEY='sb_publishable_RtUb5ukwLAWBKIwuGi09RQ_4lj3zscv';

const $=id=>document.getElementById(id);
let sb=null,user=null,editing=null,activeFormDiligenceId=null,records=[],profiles=[],currentProfile=null,vehicles=[],fuelRecords=[];
const fields=['date','colaborador','departamento','cargo','destino','motivo','salida','regreso','sobre','viatico','codigo','supervisor','obs'];

function msg(t,type=''){const el=$('status');if(el._toastTimer){clearTimeout(el._toastTimer);el._toastTimer=null;}el.hidden=false;el.textContent=t;el.className='status '+type}
function toast(t,type='ok'){const el=$('status');if(el._toastTimer)clearTimeout(el._toastTimer);el.hidden=false;el.textContent=t;el.className='status toast '+type;el._toastTimer=setTimeout(()=>{el.hidden=true;el.className='status';el._toastTimer=null;},3200)}
function tab(id){
  if(!canUseTab(id)) return;
  ['dashboardView','formView','listView','fuelView','evaluationView','incidentsView','resultsView','reportsView','exportView','settingsView','usersView','gpsView','truckHandoverView'].forEach(x=>{
    const view=$(x);
    if(!view)return;
    view.hidden=x!==id;
    if(x===id){view.removeAttribute('hidden');view.style.setProperty('display','block','important');view.style.setProperty('visibility','visible','important');}
    else {view.style.removeProperty('display');view.style.removeProperty('visibility');}
  });
  if(id==='reportsView'){
    const reports=$('reportsView');
    if(reports){reports.hidden=false;reports.removeAttribute('hidden');reports.style.setProperty('display','block','important');reports.style.setProperty('visibility','visible','important');}
    const controls=reports?.querySelector('.report-controls');
    if(controls){controls.hidden=false;controls.removeAttribute('hidden');controls.style.setProperty('display','block','important');controls.style.setProperty('visibility','visible','important');controls.style.setProperty('opacity','1','important');}
    const preview=$('reportPreview');
    if(preview){preview.hidden=false;preview.removeAttribute('hidden');preview.style.setProperty('display','block','important');preview.style.setProperty('visibility','visible','important');}
  }
  requestAnimationFrame(()=>{if(id==='dashboardView'||id==='reportsView'){window.scrollTo({top:0,behavior:'auto'});return;}$(id)?.scrollIntoView({behavior:'smooth',block:'start'});});
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
  if(id==='dashboardView')loadRecords();
  if(id==='listView')loadRecords();
  if(id==='fuelView')loadFuelData();
  if(id==='evaluationView'){loadEvaluators();loadEvaluationData();}
  if(id==='incidentsView')loadIncidentData();
  if(id==='settingsView')loadSettings();
  if(id==='usersView')loadUsersData();
  if(id==='gpsView'){loadGpsAdminData();startGpsAdminRefresh();}else stopGpsAdminRefresh();
  if(id==='truckHandoverView')loadTruckHandoverRecords();
  if(id==='resultsView')loadResultData();
  if(id==='reportsView')loadReportSelectors();
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>tab(b.dataset.tab));

function role(){return String(currentProfile?.role??'').trim().toUpperCase()}
function isActive(){return currentProfile?.active===true}
function isAdmin(){return role()==='ADMIN' && isActive()}
function isEvaluator(){return role()==='EVALUADOR' && isActive()}
function isOperator(){return role()==='OPERADOR' && isActive()}
function canUseTab(id){
  if(id==='dashboardView') return isAdmin()||isOperator()||isEvaluator();
  if(id==='formView') return isAdmin()||isOperator();
  if(id==='listView') return isAdmin()||isOperator();
  if(id==='fuelView') return isAdmin()||isOperator();
  if(id==='evaluationView') return isAdmin()||isEvaluator()||isOperator();
  if(id==='incidentsView') return isAdmin()||isEvaluator()||isOperator();
  if(id==='resultsView') return isAdmin()||isOperator();
  if(id==='reportsView') return isAdmin();
  if(id==='exportView') return isAdmin();
  if(id==='settingsView') return isAdmin();
  if(id==='usersView') return isAdmin();
  if(id==='gpsView') return isAdmin();
  if(id==='truckHandoverView') return isAdmin()||isOperator();
  return false;
}
function applyRolePermissions(){
  const r=role();
  document.querySelectorAll('.tab').forEach(b=>{
    const allowed=canUseTab(b.dataset.tab);
    b.hidden=!allowed;
  });
  $('entryCollaborator').disabled=!isAdmin();
  if($('entryEvaluator')) $('entryEvaluator').disabled=!(isAdmin()||isOperator());
  $('saveFuel').disabled=!isAdmin();
  $('clearFuel').disabled=!isAdmin();
  $('saveEvaluation').disabled=!(isAdmin()||isEvaluator());
  $('clearEvaluation').disabled=!(isAdmin()||isEvaluator());
  if($('evaluationRoleHint')){
    $('evaluationRoleHint').textContent = isEvaluator() ? 'Rol EVALUADOR: puede evaluar operadores activos. Una vez guardada, la evaluación no puede ser modificada por el evaluador.' : isOperator() ? 'Rol OPERADOR: consulta únicamente sus evaluaciones.' : 'Rol ADMIN: puede registrar y corregir evaluaciones.';
  }
  if($('incidentRoleHint')) $('incidentRoleHint').textContent = isAdmin() ? 'Rol ADMIN: puede registrar incidencias y actualizar su estado.' : isEvaluator() ? 'Rol EVALUADOR: puede registrar incidencias para operadores activos.' : 'Rol OPERADOR: consulta sus incidencias relacionadas.';
  if($('saveIncident')) $('saveIncident').disabled=!(isAdmin()||isEvaluator());
  if($('incidentStatus')) $('incidentStatus').disabled=!isAdmin();
  if($('incidentCollaborator')) $('incidentCollaborator').disabled=isOperator();
  if($('incidentDiligence')) $('incidentDiligence').disabled=isOperator();
  if($('saveSettings')) $('saveSettings').disabled=!isAdmin();
  if($('refreshSettings')) $('refreshSettings').disabled=!isAdmin();
  if(isOperator()){
    $('entryCollaborator').disabled=true;
  }
  if(r==='EVALUADOR') tab('evaluationView');
  if(r==='OPERADOR') tab('formView');
}


async function loadSettings(){
  if(!isAdmin()) return;
  const {data,error}=await sb.from('app_settings').select('key,value').in('key',[
    'meta_diligencias_diarias',
    'horas_objetivo_por_diligencia',
    'costo_combustible_objetivo_por_diligencia'
  ]);
  if(error)return msg('No se pudo cargar la configuración: '+error.message,'error');
  const s={};(data||[]).forEach(x=>s[x.key]=x.value);
  $('settingDailyTarget').value=s.meta_diligencias_diarias??'';
  $('settingHoursTarget').value=s.horas_objetivo_por_diligencia??'';
  $('settingFuelTarget').value=s.costo_combustible_objetivo_por_diligencia??'';
}

async function saveSettings(){
  if(!isAdmin())return msg('Solo ADMIN puede modificar la configuración.','error');

  const daily=$('settingDailyTarget').value.trim();
  const hours=$('settingHoursTarget').value.trim();
  const fuel=$('settingFuelTarget').value.trim();

  if(daily==='' || Number(daily)<0)return msg('Ingrese una meta diaria válida.','error');
  if(hours==='' || Number(hours)<0)return msg('Ingrese horas objetivo válidas.','error');
  if(fuel!=='' && Number(fuel)<0)return msg('El costo objetivo de combustible no puede ser negativo.','error');

  const values=[
    {key:'meta_diligencias_diarias',value:String(Number(daily))},
    {key:'horas_objetivo_por_diligencia',value:String(Number(hours))},
    {key:'costo_combustible_objetivo_por_diligencia',value:fuel===''?'':String(Number(fuel))}
  ];

  for(const item of values){
    const {error}=await sb.from('app_settings')
      .update({value:item.value,updated_at:new Date().toISOString()})
      .eq('key',item.key);
    if(error)return msg('No se pudo guardar '+item.key+': '+error.message,'error');
  }

  msg('Configuración guardada correctamente.','ok');
  await loadSettings();
}

$('saveSettings').onclick=saveSettings;
$('refreshSettings').onclick=loadSettings;

function resetForm(){
  $('entryForm').reset();
  // Clear selected files and release temporary preview URLs.
  diligencePhotoFiles=[];
  diligencePhotoObjectUrls.forEach(url=>URL.revokeObjectURL(url));
  diligencePhotoObjectUrls=[];
  if($('diligencePhotos')) $('diligencePhotos').value=''; if($('diligenceGalleryPhotos')) $('diligenceGalleryPhotos').value='';
  if($('diligencePhotoPreview')) $('diligencePhotoPreview').innerHTML='No hay fotos seleccionadas.';
  clearClientSignature();
  $('entryId').value='';editing=null;activeFormDiligenceId=null;$('date').value=today();
  updateFormOperationalButtons();
  $('departamento').value='Mensajería';$('cargo').value='Mensajero';$('sobre').value='0';$('viatico').value='0';
  $('formTitle').textContent='Nueva diligencia';
  if($('entryEvaluator')) $('entryEvaluator').value=$('entryEvaluator').value||'';
  if($('entryCollaborator')){ $('entryCollaborator').value=isOperator()?user?.id||'':$('entryCollaborator').value; $('colaborador').value=profiles.find(p=>String(p.id)===String($('entryCollaborator').value))?.full_name||''; }
}
$('clear').onclick=resetForm;

async function checkSession(){
  const {data,error}=await sb.auth.getSession();
  if(error)return msg(error.message,'error');
  if(data.session){user=data.session.user;await loadProfile();await showApp()}
}
async function showApp(){
  if($('sessionUser')){
    const role=(currentProfile?.role||'').toUpperCase();
    const name=currentProfile?.full_name||user?.email||'Usuario';
    $('sessionUser').innerHTML=`${esc(name)}<span>${esc(role||'USUARIO')} · Sesión activa</span>`;
  }
  $('auth').hidden=true;$('app').hidden=false;if($('dashboardLogo')&&$('loginLogo'))$('dashboardLogo').src=$('loginLogo').src;msg('Sesión iniciada correctamente.','ok');resetForm();await loadProfiles();fillCollaboratorSelects();await loadEvaluators();applyRolePermissions();if($('gpsOperatorCard'))$('gpsOperatorCard').hidden=!isOperator();gpsSetOperatorState(false);updateFormOperationalButtons();if(isAdmin())loadSettings();tab('dashboardView');
}
async function doLogin(){
  const email=$('email').value.trim(),password=$('password').value;
  if(!email||!password)return msg('Ingrese su correo y contraseña.','error');
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error)return msg('No fue posible iniciar sesión: '+error.message,'error');
  user=data.user;await loadProfile();await showApp();
}
$('login').onclick=doLogin;
$('password').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});

$('forgot').onclick=async()=>{
  const email=$('email').value.trim();
  if(!email)return msg('Ingrese primero su correo electrónico.','error');
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
  if(error)return msg('No se pudo enviar el enlace: '+error.message,'error');
  msg('Si el correo está autorizado, recibirá instrucciones para restablecer su contraseña.','ok');
};

async function doLogout(){
  await sb.auth.signOut();user=null;records=[];$('app').hidden=true;$('auth').hidden=false;
  $('password').value='';
  if($('sessionUser'))$('sessionUser').innerHTML='Sesión activa<span>Usuario autenticado</span>';
  msg('Sesión cerrada.','ok');
}
$('logoutTop').onclick=doLogout;


const PHOTO_BUCKET='diligencia-evidencias';
let diligencePhotoFiles=[];
let diligencePhotoObjectUrls=[];
const cameraInput=$('diligencePhotos');
const galleryInput=$('diligenceGalleryPhotos');
$('takeDiligencePhoto')?.addEventListener('click',()=>cameraInput?.click());
$('chooseDiligencePhotos')?.addEventListener('click',()=>galleryInput?.click());
function updatePhotoSelection(){
  diligencePhotoObjectUrls.forEach(url=>URL.revokeObjectURL(url));
  diligencePhotoObjectUrls=[];
  const preview=$('diligencePhotoPreview');
  if(!preview)return;
  if(!diligencePhotoFiles.length){preview.textContent='No hay fotos seleccionadas.';return;}
  const items=diligencePhotoFiles.map((file,index)=>{
    const url=URL.createObjectURL(file);diligencePhotoObjectUrls.push(url);
    return `<div class="photo-preview-item"><img src="${url}" alt="Vista previa de ${esc(file.name)}"><small>${esc(file.name)}</small><button class="btn danger" type="button" style="margin-top:6px;padding:5px 9px;min-height:30px" onclick="removeDiligencePhoto(${index})">✕ Eliminar foto</button></div>`;
  }).join('');
  preview.innerHTML=`<p><strong>${diligencePhotoFiles.length} foto(s) seleccionada(s).</strong> Puedes eliminar cualquier imagen equivocada antes de finalizar:</p><div class="photo-preview-grid">${items}</div>`;
}
function addSelectedPhotos(input){
  const selected=Array.from(input?.files||[]);
  for(const file of selected){
    if(!diligencePhotoFiles.some(existing=>existing.name===file.name&&existing.size===file.size&&existing.lastModified===file.lastModified)){
      diligencePhotoFiles.push(file);
    }
  }
  if(input)input.value='';
  updatePhotoSelection();
}
window.removeDiligencePhoto=index=>{
  if(!Number.isInteger(index)||index<0||index>=diligencePhotoFiles.length)return;
  diligencePhotoFiles.splice(index,1);
  updatePhotoSelection();
};
cameraInput?.addEventListener('change',()=>addSelectedPhotos(cameraInput));
galleryInput?.addEventListener('change',()=>addSelectedPhotos(galleryInput));
async function uploadDiligencePhotos(diligenceId, files){
  if(!files?.length)return;
  for(const file of files){
    if(!file.type.startsWith('image/'))throw new Error('Solo se permiten archivos de imagen.');
    if(file.size>10*1024*1024)throw new Error(`La foto ${file.name} supera el límite de 10 MB.`);
    const safeName=file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'foto.jpg';
    const path=`${diligenceId}/${Date.now()}_${crypto.randomUUID()}_${safeName}`;
    const {error:upErr}=await sb.storage.from(PHOTO_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
    if(upErr)throw new Error('No se pudo subir '+file.name+': '+upErr.message);
    const {error:metaErr}=await sb.from('diligencia_fotos').insert({diligencia_id:String(diligenceId),storage_path:path,nombre_archivo:file.name,content_type:file.type,tamano_bytes:file.size,subido_por:user.id});
    if(metaErr){await sb.storage.from(PHOTO_BUCKET).remove([path]);throw new Error('La foto se subió pero no se pudo asociar a la diligencia: '+metaErr.message);}
  }
}
// Firma del cliente: se captura localmente y se adjunta como PNG al finalizar.
const signatureCanvas=$('clientSignatureCanvas');
const signatureCtx=signatureCanvas?.getContext('2d');
let signatureHasInk=false,signatureDrawing=false;
function resizeSignatureCanvas(){
  if(!signatureCanvas||!signatureCtx)return;
  const rect=signatureCanvas.getBoundingClientRect();
  // Si el formulario estaba oculto al cargar, el canvas puede haberse creado de 1px.
  // Esperamos a que tenga ancho real antes de dimensionarlo para dibujar correctamente.
  if(!rect.width)return;
  const ratio=Math.max(window.devicePixelRatio||1,1);
  const targetW=Math.max(1,Math.round(rect.width*ratio));
  const targetH=Math.max(1,Math.round(rect.height*ratio));
  if(signatureCanvas.width===targetW&&signatureCanvas.height===targetH)return;
  const old=signatureHasInk?signatureCanvas.toDataURL('image/png'):null;
  signatureCanvas.width=targetW;
  signatureCanvas.height=targetH;
  signatureCtx.setTransform(ratio,0,0,ratio,0,0);
  signatureCtx.lineWidth=2.5;signatureCtx.lineCap='round';signatureCtx.lineJoin='round';signatureCtx.strokeStyle='#142b25';
  if(old){const img=new Image();img.onload=()=>signatureCtx.drawImage(img,0,0,rect.width,rect.height);img.src=old;}
}
function signaturePoint(e){
  const rect=signatureCanvas.getBoundingClientRect();
  return {x:e.clientX-rect.left,y:e.clientY-rect.top};
}
signatureCanvas?.addEventListener('pointerdown',e=>{
  e.preventDefault();
  resizeSignatureCanvas();
  if(!signatureCanvas.width||!signatureCanvas.height)return;
  signatureDrawing=true;signatureCanvas.setPointerCapture?.(e.pointerId);
  const p=signaturePoint(e);signatureCtx.beginPath();signatureCtx.moveTo(p.x,p.y);signatureCtx.lineTo(p.x+.1,p.y+.1);signatureCtx.stroke();signatureHasInk=true;
  if($('signatureHint'))$('signatureHint').textContent='Firma capturada; se adjuntará al finalizar.';
});
signatureCanvas?.addEventListener('pointermove',e=>{
  if(!signatureDrawing)return;e.preventDefault();const p=signaturePoint(e);signatureCtx.lineTo(p.x,p.y);signatureCtx.stroke();
});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>signatureCanvas?.addEventListener(ev,()=>{signatureDrawing=false;}));
function clearClientSignature(){
  if(!signatureCanvas||!signatureCtx)return;
  signatureCtx.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);signatureHasInk=false;
  if($('signatureHint'))$('signatureHint').textContent='Firma pendiente. La firma se adjuntará a la diligencia al finalizar.';
}
$('clearClientSignature')?.addEventListener('click',clearClientSignature);
resizeSignatureCanvas();
window.addEventListener('resize',resizeSignatureCanvas);
async function getClientSignatureFile(){
  if(!signatureCanvas||!signatureHasInk)return null;
  const blob=await new Promise(resolve=>signatureCanvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('No se pudo preparar la firma del cliente.');
  return new File([blob],`firma_cliente_${Date.now()}.png`,{type:'image/png',lastModified:Date.now()});
}

window.showDiligencePhotos=async id=>{
  if(!user||!(isAdmin()||isEvaluator()||isOperator()))return msg('No tiene permiso para consultar evidencias.','error');
  let d=(records||[]).find(x=>String(x.id)===String(id));
  // Fail closed: if the diligence is not in the current list, fetch its owner/assignee before showing any evidence.
  if(!d){
    const {data:diligence,error:diligenceError}=await sb.from('diligencias').select('id,colaborador_id,evaluador_id').eq('id',id).maybeSingle();
    if(diligenceError)return msg('No se pudo verificar el acceso a esta diligencia: '+diligenceError.message,'error');
    d=diligence;
  }
  if(!d)return msg('No se encontró la diligencia o no tiene acceso a ella.','error');
  const allowed=isAdmin()||(isEvaluator()&&String(d.evaluador_id)===String(user.id))||(isOperator()&&String(d.colaborador_id)===String(user.id));
  if(!allowed)return msg('No tiene permiso para ver las fotos de esta diligencia.','error');
  const {data,error}=await sb.from('diligencia_fotos').select('id,storage_path,nombre_archivo,created_at').eq('diligencia_id',String(id)).order('created_at',{ascending:true});
  if(error)return msg('No se pudieron consultar las evidencias: '+error.message,'error');
  let body='<p>No hay fotografías adjuntas a esta diligencia.</p>';
  if(data?.length){const imgs=[];for(const photo of data){const {data:urlData,error:urlErr}=await sb.storage.from(PHOTO_BUCKET).createSignedUrl(photo.storage_path,300);if(!urlErr&&urlData?.signedUrl)imgs.push(`<a href="${urlData.signedUrl}" target="_blank" rel="noopener"><img src="${urlData.signedUrl}" alt="${esc(photo.nombre_archivo||'Evidencia fotográfica')}"><small>${esc(photo.nombre_archivo||'Fotografía')}</small></a>`)}body=imgs.length?`<div class="photo-grid">${imgs.join('')}</div>`:'<p>No fue posible generar los enlaces temporales de las fotografías.</p>'}
  const old=$('diligencePhotoModal');if(old)old.remove();const modal=document.createElement('div');modal.id='diligencePhotoModal';modal.className='photo-modal';modal.innerHTML=`<div class="photo-modal-card"><div class="photo-modal-head"><h2>📷 Evidencias · Diligencia #${esc(id)}</h2><button class="btn secondary" type="button" id="closeDiligencePhotos">Cerrar</button></div>${body}</div>`;document.body.appendChild(modal);$('closeDiligencePhotos').onclick=()=>modal.remove();modal.onclick=e=>{if(e.target===modal)modal.remove()};
};

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

