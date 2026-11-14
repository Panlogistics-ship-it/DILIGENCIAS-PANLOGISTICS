
const SUPABASE_URL='https://ekqgkroulelmrwldgwjt.supabase.co';
const SUPABASE_KEY='sb_publishable_hogn0O3Pu9RGjSacDrxqIg_S2TJpvrm';

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


