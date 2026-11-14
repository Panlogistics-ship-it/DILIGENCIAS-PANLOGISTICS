function printQuincenalReport(){
  const preview=$('reportPreview');
  if(!preview || !preview.querySelector('.report-page')) return msg('Primero genera el reporte quincenal para poder imprimirlo.','error');
  const frame=document.createElement('iframe');
  frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);
  const doc=frame.contentDocument;
  const styles=[...document.querySelectorAll('style,link[rel="stylesheet"]')].map(node=>node.outerHTML).join('\n');
  const reportHtml=preview.innerHTML;
  doc.open();
  doc.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reporte quincenal · PANLOGISTICS GROUP, S.A.</title>'+styles+
    '<style>@page{size:Letter portrait;margin:0.34in 0.42in}html,body{margin:0!important;padding:0!important;width:auto!important;height:auto!important;background:#fff!important;overflow:visible!important}body{display:block!important}body>main{display:block!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important}#app{display:block!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important}#reportsView{display:block!important;width:auto!important;margin:0!important;padding:0!important}#reportPreview{display:block!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important}.report-preview-wrap{display:block!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important;overflow:visible!important;background:#fff!important}.report-page{display:block!important;width:100%!important;max-width:none!important;min-height:0!important;height:auto!important;margin:0!important;padding:0!important;box-sizing:border-box!important;box-shadow:none!important;overflow:visible!important}.report-table{width:100%!important;break-inside:auto!important;page-break-inside:auto!important}.report-table thead{display:table-header-group!important}.report-table tr{break-inside:avoid!important;page-break-inside:avoid!important}.report-section-title{break-after:avoid-page!important;page-break-after:avoid!important}</style>'+
    '</head><body><main><div id="app"><section id="reportsView"><div id="reportPreview">'+reportHtml+'</div></section></div></main></body></html>');
  doc.close();
  const cleanup=()=>{if(frame.isConnected)frame.remove()};
  frame.contentWindow.addEventListener('afterprint',cleanup,{once:true});
  const doPrint=()=>{try{frame.contentWindow.focus();frame.contentWindow.print();setTimeout(cleanup,60000)}catch(error){cleanup();msg('No se pudo abrir la impresión: '+error.message,'error')}};
  if(doc.readyState==='complete') setTimeout(doPrint,250); else frame.onload=()=>setTimeout(doPrint,250);
}
$('printReport').onclick=printQuincenalReport;

function download(s,type,name){let a=document.createElement('a'),u=URL.createObjectURL(new Blob([s],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$('exportJson').onclick=async()=>{
  let data=filtered(), evaluations=[];
  const {data:ev}=await sb.from('evaluaciones').select('*').order('anio',{ascending:false}).order('mes',{ascending:false});
  evaluations=ev||[];
  download(JSON.stringify({version:5,exportedAt:new Date().toISOString(),data:{entries:data,evaluations,reportSettings:{empresa:'PANLOGISTICS GROUP, S.A.'}}},null,2),'application/json',`Panlogistics_Respaldo_${today()}.json`)
};
$('exportCsv').onclick=()=>{let cols=['date','colaborador','departamento','cargo','destino','motivo','salida','regreso','hours','sobre','viatico','codigo','supervisor','obs','aprob'];download('\ufeff'+[cols.join(';'),...filtered().map(x=>cols.map(k=>'"'+String(x[k]??'').replace(/"/g,'""')+'"').join(';'))].join('\r\n'),'text/csv;charset=utf-8',`Panlogistics_Diligencias_${today()}.csv`)};

$('importBtn').onclick=async()=>{
  let f=$('importFile').files[0];if(!f)return msg('Selecciona un archivo JSON.','error');
  try{
    let j=JSON.parse(await f.text()),arr=Array.isArray(j)?j:(j.data?.entries||j.entries);
    if(!Array.isArray(arr))throw Error('El JSON no contiene diligencias.');
    let added=0;
    for(let x of arr){
      let row={date:x.date,month:x.month||x.date?.slice(0,7),q:x.q||Math.ceil(Number(x.date?.slice(8,10))/15),
        colaborador:x.colaborador||'',departamento:x.departamento||'Mensajería',cargo:x.cargo||'Mensajero',
        destino:x.destino||'',motivo:x.motivo||'',salida:x.salida||'',regreso:x.regreso||'',hours:Number(x.hours)||0,
        sobre:Number(x.sobre)||0,viatico:Number(x.viatico)||0,codigo:x.codigo||'',supervisor:x.supervisor||'',
        obs:x.obs||'',aprob:x.aprob||'Pendiente',evaluador_id:x.evaluador_id||null,created_by:user.id};
      let {error}=await sb.from('diligencias').insert(row);
      if(error)throw error; added++;
    }
    msg(`Importación procesada: ${added} registros enviados.`,'ok');loadRecords();
  }catch(e){msg('Error de importación: '+e.message,'error')}
};


