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


