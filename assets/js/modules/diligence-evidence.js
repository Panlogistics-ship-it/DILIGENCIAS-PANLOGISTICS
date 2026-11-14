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
