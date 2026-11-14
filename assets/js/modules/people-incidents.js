async function loadProfile(){
  if(!user)return;
  const {data,error}=await sb.from('profiles').select('id,email,full_name,role,active').eq('id',user.id).maybeSingle();
  if(error){msg('No se pudo verificar el perfil: '+error.message,'error');return}
  currentProfile=data;
}

async function loadProfiles(){
  const {data,error}=await sb.from('profiles').select('id,full_name,email,role,active').eq('active',true).order('full_name');
  if(error){msg('No se pudieron cargar los mensajeros: '+error.message,'error');return []}
  profiles=data||[];
  return profiles;
}

async function loadAllProfiles(){
  const {data,error}=await sb.from('profiles').select('id,full_name,email,role,active,created_at,updated_at').order('full_name');
  if(error){msg('No se pudieron cargar los usuarios: '+error.message,'error');return []}
  return data||[];
}

function roleClass(r){r=String(r||'').toUpperCase();return r==='ADMIN'?'admin':r==='EVALUADOR'?'eval':'op'}

async function loadUsersData(){
  if(!isAdmin())return;
  const arr=await loadAllProfiles();
  $('usersTable').innerHTML=arr.length?arr.map(p=>{
    const self=String(p.id)===String(user?.id);
    return `<tr><td><strong>${esc(p.full_name||'Sin nombre')}</strong><br><span class="role-badge ${roleClass(p.role)}">${esc(p.role)}</span></td><td>${esc(p.email||'')}</td><td><select id="urole_${p.id}" ${self?'disabled':''}><option ${p.role==='OPERADOR'?'selected':''}>OPERADOR</option><option ${p.role==='EVALUADOR'?'selected':''}>EVALUADOR</option><option ${p.role==='ADMIN'?'selected':''}>ADMIN</option></select></td><td><label><input id="uactive_${p.id}" type="checkbox" ${p.active?'checked':''} ${self?'disabled':''}> Activo</label></td><td><div class="user-actions"><button class="btn secondary" type="button" onclick="saveUserProfile('${p.id}')" ${self?'disabled':''}>Guardar</button></div></td></tr>`;
  }).join(''):'<tr><td colspan="5">No hay perfiles.</td></tr>';
}

window.saveUserProfile=async id=>{
  if(!isAdmin())return msg('Solo ADMIN puede administrar usuarios.','error');
  if(String(id)===String(user?.id))return msg('No puede cambiar su propio rol o estado desde esta pantalla.','error');
  const role=$('urole_'+id)?.value,active=$('uactive_'+id)?.checked;
  if(!['ADMIN','OPERADOR','EVALUADOR'].includes(role))return msg('Rol no válido.','error');
  const {error}=await sb.from('profiles').update({role,active,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return msg('No se pudo actualizar el usuario: '+error.message,'error');
  msg('Usuario actualizado correctamente.','ok');
  await loadUsersData();await loadProfiles();fillCollaboratorSelects();
};
$('refreshUsers').onclick=loadUsersData;
