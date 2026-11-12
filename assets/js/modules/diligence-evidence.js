// Fotografías, firma del cliente y consulta segura de evidencias de diligencias.
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
