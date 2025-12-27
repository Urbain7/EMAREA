/* =============================== */
/* MOTEUR EM AREA V11.0 (FINAL)    */
/* =============================== */

let allProducts = [];
let allShops = [];
let viewedProducts = JSON.parse(localStorage.getItem('em_history')) || [];

// --- 1. DÉMARRAGE & ROUTING ---
document.addEventListener('DOMContentLoaded', () => {
    checkDarkMode();
    
    // 1.1 SPLASH SCREEN
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.visibility = 'hidden', 500);
        }
    }, 1500);

    // 1.2 PULL TO REFRESH
    initPullToRefresh();

    // A. PAGE ACCUEIL
    if(document.getElementById('products-container')) {
        initApp();
        renderHistory();
        // Charge la section Particuliers si elle existe sur la page
        if(document.getElementById('market-home-container')) {
            loadHomeMarket();
        }
    } 
    // B. PAGE JOBS
    else if(document.getElementById('jobs-container')) {
        showSkeletonLoader();
        loadJobs();
    }
    // C. PAGE CARTE (Liste simple)
    else if(document.getElementById('distance-list') && !document.getElementById('map')) {
        showSkeletonLoader();
    }
    // D. SECONDAIRE
    else if(document.getElementById('shops-container')) {
        showSkeletonLoader();
        loadShopsOnly();
    }

    // LISTENER PHARMACIE
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('pharma-modal');
        if (e.target === modal) closePharmaModal();
    });
});

// --- 1.2 LOGIQUE PULL TO REFRESH ---
function initPullToRefresh() {
    let startY = 0;
    const ptr = document.getElementById('ptr-indicator');
    
    window.addEventListener('touchstart', e => {
        if(window.scrollY === 0) startY = e.touches[0].clientY;
    }, {passive: true});

    window.addEventListener('touchmove', e => {
        const y = e.touches[0].clientY;
        if(window.scrollY === 0 && y > startY + 60) { 
            if(ptr) ptr.classList.add('visible');
        }
    }, {passive: true});

    window.addEventListener('touchend', e => {
        if(ptr && ptr.classList.contains('visible')) {
            ptr.innerHTML = '<div class="splash-loader" style="width:20px;height:20px;border-width:2px;"></div>';
            ptr.classList.add('ptr-rotate');
            setTimeout(() => window.location.reload(), 800);
        }
    });
}

// --- 2. LOGIQUE ACCUEIL (MOTEUR PRINCIPAL) ---
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
                    // Badge Nouveau (Simulation)
                    if(!p.is_star && Math.random() > 0.8) p.is_new = true;

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

    } catch (e) {
        console.error(e);
        const pContainer = document.getElementById('products-container');
        if(pContainer) pContainer.innerHTML = `<div style="text-align:center; padding:20px;">Erreur connexion.</div>`;
    }
}

async function loadShopsOnly() {
    try {
        const res = await fetch('shops.json');
        allShops = await res.json();
        renderShops();
    } catch(e) {}
}

// --- 3. NOUVEAU : MARKET (PARTICULIERS SUR ACCUEIL) ---
function loadHomeMarket() {
    const container = document.getElementById('market-home-container');
    if(!container) return;

    fetch('market.json')
        .then(res => res.json())
        .then(ads => {
            container.innerHTML = '';
            
            if(ads.length === 0) {
                container.innerHTML = '<div style="font-size:0.8rem; padding:10px;">Aucune occasion pour le moment.</div>';
                return;
            }

            ads.forEach(ad => {
                const prix = Number(ad.prix).toLocaleString() + ' F';
                // Message WhatsApp
                const msg = `Bonjour ${ad.vendeur}, je suis intéressé par votre annonce *${ad.titre}* vue sur EM AREA.`;
                const waLink = `https://wa.me/${ad.tel}?text=${encodeURIComponent(msg)}`;

                container.innerHTML += `
                    <div class="promo-card" style="min-width: 240px; border-color:#eee; box-shadow:none; background:var(--white);">
                        <img src="${ad.image}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;" onerror="this.src='https://via.placeholder.com/70'">
                        <div class="promo-info">
                            <div style="font-size:0.65rem; color:#888; text-transform:uppercase;">Vendeur : <b>${ad.vendeur}</b></div>
                            <div class="promo-title" style="margin:2px 0;">${ad.titre}</div>
                            <div class="promo-price" style="color:#27ae60;">${prix}</div>
                            <a href="${waLink}" class="btn btn-outline" style="width:100%; margin-top:5px; padding:4px; font-size:0.75rem; border-color:#27ae60; color:#27ae60;">
                                Contacter 
                            </a>
                        </div>
                    </div>`;
            });
        })
        .catch(e => {
            // Silencieux si erreur ou fichier manquant
            container.innerHTML = '';
        });
}

// --- 4. GESTION DES JOBS ---
function loadJobs() {
    const container = document.getElementById('jobs-container');
    if(!container) return;

    const colors = ['#ffebee', '#e3f2fd', '#e8f5e9', '#fff3e0', '#f3e5f5', '#e0f2f1'];
    const textColors = ['#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#6a1b9a', '#00695c'];

    fetch('jobs.json')
        .then(res => res.json())
        .then(jobs => {
            container.innerHTML = ''; 
            if(jobs.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:20px;">Aucune offre.</div>';
                return;
            }

            jobs.forEach((job, index) => {
                const msg = `Bonjour, je souhaite postuler pour l'offre *${job.title}* chez ${job.company}.`;
                const waLink = `https://wa.me/${job.whatsapp}?text=${encodeURIComponent(msg)}`;
                const initial = job.company.charAt(0).toUpperCase();
                const colorIndex = index % colors.length;
                const bgStyle = `background:${colors[colorIndex]}; color:${textColors[colorIndex]};`;

                container.innerHTML += `
                <div class="job-card" data-aos="fade-up">
                    <div class="job-header">
                        <div class="job-avatar" style="${bgStyle}">${initial}</div>
                        <div class="job-main-info">
                            <h3>${job.title}</h3>
                            <div class="job-company">
                                <span>🏢 ${job.company}</span>
                                <span style="margin:0 5px;">•</span>
                                <span>📍 ${job.location}</span>
                            </div>
                        </div>
                    </div>
                    <div class="job-tags-row">
                        <span class="job-pill highlight">${job.tag}</span>
                        <span class="job-pill">📅 ${job.date}</span>
                    </div>
                    <p class="job-desc">${job.desc}</p>
                    <div class="job-footer">
                        <span class="job-salary">${job.salary}</span>
                        <a href="${waLink}" class="btn btn-primary" style="font-size:0.8rem; padding:8px 20px; border-radius:8px;">Postuler </a>
                    </div>
                </div>`;
            });
        })
        .catch(e => container.innerHTML = '<div style="text-align:center; color:red;">Erreur chargement.</div>');
}

// --- 5. GESTION PHARMACIES ---
function openPharmaModal() {
    const modal = document.getElementById('pharma-modal');
    const list = document.getElementById('pharma-list');
    if(!modal) return;

    modal.classList.add('active');
    vibratePhone();

    list.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Chargement...</div>';
    
    fetch('pharmacies.json')
        .then(res => res.json())
        .then(data => {
            list.innerHTML = '';
            data.forEach(p => {
                list.innerHTML += `
                    <div class="pharma-item">
                        <div class="pharma-info">
                            <span class="pharma-tag">${p.quartier}</span>
                            <h4>${p.nom}</h4>
                            <p>📍 ${p.loc}</p>
                        </div>
                        <a href="tel:${p.tel.replace(/\s/g, '')}" class="btn-call">📞</a>
                    </div>`;
            });
        })
        .catch(() => list.innerHTML = '<div style="color:red; text-align:center;">Erreur chargement.</div>');
}

function closePharmaModal() {
    document.getElementById('pharma-modal').classList.remove('active');
}

// --- 6. SKELETON LOADER ---
// --- 6. SKELETON LOADER (TOUTES PAGES + MARKET) ---
function showSkeletonLoader() {
    
    // A. Boutiques (Ronds)
    const shopContainer = document.getElementById('shops-container');
    if(shopContainer) {
        shopContainer.innerHTML = '';
        for(let i=0; i<5; i++) {
            shopContainer.innerHTML += `<div class="skeleton-shop-wrapper"><div class="skeleton-shop-circle"></div><div class="skeleton-shop-text"></div></div>`;
        }
    }

    // B. Promos (Rectangles)
    const promoContainer = document.getElementById('promo-container');
    if(promoContainer) {
        promoContainer.style.display = 'flex';
        promoContainer.innerHTML = '';
        for(let i=0; i<3; i++) {
            promoContainer.innerHTML += `<div class="skeleton-promo-card"><div class="skeleton-promo-img"></div><div class="skeleton-promo-content"><div class="skeleton-text-lg"></div><div class="skeleton-text-sm"></div></div></div>`;
        }
    }

    // C. Produits (Grille verticale)
    const prodContainer = document.getElementById('products-container');
    if(prodContainer) {
        prodContainer.innerHTML = '';
        for(let i=0; i<4; i++) {
            prodContainer.innerHTML += `<div class="skeleton-card skeleton"><div class="skeleton-img skeleton"></div><div class="skeleton-line skeleton"></div></div>`;
        }
    }

    // D. Jobs (Liste)
    const jobsContainer = document.getElementById('jobs-container');
    if(jobsContainer) {
        jobsContainer.innerHTML = '';
        for(let i=0; i<4; i++) {
            jobsContainer.innerHTML += `<div class="skeleton-job"><div class="skeleton-job-top"><span class="skeleton-tag"></span><span class="skeleton-date"></span></div><div class="skeleton-title"></div></div>`;
        }
    }

    // E. Map List (Si présente sans map)
    const mapList = document.getElementById('distance-list');
    if(mapList && !document.getElementById('map')) {
        mapList.innerHTML = '';
        for(let i=0; i<5; i++) mapList.innerHTML += `<div class="skeleton-map-item"><div class="skeleton-map-avatar"></div><div class="skeleton-map-lines"><div class="skeleton-title" style="width:50%"></div></div></div>`;
    }

    // F. MARKET HOME (NOUVEAU : Section Particuliers)
    const marketHome = document.getElementById('market-home-container');
    if(marketHome) {
        marketHome.innerHTML = '';
        // On crée 3 faux éléments horizontaux qui ressemblent aux cartes market
        for(let i=0; i<3; i++) {
            marketHome.innerHTML += `
            <div class="skeleton-promo-card" style="min-width: 240px; border:1px solid #f0f0f0;">
                <div class="skeleton-promo-img" style="width:70px; height:70px;"></div>
                <div class="skeleton-promo-content">
                    <div class="skeleton-text-sm" style="width:40%"></div> <!-- Vendeur -->
                    <div class="skeleton-text-lg" style="width:70%"></div> <!-- Titre -->
                    <div class="skeleton-text-sm" style="width:90%; margin-top:5px;"></div> <!-- Bouton -->
                </div>
            </div>`;
        }
    }
}

// --- 7. RENDU VISUEL & UTILS ---
function renderProducts(products) {
    const container = document.getElementById('products-container');
    if(!container) return; 
    if(container.innerHTML.includes('skeleton')) container.innerHTML = ''; 

    products.slice(0, 30).forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        const newBadgeHTML = p.is_new ? `<div class="badge-new">NOUVEAU</div>` : '';

        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                ${newBadgeHTML}
                <button class="btn-copy" onclick="copyLink('${p.shopUrl}/produit.html?id=${p.id}')">🔗</button>
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" onclick="addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')">
                    <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
                </a>
                <div class="product-info">
                    <div class="product-shop">${p.shopName}</div>
                    <div class="product-title">${p.nom}</div>
                    <div class="product-price">${price}</div>
                    <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" onclick="addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')" class="btn btn-outline" style="font-size:0.8rem; padding:5px;">Voir</a>
                </div>
            </div>`;
    });
}

function renderShops() {
    const c = document.getElementById('shops-container');
    const countLabel = document.getElementById('shop-count'); // Cible le texte "0 actifs"

    if(c) {
        // CORRECTIF : Mise à jour du chiffre
        if(countLabel) countLabel.textContent = `${allShops.length} actifs`;

        c.innerHTML = '';
        allShops.forEach(s => {
            c.innerHTML += `
            <a href="${s.url}" class="shop-card" target="_blank">
                <img src="${s.logo}" class="shop-logo" onerror="this.src='https://via.placeholder.com/70'">
                <div class="shop-name">${s.name}</div>
            </a>`;
        });
    }
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
                    <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" class="btn btn-primary" style="font-size:0.7rem; padding:5px 15px; margin-top:5px;">Voir</a>
                </div>
            </div>`;
    });
}

async function fetchShopProducts(shop) {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000); 
        const res = await fetch(`${shop.url}/data/produits.json`, { signal: controller.signal });
        clearTimeout(id);
        if(!res.ok) return [];
        const data = await res.json();
        const items = data.items ? data.items : data;
        return items.map(p => ({
            ...p, shopName: shop.name, shopUrl: shop.url, isVerified: shop.verified,
            image: p.image.startsWith('http') ? p.image : `${shop.url}/${p.image}`
        }));
    } catch { return []; }
}

function setupSearch() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    if(!input) return;

    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        if(clearBtn) clearBtn.style.display = term.length > 0 ? 'block' : 'none';
        
        const pC = document.getElementById('promo-container');
        if(pC) pC.style.display = term.length === 0 ? 'flex' : 'none';
        
        const f = allProducts.filter(p => p.nom.toLowerCase().includes(term));
        renderProducts(f);
    });
}
window.clearSearch = function() {
    const input = document.getElementById('search-input');
    if(input) { input.value = ''; input.dispatchEvent(new Event('input')); input.focus(); }
};

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    vibratePhone();
    localStorage.setItem('em_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
}
function checkDarkMode() { if(localStorage.getItem('em_theme') === 'dark') document.body.classList.add('dark-mode'); }
window.vibratePhone = () => { if (navigator.vibrate) navigator.vibrate(50); };
window.copyLink = (url) => { vibratePhone(); navigator.clipboard.writeText(url).then(() => alert("Lien copié !")); };
window.addToHistory = (id, n, i, u) => {
    viewedProducts = viewedProducts.filter(p => p.id !== id);
    viewedProducts.unshift({ id, name: n, img: i, url: u });
    if(viewedProducts.length > 10) viewedProducts.pop();
    localStorage.setItem('em_history', JSON.stringify(viewedProducts));
};
function renderHistory() {
    const c = document.getElementById('history-container');
    const s = document.getElementById('history-section');
    if(!c || !s || viewedProducts.length===0) return;
    s.style.display = 'block'; c.innerHTML = '';
    viewedProducts.forEach(p => c.innerHTML += `<a href="${p.url}/produit.html?id=${p.id}" class="history-card"><img src="${p.img}"><div style="font-size:0.7rem;">${p.name}</div></a>`);
}
/* Animation pour le lien "+ Vendre" */
.pulse-text {
    display: inline-block; /* Nécessaire pour l'animation */
    animation: pulseLink 2s infinite ease-in-out;
}

@keyframes pulseLink {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.15); color: #e67e22; /* Grossit et change de couleur */ }
    100% { transform: scale(1); opacity: 1; }
}
