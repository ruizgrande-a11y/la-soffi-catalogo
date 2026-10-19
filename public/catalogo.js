let products=[],settings={},activeCategory='Todos',query='',currentProduct=null;
const cart=new Map();
let selectedPrice=null;
const categoryImages={
'Todos':'/assets/categories/todas_categoria.webp','Tortas':'/assets/categories/tortas_categoria.webp','Minitortas':'/assets/categories/minitortas_categoria.webp','Postres':'/assets/categories/postres_categoria.webp','Postres Personales':'/assets/categories/postres-personales_categoria.webp','Pasteles':'/assets/categories/pasteles_categoria.webp','Empanadas':'/assets/categories/empanadas_categoria.webp','Bocaditos':'/assets/categories/bocaditos_categoria.webp','Kekes':'/assets/categories/kekes_categoria.webp','Helados Artesanales':'/assets/categories/helados_categoria.webp'};
const fallbackFor=c=>categoryImages[c]||'/assets/categories/todas_categoria.webp';
function priceOptions(product) {
  const matches=[...String(product.priceLabel||'').matchAll(/S\/\s*(\d+(?:[.,]\d{1,2})?)/gi)];
  const options=[];
  for(const match of matches) {
    const price=Number(match[1].replace(',','.'));
    if(Number.isFinite(price)&&price>=0&&!options.some(item=>item.price===price)) {
      options.push({price,label:`S/${match[1].replace(',','.')}`});
    }
  }
  if(options.length===0) {
    const price=Number(product.price||0);
    options.push({price:Number.isFinite(price)?price:0,label:money(price)});
  }
  return options;
}
function cartLineKey(id,price){return `${id}::${Number(price).toFixed(2)}`;}
function quickAdd(id) {
  const p=products.find(item=>item.id===id);
  if(!p)return;
  const choices=priceOptions(p);
  if(choices.length>1)openModal(id);
  else addToCart(id,choices[0].price);
}
const money=n=>`S/${Number(n||0).toFixed(2)}`;
const esc=s=>String(s??'').replace(/[&<>'\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','\"':'&quot;'}[m]));
function wireImageFallbacks(root=document){root.querySelectorAll('img[data-fallback]').forEach(img=>{img.onerror=()=>{if(img.src.endsWith(img.dataset.fallback))return;img.src=img.dataset.fallback}})}
async function init(){[products,settings]=await Promise.all([fetch('/api/products').then(r=>r.json()),fetch('/api/settings').then(r=>r.json())]);renderStories();render();bind();}
function bind(){document.getElementById('search').addEventListener('input',e=>{query=e.target.value.toLowerCase().trim();render()});document.getElementById('modalClose').onclick=closeModal;document.getElementById('overlay').onclick=()=>{closeModal();closeCart()};document.getElementById('cartBtn').onclick=openCart;document.getElementById('drawerClose').onclick=closeCart;document.getElementById('modalAdd').onclick=()=>{if(currentProduct&&selectedPrice!==null){addToCart(currentProduct.id,selectedPrice);closeModal()}};document.getElementById('sendWhatsApp').onclick=sendWhatsApp}
function renderStories(){const cats=['Todos',...new Set(products.map(p=>p.category))];const el=document.getElementById('stories');el.innerHTML=cats.map(c=>`<button class="story ${c===activeCategory?'active':''}" data-cat="${esc(c)}"><img src="${fallbackFor(c)}" alt="${esc(c)}"><span>${esc(c)}</span></button>`).join('');el.querySelectorAll('.story').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;renderStories();render()})}
function filtered(){return products.filter(p=>(activeCategory==='Todos'||p.category===activeCategory)&&(!query||`${p.name} ${p.category} ${p.description}`.toLowerCase().includes(query)))}
function render(){const list=filtered();document.getElementById('sectionTitle').textContent=activeCategory==='Todos'?'Todo el catálogo':activeCategory;document.getElementById('resultsCount').textContent=`${list.length} producto${list.length===1?'':'s'}`;const grid=document.getElementById('grid');if(!list.length){grid.innerHTML='<div class="empty">No encontramos productos con esa búsqueda.</div>';return}grid.innerHTML=list.map(p=>`<article class="product-card" data-id="${p.id}"><div class="product-media"><img src="${esc(p.image)}" data-fallback="${fallbackFor(p.category)}" alt="${esc(p.name)}" loading="lazy">${p.featured?'<span class="badge">Favorito</span>':''}</div><div class="product-body"><h4>${esc(p.name)}</h4><p>${esc(p.description)}</p><div class="product-footer"><span class="price">${esc(p.priceLabel||money(p.price))}</span><button class="mini-add" data-add="${p.id}" aria-label="Agregar">+</button></div></div></article>`).join('');wireImageFallbacks(grid);grid.querySelectorAll('.product-card').forEach(card=>card.onclick=e=>{if(e.target.closest('[data-add]'))return;openModal(card.dataset.id)});grid.querySelectorAll('[data-add]').forEach(b=>b.onclick=e=>{e.stopPropagation();quickAdd(b.dataset.add)})}
function openModal(id) {
  currentProduct=products.find(p=>p.id===id);
  if(!currentProduct)return;
  const img=document.getElementById('modalImage');
  img.onerror=null;
  img.src=currentProduct.image;
  img.alt=currentProduct.name;
  img.onerror=()=>{img.onerror=null;img.src=fallbackFor(currentProduct.category);};
  document.getElementById('modalCategory').textContent=currentProduct.category;
  document.getElementById('modalName').textContent=currentProduct.name;
  document.getElementById('modalDescription').textContent=currentProduct.description;
  const choices=priceOptions(currentProduct);
  const multiple=choices.length>1;
  selectedPrice=multiple?null:choices[0].price;
  const modalPrice=document.getElementById('modalPrice');
  modalPrice.textContent=currentProduct.priceLabel||money(currentProduct.price);
  const selector=document.getElementById('modalOptions');
  selector.hidden=!multiple;
  const buttons=document.getElementById('priceChoices');
  buttons.innerHTML=multiple?choices.map(c=>`<button type="button" class="price-choice" data-price="${c.price}" aria-pressed="false">${esc(c.label)}</button>`).join(''):'';
  const add=document.getElementById('modalAdd');
  add.disabled=multiple;
  add.textContent=multiple?'Selecciona un precio':'Agregar al pedido';
  const help=document.getElementById('priceHelp');
  help.textContent='Selecciona el importe. El tamaño o presentación se confirma con La Soffi.';
  buttons.querySelectorAll('[data-price]').forEach(btn=>{
    btn.onclick=()=>{
      selectedPrice=Number(btn.dataset.price);
      buttons.querySelectorAll('[data-price]').forEach(choice=>{
        const active=choice===btn;
        choice.classList.toggle('selected',active);
        choice.setAttribute('aria-pressed',String(active));
      });
      modalPrice.textContent=money(selectedPrice);
      add.disabled=false;
      add.textContent=`Agregar al pedido · ${money(selectedPrice)}`;
      help.textContent=`Precio seleccionado: ${money(selectedPrice)}. Tamaño o presentación por confirmar.`;
    };
  });
  document.getElementById('overlay').classList.add('open');
  document.getElementById('productModal').classList.add('open');
}
function closeModal(){document.getElementById('productModal').classList.remove('open');if(!document.getElementById('drawer').classList.contains('open'))document.getElementById('overlay').classList.remove('open')}
function addToCart(id,price) {
  const product=products.find(item=>item.id===id);
  if(!product)return;
  const option=priceOptions(product).find(item=>item.price===Number(price));
  if(!option){openModal(id);return;}
  const key=cartLineKey(id,option.price);
  const line=cart.get(key)||{key,id,unitPrice:option.price,label:option.label,qty:0};
  line.qty++;
  cart.set(key,line);
  updateCart();
  const button=document.getElementById('cartBtn');
  if(button.animate)button.animate([{transform:'scale(1)'},{transform:'scale(1.15)'},{transform:'scale(1)'}],{duration:260});
}
function updateCart() {
  const lines=[...cart.values()].map(line=>({...line,p:products.find(item=>item.id===line.id)})).filter(line=>line.p);
  document.getElementById('cartCount').textContent=lines.reduce((total,line)=>total+line.qty,0);
  const area=document.getElementById('cartItems');
  area.innerHTML=lines.length?lines.map(line=>`<div class="cart-item"><img src="${esc(line.p.image)}" data-fallback="${esc(fallbackFor(line.p.category))}" alt=""><div><strong>${esc(line.p.name)}</strong><div class="price">${money(line.unitPrice)} c/u</div><div class="qty"><button type="button" data-dec="${esc(line.key)}" aria-label="Quitar una unidad">−</button><span>${line.qty}</span><button type="button" data-inc="${esc(line.key)}" aria-label="Agregar una unidad">+</button></div><small>Subtotal: ${money(line.qty*line.unitPrice)}</small></div><button class="icon-btn" type="button" data-del="${esc(line.key)}" aria-label="Quitar producto">×</button></div>`).join(''):'<div class="empty">Aún no agregaste productos.</div>';
  wireImageFallbacks(area);
  document.getElementById('cartTotal').textContent=money(lines.reduce((sum,line)=>sum+line.qty*line.unitPrice,0));
  area.querySelectorAll('[data-inc]').forEach(btn=>btn.onclick=()=>{
    const line=cart.get(btn.dataset.inc);
    if(line){line.qty++;updateCart();}
  });
  area.querySelectorAll('[data-dec]').forEach(btn=>btn.onclick=()=>{
    const line=cart.get(btn.dataset.dec);
    if(line){line.qty--;if(line.qty<=0)cart.delete(line.key);updateCart();}
  });
  area.querySelectorAll('[data-del]').forEach(btn=>btn.onclick=()=>{
    cart.delete(btn.dataset.del);updateCart();
  });
}
function openCart(){closeModal();document.getElementById('overlay').classList.add('open');document.getElementById('drawer').classList.add('open');updateCart()}
function closeCart(){document.getElementById('drawer').classList.remove('open');document.getElementById('overlay').classList.remove('open')}
function sendWhatsApp() {
  if(!cart.size)return alert('Agrega al menos un producto al pedido.');
  const lines=[...cart.values()].map(line=>({...line,p:products.find(item=>item.id===line.id)})).filter(line=>line.p);
  if(!lines.length)return alert('No hay productos disponibles en tu pedido.');
  const summary=lines.map(line=>`• ${line.qty} x ${line.p.name} (opción ${line.label}, ${money(line.unitPrice)} c/u) = ${money(line.qty*line.unitPrice)}`);
  const total=lines.reduce((sum,line)=>sum+line.qty*line.unitPrice,0);
  const msg=`Hola ${settings.name||'La Soffi'} 👋\nQuisiera consultar por este pedido:\n\n${summary.join('\n')}\n\nTotal referencial: ${money(total)}\n¿Me confirman tamaños o presentaciones, disponibilidad y total final?`;
  window.open(`https://wa.me/${settings.phone||'51967063313'}?text=${encodeURIComponent(msg)}`,'_blank');
}
init().catch(()=>document.getElementById('grid').innerHTML='<div class="empty">No pudimos cargar el catálogo. Intenta nuevamente.</div>');
