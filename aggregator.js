let allProducts = [], allShops = [], activeProducts = [], currentPage = 1;
const ITEMS_PER_PAGE = 12;

async function initMarketplace() {
    try {
        const res = await fetch('shops.json');
        allShops = await res.json();
        document.getElementById('shop-count').textContent = allShops.length;
        window.allShops = allShops;

        renderShopLogos();

        const promises = allShops.map(shop => fetchProducts(shop));
        const results = await Promise.all(promises);
        results.forEach(items => {
            const rev = items.reverse();
            rev.forEach((p,i) => { if(i<3) p.isNew=true; });
            allProducts = [...allProducts, ...rev];
        });

        document.getElementById('loader').style.display = 'none';
        renderFlashSales();
        generateFilters();
        sortAndRender('random');
    } catch (e) { document.getElementById('loader').textContent = "Erreur chargement."; }
}

async function fetchProducts(shop) {
    try {
        const res = await fetch(`${shop.url}/data/produits.json`);
        if(!res.ok) return [];
        const data = await res.json();
        const items = data.items ? data.items : data;
        return items.map(p => ({
            ...p, globalId: shop.id + "_" + p.id, shopName: shop.name, shopUrl: shop.url, shopLoc: shop.location, isVerified: shop.verified,
            shopLat: shop.lat, shopLng: shop.lng, // Pour le tri GPS
            image: p.image.startsWith('http') ? p.image : `${shop.url}/${p.image}`
        }));
    } catch { return []; }
}

// --- LOGOS AVEC INDICATEUR OUVERT/FERMÉ ---
function renderShopLogos() {
    const cont = document.getElementById('shops-slider');
    if(!cont) return;
    cont.innerHTML = '';
    
    // Heure actuelle au Togo
    const now = new Date();
    const hour = now.getHours();
    const isOpen = hour >= 8 && hour < 19; // Ouvert entre 8h et 19h
    const statusClass = isOpen ? 'status-open' : 'status-closed';

    allShops.forEach(s => {
        const logo = s.logo || 'https://img.icons8.com/color/96/shop.png';
        const verif = s.verified ? `<div class="verified-badge-icon">✓</div>` : '';
        cont.innerHTML += `
            <a href="${s.url}" target="_blank" class="shop-bubble">
                <div class="shop-avatar-container">
                    <img src="${logo}">
                    ${verif}
                    <div class="status-dot ${statusClass}" title="${isOpen ? 'Ouvert' : 'Fermé'}"></div>
                </div>
                <span>${s.name}</span>
            </a>`;
    });
}

// --- TRI INTELLIGENT (INCLUANT GPS) ---
function sortAndRender(criteria) {
    currentPage = 1; 
    filterData(false);

    if (criteria === 'random') {
        activeProducts.sort(() => 0.5 - Math.random());
    } else if (criteria === 'new') {
        activeProducts.sort((a,b) => (b.isNew===true)-(a.isNew===true));
    } else if (criteria === 'price-asc') {
        activeProducts.sort((a,b) => a.prix - b.prix);
    } else if (criteria === 'dist') {
        // Option 10 : TRI PAR DISTANCE
        sortByDistance();
        return; // sortByDistance appelle renderProducts lui-même
    }
    
    renderProducts(activeProducts);
}

// Option 10 : Logique GPS
function sortByDistance() {
    if (!navigator.geolocation) {
        alert("GPS non supporté");
        return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        
        activeProducts.forEach(p => {
            if (p.shopLat) p.distance = getDist(lat, lng, p.shopLat, p.shopLng);
            else p.distance = 9999;
        });
        
        activeProducts.sort((a, b) => a.distance - b.distance);
        renderProducts(activeProducts);
        alert("Produits triés par proximité !");
    }, () => alert("Activez votre GPS pour trier par distance."));
}

// Maths Distance
function getDist(lat1,lon1,lat2,lon2) {
  var R = 6371; 
  var dLat = (lat2-lat1)*(Math.PI/180); 
  var dLon = (lon2-lon1)*(Math.PI/180); 
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)*Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}

// ... Les autres fonctions (renderProducts, filterData...) restent identiques ...
// Copiez le reste du code précédent pour compléter ce fichier.
// (Pour ne pas faire trop long ici, je vous laisse recoller le reste qui marche bien)

function renderProducts(products) {
    const grid = document.getElementById('market-grid');
    const btn = document.getElementById('load-more-container');
    if(!grid) return;

    const start = (currentPage-1)*ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const batch = products.slice(start, end);

    if(currentPage===1) grid.innerHTML = '';
    if(products.length===0) { grid.innerHTML='<div style="grid-column:1/-1;text-align:center">Aucun produit.</div>'; if(btn) btn.style.display='none'; return; }

    batch.forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        const badge = p.isNew ? '<span class="badge badge-new">NOUVEAU</span>' : '';
        const verified = p.isVerified ? '<span class="badge-verified">CERTIFIÉ</span>' : '';
        const distInfo = p.distance && p.distance < 100 ? `<span style="font-size:0.6rem;color:#27ae60;">📍 ${p.distance.toFixed(1)} km</span>` : '';

        grid.innerHTML += `
            <div class="card" data-aos="fade-up">
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank"><img src="${p.image}" loading="lazy"></a>
                <div class="card-body">
                    <div class="card-badges"><span class="badge-shop">${p.shopName}</span>${verified}${badge}</div>
                    <div style="font-size:0.7rem;color:#999;margin-bottom:5px;">📍 ${p.shopLoc} ${distInfo}</div>
                    <div class="card-title">${p.nom}</div>
                    <div class="card-price">${price}</div>
                    <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" class="btn-view">Voir</a>
                </div>
            </div>`;
    });
    if(btn) btn.style.display = (end >= products.length) ? 'none' : 'block';
}

function renderFlashSales() {
    const container = document.getElementById('flash-sales-container');
    const flash = allProducts.filter(p => p.is_star === true);
    if (!container || flash.length === 0) { if(container) container.style.display='none'; return; }
    let html = `<div class="flash-section"><div class="flash-header"><h2 class="flash-title">🔥 Ventes Flash</h2></div><div class="flash-slider">`;
    flash.sort(() => 0.5 - Math.random()).slice(0,8).forEach(p => {
         const verified = p.isVerified ? '<span class="badge-verified">CERTIFIÉ</span>' : '';
         html += `<div class="card" style="min-width:160px;max-width:160px;border:1px solid #e67e22;"><a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank"><img src="${p.image}" style="height:120px;"></a><div class="card-body" style="padding:10px;"><div class="card-badges"><span class="badge badge-flash">PROMO</span>${verified}</div><div class="card-title" style="font-size:0.8rem;">${p.nom}</div><div class="card-price" style="font-size:0.9rem;color:#e67e22;">${Number(p.prix).toLocaleString()} F</div></div></div>`;
    });
    html += `</div></div>`;
    container.innerHTML = html;
}

function filterData(render=true) {
    const shops = Array.from(document.querySelectorAll('#shop-filters input:checked')).map(cb=>cb.value);
    const locs = Array.from(document.querySelectorAll('#location-filters input:checked')).map(cb=>cb.value);
    const cats = Array.from(document.querySelectorAll('#category-filters input:checked')).map(cb=>cb.value);
    const search = document.getElementById('search-input').value.toLowerCase();

    activeProducts = allProducts.filter(p => {
        const mS = shops.length===0 || shops.includes(p.shopName);
        const mL = locs.length===0 || locs.includes(p.shopLoc);
        const mC = cats.length===0 || cats.includes(p.categorie);
        const mSe = p.nom.toLowerCase().includes(search);
        return mS && mL && mC && mSe;
    });

    if(render) { currentPage=1; renderProducts(activeProducts); }
}

function generateFilters() {
    const sC = document.getElementById('shop-filters');
    const lC = document.getElementById('location-filters');
    const cC = document.getElementById('category-filters');
    if(sC) { sC.innerHTML=''; allShops.forEach(s => sC.innerHTML+=`<label class="filter-label"><input type="checkbox" value="${s.name}" onchange="filterData()" checked> ${s.name}</label>`); }
    if(lC) { lC.innerHTML=''; [...new Set(allShops.map(s=>s.location).filter(l=>l))].forEach(l => lC.innerHTML+=`<label class="filter-label"><input type="checkbox" value="${l}" onchange="filterData()"> ${l}</label>`); }
    if(cC) { cC.innerHTML=''; [...new Set(allProducts.map(p=>p.categorie))].forEach(c => { if(c) cC.innerHTML+=`<label class="filter-label"><input type="checkbox" value="${c}" onchange="filterData()"> ${c}</label>`; }); }
}

document.getElementById('search-input').addEventListener('input', () => filterData(true));
document.getElementById('sort-select').addEventListener('change', (e) => sortAndRender(e.target.value));
const bl = document.getElementById('load-more-btn'); if(bl) bl.addEventListener('click', () => { currentPage++; renderProducts(activeProducts); });

initMarketplace();
