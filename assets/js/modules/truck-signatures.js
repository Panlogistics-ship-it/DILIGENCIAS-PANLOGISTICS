// Firmas digitales del control semanal Hino AT8811.
const truckSignatureState={operator:false,supervisor:false};
const truckSignatureCanvasIds={operator:'truckOperatorSignature',supervisor:'truckSupervisorSignature'};
function truckSignatureInitOne(role){
  const canvas=$(truckSignatureCanvasIds[role]);if(!canvas||canvas.dataset.ready==='1')return;
  const ctx=canvas.getContext('2d');canvas.width=1000;canvas.height=300;ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#173b32';
  let drawing=false;
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();drawing=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.5,p.y+.5);ctx.stroke();truckSignatureState[role]=true;truckSignatureUpdateHint(role)});
  canvas.addEventListener('pointermove',e=>{if(!drawing)return;e.preventDefault();const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke()});
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>canvas.addEventListener(ev,()=>drawing=false));
  canvas.dataset.ready='1';
}
function truckSignatureUpdateHint(role){const el=$(role==='operator'?'truckOperatorSignatureHint':'truckSupervisorSignatureHint');if(el)el.textContent='Firma capturada correctamente.'}
function truckInitSignatures(){truckSignatureInitOne('operator');truckSignatureInitOne('supervisor')}
function truckClearSignature(role){const canvas=$(truckSignatureCanvasIds[role]);if(!canvas)return;canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);truckSignatureState[role]=false;const el=$(role==='operator'?'truckOperatorSignatureHint':'truckSupervisorSignatureHint');if(el)el.textContent='Firma pendiente.'}
function truckClearSignatures(){truckClearSignature('operator');truckClearSignature('supervisor')}
async function truckGetSignatureFile(role){if(!truckSignatureState[role])return null;const canvas=$(truckSignatureCanvasIds[role]);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('No se pudo preparar la firma de '+(role==='operator'?'Jhonatan Valencia':'Richard Albornoz')+'.');return new File([blob],'firma_'+role+'_'+Date.now()+'.png',{type:'image/png',lastModified:Date.now()})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-truck-clear-signature]');if(b)truckClearSignature(b.dataset.truckClearSignature)});
truckInitSignatures();
