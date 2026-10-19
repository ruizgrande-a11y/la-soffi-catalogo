let token=localStorage.getItem('laSoffiAdmin')||'',products=[];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]));
const money=p=>'S/'+(Number(p)%1===0?Number(p).toFixed(0):Number(p).toFixed(2));
function headers(extra={}){return {'Content-Type':'application/json','Authorization':`Bearer ${token}`,...extra}}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200)}
function normalizeOptions(p){
  if(Array.isArray(p.priceOptions)&&p.priceOptions.length){
    return p.priceOptions.map(v=>({price:Number(v.price),label:String(v.label||'')}));
  }
  const matches=[...String(p.priceLabel||'').matchAll(/S\/\s*(\d+(?:[.,]\d{1,2})?)/gi)];
  if(matches.length)return [...new Set(matches.map(v=>Number(v[1].replace(',','.'))))].map(price=>({price,label:''}));
  return [{price:Number(p.price||0)||'',label:''}];
}
function renderPrices(options=[{price:'',label:''}]){
  $('pricesEditor').innerHTML='';
  options.forEach(o=>addPriceRow(o));
}
function addPriceRow(value={price:'',label:''}){
  const row=document.createElement('div');
  row.className='admin-price-row';
  row.innerHTML='<label>Precio (S/)<input class="option-price" type="number" required min="0.01" step="0.01" placeholder="Ej. 48"></label><label>Tamaño / presentación (opcional)<input class="option-label" maxlength="80" placeholder="Ej. Grande, mediana, porción..."></label><button type="button" class="btn danger remove-price">Quitar</button>';
  row.querySelector('.option-price').value=value.price??'';
  row.querySelector('.option-label').value=value.label??'';
  row.querySelector('.remove-price').onclick=()=>{
    if($('pricesEditor').children.length===1){alert('El producto debe tener al menos un precio.');return;}
    row.remove();
  };
  $('pricesEditor').append(row);
  row.querySelector('.option-price').focus({preventScroll:true});
}
function collectPrices(){
  const rows=[...$('pricesEditor').querySelectorAll('.admin-price-row')];
  if(!rows.length)throw new Error('Agrega al menos un precio');
  const seen=new Set();
  return rows.map((row,index)=>{
    const input=row.querySelector('.option-price');
    const price=Number(input.value);
    if(!input.value.trim()||!Number.isFinite(price)||price<=0)throw new Error('Revisa el precio de la opción '+(index+1));
    const rounded=Math.round(price*100)/100;
    if(seen.has(rounded))throw new Error('El mismo precio está repetido: '+money(rounded));
    seen.add(rounded);
    return {price:rounded,label:row.querySelector('.option-label').value.trim()};
  });
}
function formatPrices(p){
  const opts=normalizeOptions(p);
  return opts.map(o=>money(o.price)+(o.label?' ('+o.label+')':'')).join(' · ');
}
async function login(user,password){
  const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user,password})});
  const d=await r.json();
  if(!r.ok)throw new Error(d.error||'No se pudo ingresar');
  token=d.token;localStorage.setItem('laSoffiAdmin',token);
  $('login').classList.add('hidden');await load();
}
async function load(){
  const r=await fetch('/api/admin/products',{headers:{Authorization:`Bearer ${token}`}});
  if(r.status===401){localStorage.removeItem('laSoffiAdmin');$('login').classList.remove('hidden');return}
  if(!r.ok)throw new Error('No se pudieron cargar los productos');
  products=await r.json();render();
}
function render(){
  const q=$('adminSearch').value.toLowerCase().trim();
  const list=products.filter(p=>!q||`${p.name} ${p.category}`.toLowerCase().includes(q));
  $('stats').textContent=`${products.length} productos · ${products.filter(p=>p.active!==false).length} visibles`;
  $('categories').innerHTML=[...new Set(products.map(p=>p.category))].sort().map(c=>`<option value="${esc(c)}">`).join('');
  $('productList').innerHTML=list.map(p=>`<div class="admin-product"><img src="${esc(p.image)}" alt=""><div><h4>${esc(p.name)} ${p.active===false?'· Oculto':''}</h4><small>${esc(p.category)} · ${esc(formatPrices(p))}</small></div><div class="admin-product-actions"><button class="btn ghost" data-edit="${esc(p.id)}">Editar</button><button class="btn danger" data-del="${esc(p.id)}">Eliminar</button></div></div>`).join('')||'<div class="empty">Sin resultados.</div>';
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.edit));
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>remove(b.dataset.del));
}
function clearForm(){
  $('editId').value='';$('productForm').reset();$('active').value='true';$('image').value='';$('saveBtn').textContent='Guardar producto';renderPrices();
}
function edit(id){
  const p=products.find(x=>x.id===id);if(!p)return;
  $('editId').value=p.id;$('name').value=p.name;$('category').value=p.category;
  renderPrices(normalizeOptions(p));
  $('description').value=p.description||'';$('image').value=p.image||'';$('imageFile').value='';
  $('active').value=p.active===false?'false':'true';$('featured').checked=!!p.featured;
  $('saveBtn').textContent='Actualizar producto';scrollTo({top:0,behavior:'smooth'});
}
async function uploadIfNeeded(){
  const f=$('imageFile').files[0];if(!f)return $('image').value.trim();
  const r=await fetch(`/api/upload?name=${encodeURIComponent(f.name)}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':f.type||'application/octet-stream'},body:f});
  const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo subir la imagen');return d.url;
}
async function save(e){
  e.preventDefault();
  try{
    const priceOptions=collectPrices();
    const image=await uploadIfNeeded()||'/assets/categories/tortas.jpg';
    const body={name:$('name').value.trim(),category:$('category').value.trim(),priceOptions,description:$('description').value.trim(),image,featured:$('featured').checked,active:$('active').value==='true'};
    const id=$('editId').value;
    const r=await fetch(id?`/api/products/${encodeURIComponent(id)}`:'/api/products',{method:id?'PUT':'POST',headers:headers(),body:JSON.stringify(body)});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'No se pudo guardar');
    toast(id?'Producto actualizado':'Producto creado');
    clearForm();await load();
  }catch(err){alert(err.message)}
}
async function remove(id){
  const p=products.find(x=>x.id===id);
  if(!confirm(`¿Eliminar “${p?.name||id}”?`))return;
  const r=await fetch(`/api/products/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
  const d=await r.json();if(!r.ok)return alert(d.error||'No se pudo eliminar');toast('Producto eliminado');await load();
}
$('loginForm').onsubmit=e=>{e.preventDefault();$('loginError').textContent='';login($('user').value,$('password').value).catch(err=>$('loginError').textContent=err.message)};
$('productForm').onsubmit=save;
$('addPrice').onclick=()=>addPriceRow();
$('cancelBtn').onclick=clearForm;
$('newBtn').onclick=()=>{clearForm();scrollTo({top:0,behavior:'smooth'})};
$('adminSearch').oninput=render;
$('logout').onclick=()=>{localStorage.removeItem('laSoffiAdmin');location.reload()};
renderPrices();
if(token)load().catch(err=>alert(err.message));
