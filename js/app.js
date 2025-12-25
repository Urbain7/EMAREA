/* =============================== */
/* MOTEUR EM AREA V8.0 (FIXED)     */
/* =============================== */

let allProducts = [];
let allShops = [];
let viewedProducts = JSON.parse(localStorage.getItem('em_history')) || [];

// --- DÉMARRAGE ---
document.addEventListener('DOMContentLoaded', () => {
    checkDarkMode();
    
    // A. ACCUEIL (Produits)
    if(document.getElementById('products-container')) {
        initApp();
        renderHistory();
    } 
    // B. JOBS
    else if(document.getElementById('jobs-container')) {
        showSkeletonLoader();
        loadJobs();
    }
    // C. CARTE (Liste simple si besoin)
    else if(document.getElementById('distance-list')) {
        // Rien à faire ici, map.js gère la carte
    }

    // D. MODALE PHARMACIE
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('pharma-modal');
        if (e.target === modal) closePharmaModal();
    });
});

// --- ACCUEIL ---
async function initApp() {
    showSkeletonLoader();
    try {
        const res = await fetch('shops.json');
        if (!res.ok) throw new Error("Erreur Shops");
        allShops = await res.json();
        renderShops();
        
        const promises = allShops.map(shop => fetchShopProducts(shop));
        const results = await Promise.allSettled(promises);
        
        let promoItems = [];
        let standardItems = [];

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                result.value.forEach(p => {
                    if (p.is_star === true || (p.prix_original && p.prix_original > p.prix)) {
                        promoItems.push(p);
                    } else {
                        standardItems.push(p);
                    }
                });
            }
        });

        promoItems.sort(() => 0.5 - Math.random());
        standardItems.sort(() => 0.5 - Math.random());
        allProducts = [...promoItems, ...standardItems];

        const pContainer = document.getElementById('products-container');
        if(pContainer) pContainer.innerHTML = ''; 
        
        const loader = document.getElementById('loader');
        if(loader) loader.style.display = 'none';
        
        renderPromos(promoItems);
        renderProducts(standardItems);
        setupSearch();

    } catch (e) { console.error(e); }
}

// --- RENDU ---
function renderProducts(products) {
    const container = document.getElementById('products-container');
    if(!container) return; 
    if(container.innerHTML.includes('skeleton')) container.innerHTML = ''; 
    if(products.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:#999;">Aucun produit.</div>`;
        return;
    }
    products.slice(0, 30).forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                <button class="btn-copy" onclick="copyLink('${p.shopUrl}/produit.html?id=${p.id}')">🔗</button>
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" onclick="addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')">
                    <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
                </a>
                <div class="product-info">
                    <div class="product-shop">${p.shopName}</div>
                    <div class="product-title">${p.nom}</div>
                    <div class="product-price">${price}</div>
                    <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" class="btn btn-outline" style="font-size:0.8rem; padding:5px;">Voir</a>
                </div>
            </div>`;
    });
}

function renderShops() {
    const c = document.getElementById('shops-container');
    if(!c) return;
    const count = document.getElementById('shop-count');
    if(count) count.textContent = `${allShops.length} actifs`;
    c.innerHTML = '';
    allShops.forEach(s => {
        c.innerHTML += `<a href="${s.url}" class="shop-card" target="_blank"><img src="${s.logo}" class="shop-logo"><div class="shop-name">${s.name}</div></a>`;
    });
}

function renderPromos(promos) {
    const c = document.getElementById('promo-container');
    if(!c) return;
    if(promos.length===0) { c.style.display='none'; return; }
    c.innerHTML = '';
    promos.forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        const oldPrice = p.prix_original ? `<span class="old-price">${Number(p.prix_original).toLocaleString()} F</span>` : '';
        c.innerHTML += `
            <div class="promo-card">
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank"><img src="${p.image}"></a>
                <div class="promo-info">
                    <div class="product-shop" style="color:#e67e22;">🔥 PROMO</div>
                    <div class="promo-title">${p.nom}</div>
                    <div>${oldPrice}<span class="promo-price">${price}</span></div>
                </div>
            </div>`;
    });
}

// --- JOBS ---
function loadJobs() {
    const container = document.getElementById('jobs-container');
    if(!container) return;
    fetch('jobs.json').then(res => res.json()).then(jobs => {
        container.innerHTML = '';
        jobs.forEach(job => {
            const waLink = `https://wa.me/${job.whatsapp}?text=Bonjour...`;
            container.innerHTML += `
            <div class="job-card" data-aos="fade-up">
                <div class="job-top-row"><span class="job-tag">${job.tag}</span><span>${job.date}</span></div>
                <h3 style="margin:5px 0;">${job.title}</h3>
                <p style="font-size:0.8rem; color:#888;">${job.company}</p>
                <div style="display:flex; justify-content:space-between; margin-top:15px;">
                    <span class="job-salary">${job.salary}</span>
                    <a href="${waLink}" class="btn btn-primary" style="font-size:0.7rem; padding:8px 15px;">Postuler </a>
                </div>
            </div>`;
        });
    });
}

// --- PHARMACIES ---
function openPharmaModal() {
    const modal = document.getElementById('pharma-modal');
    const list = document.getElementById('pharma-list');
    if(!modal) return;
    modal.classList.add('active');
    list.innerHTML = '<div style="text-align:center; padding:20px;">Chargement...</div>';
    fetch('pharmacies.json').then(res => res.json()).then(data => {
        list.innerHTML = '';
        data.forEach(p => {
            list.innerHTML += `<div class="pharma-item"><div><h4>${p.nom}</h4><p>${p.loc}</p></div><a href="tel:${p.tel}" class="btn-call">📞</a></div>`;
        });
    });
}
function closePharmaModal() { document.getElementById('pharma-modal').classList.remove('active'); }

// --- SKELETONS ---
function showSkeletonLoader() {
    // Boutiques
    const shopC = document.getElementById('shops-container');
    if(shopC) { shopC.innerHTML = ''; for(let i=0;i<5;i++) shopC.innerHTML += `<div class="skeleton-shop-wrapper"><div class="skeleton-shop-circle"></div><div class="skeleton-shop-text"></div></div>`; }
    // Promos
    const promoC = document.getElementById('promo-container');
    if(promoC) { promoC.style.display='flex'; promoC.innerHTML = ''; for(let i=0;i<3;i++) promoC.innerHTML += `<div class="skeleton-promo-card" style="width:260px; height:100px; background:#f9f9f9;"></div>`; }
    // Jobs
    const jobC = document.getElementById('jobs-container');
    if(jobC) { jobC.innerHTML = ''; for(let i=0;i<3;i++) jobC.innerHTML += `<div class="skeleton-job" style="height:150px;"></div>`; }
}

// --- UTILS ---
async function fetchShopProducts(shop) {
    try {
        const res = await fetch(`${shop.url}/data/produits.json`);
        if(!res.ok) return [];
        const data = await res.json();
        const items = data.items ? data.items : data;
        return items.map(p => ({ ...p, shopName: shop.name, shopUrl: shop.url, image: p.image.startsWith('http') ? p.image : `${shop.url}/${p.image}` }));
    } catch { return []; }
}
function setupSearch() {
    const input = document.getElementById('search-input');
    if(!input) return;
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const pC = document.getElementById('promo-container');
        if(pC) pC.style.display = term ? 'none' : 'flex';
        const f = allProducts.filter(p => p.nom.toLowerCase().includes(term));
        renderProducts(f);
    });
}
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); localStorage.setItem('em_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
function checkDarkMode() { if(localStorage.getItem('em_theme') === 'dark') document.body.classList.add('dark-mode'); }
window.vibratePhone = () => { if (navigator.vibrate) navigator.vibrate(50); };
window.copyLink = (url) => { navigator.clipboard.writeText(url).then(() => alert("Copié !")); };
window.addToHistory = (id, name, img, url) => {
    viewedProducts = viewedProducts.filter(p => p.id !== id);
    viewedProducts.unshift({ id, name, img, url });
    localStorage.setItem('em_history', JSON.stringify(viewedProducts));
};
function renderHistory() {
    const c = document.getElementById('history-container');
    const s = document.getElementById('history-section');
    if(!c || !s || viewedProducts.length===0) return;
    s.style.display = 'block'; c.innerHTML = '';
    viewedProducts.forEach(p => { c.innerHTML += `<a href="${p.url}/produit.html?id=${p.id}" class="history-card"><img src="${p.img}"><div>${p.name}</div></a>`; });
}
