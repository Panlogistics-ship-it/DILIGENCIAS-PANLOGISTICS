function today(){let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dur(a,b){if(!a||!b)return 0;let [h,m]=a.split(':').map(Number),[x,y]=b.split(':').map(Number),n=x*60+y-h*60-m;if(n<0)n+=1440;return n/60}
function money(n){return (Number(n)||0).toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:2})}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
