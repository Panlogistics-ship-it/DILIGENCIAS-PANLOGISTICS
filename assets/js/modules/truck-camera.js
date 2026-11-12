// Cámara y selección fotográfica del control semanal Hino AT8811.
let truckCameraStream=null,truckCameraTarget=null,truckCameraDraftBlob=null,truckCameraDraftUrl=null,truckCameraFacing='environment';
function truckUpdatePhotoProgress(stage){
  const total=TRUCK_ANGLES.filter(a=>truckPhotoSelections[stage][a.id]?.file).length;
  const target=$(stage==='retiro'?'truckWithdrawalPhotoProgress':'truckReturnPhotoProgress');
  if(target)target.textContent=total+' de 4 capturadas'+(total===4?' · Completo':'');
}
function truckBuildPhotoSlots(stage){
  const host=$(stage==='retiro'?'truckWithdrawalPhotos':'truckReturnPhotos');if(!host)return;
  host.innerHTML=TRUCK_ANGLES.map(a=>'<div class="truck-camera-item"><button class="truck-camera-slot" type="button" data-truck-camera="'+stage+'" data-angle="'+a.id+'" aria-label="Abrir cámara: '+a.label+'"><span class="camera-placeholder"><span class="camera-icon">📷</span><span>Toca para tomar foto</span></span><strong>'+a.label+'</strong></button></div>').join('');
  truckUpdatePhotoProgress(stage);
}
function truckRenderPhotoSlot(stage,angle){
  const selection=truckPhotoSelections[stage][angle],button=document.querySelector('[data-truck-camera="'+stage+'"][data-angle="'+angle+'"]');if(!button)return;
  const label=TRUCK_ANGLES.find(a=>a.id===angle)?.label||angle;
  button.innerHTML=selection?.previewUrl?'<img src="'+selection.previewUrl+'" alt="'+label+'"><strong>'+label+'</strong><span class="camera-retake">✓ Foto capturada · toca para repetir</span>':'<span class="camera-placeholder"><span class="camera-icon">📷</span><span>Toca para tomar foto</span></span><strong>'+label+'</strong>';
  truckUpdatePhotoProgress(stage);
}
function truckClearPhotoSelections(stage){
  const stages=stage?[stage]:['retiro','entrega'];
  stages.forEach(k=>{TRUCK_ANGLES.forEach(a=>{const f=truckPhotoSelections[k][a.id];if(f?.previewUrl)URL.revokeObjectURL(f.previewUrl)});truckPhotoSelections[k]={};truckBuildPhotoSlots(k)});
}
function truckStopCamera(){
  if(truckCameraStream){truckCameraStream.getTracks().forEach(t=>t.stop());truckCameraStream=null}
  const video=$('truckCameraVideo');if(video)video.srcObject=null;
}
function truckCloseCamera(){
  truckStopCamera();if(truckCameraDraftUrl){URL.revokeObjectURL(truckCameraDraftUrl);truckCameraDraftUrl=null}
  truckCameraDraftBlob=null;truckCameraTarget=null;$('truckCameraModal').hidden=true;
}
async function truckStartCamera(){
  truckStopCamera();$('truckCameraCapture').disabled=false;$('truckCameraError').hidden=true;$('truckCameraLiveActions').hidden=true;$('truckCameraPreviewActions').hidden=true;$('truckCameraPreview').hidden=true;$('truckCameraVideo').hidden=false;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){$('truckCameraError').hidden=false;$('truckCameraError').textContent='El navegador no permite abrir la cámara. Accede mediante HTTPS y utiliza un navegador actualizado.';$('truckCameraCancel').textContent='Cerrar';$('truckCameraLiveActions').hidden=false;return}
  try{
    truckCameraStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:truckCameraFacing},width:{ideal:1920},height:{ideal:1080}}});
    const video=$('truckCameraVideo');video.srcObject=truckCameraStream;await video.play();$('truckCameraLiveActions').hidden=false;$('truckCameraCapture').disabled=false;$('truckCameraCancel').textContent='Cancelar';
  }catch(err){
    $('truckCameraError').hidden=false;
    $('truckCameraError').textContent=err.name==='NotAllowedError'?'No se concedió permiso para usar la cámara. Autoriza la cámara en el navegador y vuelve a intentarlo.':err.name==='NotFoundError'?'Este dispositivo no tiene una cámara disponible.':'No se pudo abrir la cámara: '+(err.message||err.name);
    $('truckCameraLiveActions').hidden=false;$('truckCameraCapture').disabled=true;$('truckCameraCancel').textContent='Cerrar';
  }
}
async function truckOpenCamera(stage,angle){
  truckCameraTarget={stage,angle};const label=TRUCK_ANGLES.find(a=>a.id===angle)?.label||angle;
  $('truckCameraTitle').textContent=(stage==='retiro'?'Fotografía del retiro':'Fotografía de la entrega')+' · '+label;
  $('truckCameraSubtitle').textContent='Hino AT8811 · '+(stage==='retiro'?'Recepción del camión':'Devolución del camión');
  $('truckCameraModal').hidden=false;await truckStartCamera();
}
function truckCapturePhoto(){
  const video=$('truckCameraVideo');if(!video.videoWidth||!video.videoHeight)return;
  const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  canvas.toBlob(blob=>{
    if(!blob){$('truckCameraError').hidden=false;$('truckCameraError').textContent='No se pudo procesar la fotografía. Inténtalo nuevamente.';return}
    truckCameraDraftBlob=blob;truckCameraDraftUrl=URL.createObjectURL(blob);truckStopCamera();
    $('truckCameraVideo').hidden=true;$('truckCameraPreview').src=truckCameraDraftUrl;$('truckCameraPreview').hidden=false;
    $('truckCameraLiveActions').hidden=true;$('truckCameraPreviewActions').hidden=false;
  },'image/jpeg',0.9);
}
async function truckRetakePhoto(){
  if(truckCameraDraftUrl){URL.revokeObjectURL(truckCameraDraftUrl);truckCameraDraftUrl=null}
  truckCameraDraftBlob=null;await truckStartCamera();
}
function truckConfirmPhoto(){
  if(!truckCameraTarget||!truckCameraDraftBlob)return;
  const {stage,angle}=truckCameraTarget,label=TRUCK_ANGLES.find(a=>a.id===angle)?.label||angle;
  const file=new File([truckCameraDraftBlob],'Hino_AT8811_'+stage+'_'+angle+'_'+Date.now()+'.jpg',{type:'image/jpeg',lastModified:Date.now()});
  const old=truckPhotoSelections[stage][angle];if(old?.previewUrl)URL.revokeObjectURL(old.previewUrl);
  const previewUrl=URL.createObjectURL(file);truckPhotoSelections[stage][angle]={file,previewUrl};
  truckCloseCamera();truckRenderPhotoSlot(stage,angle);truckStatus('Fotografía confirmada: '+label+'.','ok');
}
document.addEventListener('click',e=>{const button=e.target.closest('[data-truck-camera]');if(button)truckOpenCamera(button.dataset.truckCamera,button.dataset.angle)});
$('truckCameraCapture').addEventListener('click',truckCapturePhoto);
$('truckCameraRetake').addEventListener('click',truckRetakePhoto);
$('truckCameraUse').addEventListener('click',truckConfirmPhoto);
$('truckCameraCancel').addEventListener('click',truckCloseCamera);
$('truckCameraModal').addEventListener('click',e=>{if(e.target===$('truckCameraModal'))truckCloseCamera()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('truckCameraModal').hidden)truckCloseCamera()});
