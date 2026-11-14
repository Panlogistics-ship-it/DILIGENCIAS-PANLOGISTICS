// Cálculo del bono quincenal de productividad de Jhonatan Valencia.
async function loadProductivityBonusDashboard(){
  const scoreEl=$('dashBonusScore'), amountEl=$('dashBonusAmount'), periodEl=$('dashBonusPeriod');
  if(!scoreEl||!amountEl||!periodEl||!user)return;
  const todayDate=today(), parts=todayDate.split('-').map(Number), year=parts[0], month=parts[1], day=parts[2];
  const period=day<=15?'1-15':'16-FIN', periodLabel=day<=15?'1 al 15':'16 al '+new Date(year,month,0).getDate();
  periodEl.textContent=`Jhonatan Valencia · ${periodLabel} de ${String(month).padStart(2,'0')}/${year}`;
  scoreEl.textContent='—'; amountEl.textContent='Pendiente';
  try{
    await loadProfiles();
    const targetProfile=(profiles||[]).find(p=>/jhonatan\s+valencia/i.test(String(p.full_name||'')));
    if(!targetProfile){scoreEl.textContent='Sin perfil';amountEl.textContent='—';return;}
    const {data,error}=await sb.from('evaluaciones').select('puntuacion').eq('anio',year).eq('mes',month).eq('colaborador_id',targetProfile.id).eq('periodo',period);
    if(error)throw error;
    const scores=(data||[]).map(x=>Number(x.puntuacion)).filter(x=>Number.isFinite(x));
    if(!scores.length){scoreEl.textContent='Pendiente';amountEl.textContent='Pendiente';return;}
    const score=scores.reduce((sum,x)=>sum+x,0)/scores.length;
    const bonus=Math.max(0,Math.min(100,score))/100*75;
    scoreEl.textContent=score.toFixed(2)+'%';
    amountEl.textContent='B/. '+money(bonus);
  }catch(err){scoreEl.textContent='No disponible';amountEl.textContent='No disponible';console.error('No se pudo calcular el bono quincenal',err);}
}
