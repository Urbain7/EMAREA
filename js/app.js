/* =============================== */
/* MOTEUR EM AREA V15.0 (FINAL)    */
/* =============================== */

let allProducts = [];
let allShops = [];
let viewedProducts = JSON.parse(localStorage.getItem('em_history')) || [];

// --- 1. DÉMARRAGE & ROUTING ---
document.addEventListener('DOMContentLoaded', () => {
    checkDarkMode();
    
    // Splash Screen (Disparition)
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.visibility = 'hidden', 500);
        }
    }, 1500);

    initPullToRefresh();

    // Détection de la page actuelle
    if(document.getElementById('products-container')) {
        // Page Accueil
        initApp();
        renderHistory();
        if(document.getElementById('market-home-container')) loadHomeMarket();
    } 
    else if(document.getElementById('jobs-container')) {
        // Page Jobs
        showSkeletonLoader();
        loadJobs();
    }
    else if(document.getElementById('distance-list') && !document.getElementById('map')) {
        // Page Carte (Liste seule si map pas chargée)
        showSkeletonLoader();
    }
    else if(document.getElementById('shops-container')) {
        // Pages secondaires avec slider boutiques
        showSkeletonLoader();
        loadShopsOnly();
    }

    // Listener fermeture modale pharmacie
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('pharma-modal');
        if (e.target === modal) closePharmaModal();
    });
});

// --- 1.2 PULL TO REFRESH ---
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

// --- 2. LOGIQUE ACCUEIL (MOTEUR) ---
async function initApp() {
    showSkeletonLoader();

    try {
        // 1. Récupérer les boutiques
        const res = await fetch('shops.json');
        if (!res.ok) throw new Error("Erreur Shops");
        allShops = await res.json();
        
        // 2. TRI DES BOUTIQUES (EM SCORE)
        allShops.forEach(shop => {
            let score = 0;
            // Boost payant
            if(shop.boost_level) score += (shop.boost_level * 1000);
            // Vérification
            if(shop.verified) score += 500;
            // Aléatoire léger pour mélanger les égaux
            score += Math.random() * 10; 
            shop.em_score = score;
        });
        
        // Tri décroissant
        allShops.sort((a, b) => b.em_score - a.em_score);

        renderShops();
        
        // 3. RÉCUPÉRATION DES PRODUITS (Multi-Boutiques)
        const promises = allShops.map(shop => fetchShopProducts(shop));
        const results = await Promise.allSettled(promises);
        
        let promoItems = [];
        let standardItems = [];

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                result.value.forEach(p => {
                    // Badge Nouveau (Simulation)
                    if(!p.is_star && Math.random() > 0.8) p.is_new = true;
                    
                    // Séparation Promos / Standards
                    if (p.is_star === true || (p.prix_original && p.prix_original > p.prix)) {
                        promoItems.push(p);
                    } else {
                        standardItems.push(p);
                    }
                });
            }
        });

        // Mélange
        promoItems.sort(() => 0.5 - Math.random());
        standardItems.sort(() => 0.5 - Math.random());
        
        allProducts = [...promoItems, ...standardItems];

        // 4. Affichage
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
        if(pContainer) pContainer.innerHTML = `<div style="text-align:center; padding:20px;">Erreur connexion au marché.</div>`;
    }
}

// Fonction cruciale : Récupère les produits d'une boutique distante
async function fetchShopProducts(shop) {
    if (shop.url === '#' || !shop.url) return [];
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000); // Timeout 5s
        
        // Gestion URL avec ou sans slash
        const jsonUrl = shop.url.endsWith('/') ? `${shop.url}data/produits.json` : `${shop.url}/data/produits.json`;
        
        const res = await fetch(jsonUrl, { signal: controller.signal });
        clearTimeout(id);
        
        if(!res.ok) return [];
        const data = await res.json();
        const items = data.items ? data.items : data;
        
        // Nettoyage et formatage des données
        return items.map(p => {
            let imgSrc = p.image;
            
            // Correction chemin image (Absolu)
            if (imgSrc && !imgSrc.startsWith('http')) {
                if (imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
                const baseUrl = shop.url.endsWith('/') ? shop.url : `${shop.url}/`;
                imgSrc = baseUrl + imgSrc;
            }
            
            return {
                id: p.id,
                nom: p.nom,
                prix: p.prix,
                prix_original: p.prix_original,
                image: imgSrc,
                shopName: shop.name,
                shopUrl: shop.url, // URL de base
                isVerified: shop.verified,
                is_star: p.is_star
            };
        });
    } catch { return []; }
}

// --- 3. RENDU VISUEL ---

function renderProducts(products) {
    const container = document.getElementById('products-container');
    if(!container) return; 
    if(container.innerHTML.includes('skeleton')) container.innerHTML = ''; 

    products.slice(0, 30).forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        const newBadgeHTML = p.is_new ? `<div class="badge-new">NOUVEAU</div>` : '';
        
        // LIEN PROFOND vers la boutique avec ID
        const targetUrl = `${p.shopUrl}/index.html?id=${p.id}`;

        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                ${newBadgeHTML}
                <button class="btn-copy" onclick="copyLink('${targetUrl}')">🔗</button>
                
                <a href="${targetUrl}" target="_blank" onclick="addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')">
                    <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
                </a>
                <div class="product-info">
                    <div class="product-shop">${p.shopName}</div>
                    <div class="product-title">${p.nom}</div>
                    <div class="product-price">${price}</div>
                    <a href="${targetUrl}" target="_blank" onclick="addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')" class="btn btn-outline" style="font-size:0.8rem; padding:5px;">Voir</a>
                </div>
            </div>`;
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
        const targetUrl = `${p.shopUrl}/index.html?id=${p.id}`;

        c.innerHTML += `
            <div class="promo-card">
                <a href="${targetUrl}" target="_blank"><img src="${p.image}"></a>
                <div class="promo-info">
                    <div class="product-shop" style="color:#e67e22;">🔥 PROMO</div>
                    <div class="promo-title">${p.nom}</div>
                    <div>${oldPrice}<span class="promo-price">${price}</span></div>
                    <a href="${targetUrl}" target="_blank" class="btn btn-primary" style="font-size:0.7rem; padding:5px 15px; margin-top:5px;">Voir</a>
                </div>
            </div>`;
    });
}

function renderShops() {
    const c = document.getElementById('shops-container');
    const countLabel = document.getElementById('shop-count');
    
    if(c) {
        if(countLabel) countLabel.textContent = `${allShops.length} actifs`;
        c.innerHTML = '';
        const currentTheme = localStorage.getItem('em_theme') || 'light';
        
        allShops.forEach(s => {
            // Ajout du paramètre de thème pour la boutique
            const separator = s.url.includes('?') ? '&' : '?';
            const linkWithTheme = `${s.url}${separator}theme=${currentTheme}`;
            
            // Badges
            let sponsorBadge = s.boost_level > 0 ? `<div class="badge-sponsored">SPONSORISÉ</div>` : '';
            let verifyBadge = s.verified ? `<div class="badge-verified">VÉRIFIÉ</div>` : '';
            const imgStyle = s.boost_level > 0 ? "border: 2px solid #FFD700;" : "";

            c.innerHTML += `
            <a href="${linkWithTheme}" class="shop-card" target="_blank">
                <div style="position:relative;">
                    <img src="${s.logo}" class="shop-logo" style="${imgStyle}" onerror="this.src='https://via.placeholder.com/70'">
                    ${sponsorBadge}
                </div>
                <div class="shop-name">${s.name}</div>
                ${verifyBadge}
            </a>`;
        });
    }
}

// --- 4. SECTIONS SECONDAIRES ---

// Market (Particuliers)
function loadHomeMarket() {
    const container = document.getElementById('market-home-container');
    if(!container) return;
    
    fetch('market.json')
        .then(res => res.json())
        .then(ads => {
            container.innerHTML = '';
            if(ads.length === 0) { container.innerHTML = '<div style="font-size:0.8rem; padding:10px;">Aucune occasion.</div>'; return; }
            
            ads.forEach(ad => {
                const prix = Number(ad.prix).toLocaleString() + ' F';
                const msg = `Bonjour ${ad.vendeur}, je suis intéressé par votre annonce *${ad.titre}* vue sur EM AREA.`;
                const waLink = `https://wa.me/${ad.tel}?text=${encodeURIComponent(msg)}`;
                
                container.innerHTML += `
                    <div class="promo-card" style="min-width: 240px; border-color:#eee; box-shadow:none; background:var(--white);">
                        <img src="${ad.image}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;" onerror="this.src='https://via.placeholder.com/70'">
                        <div class="promo-info">
                            <div style="font-size:0.65rem; color:#888; text-transform:uppercase;">Vendeur : <b>${ad.vendeur}</b></div>
                            <div class="promo-title" style="margin:2px 0;">${ad.titre}</div>
                            <div class="promo-price" style="color:#27ae60;">${prix}</div>
                            <a href="${waLink}" class="btn btn-outline" style="width:100%; margin-top:5px; padding:4px; font-size:0.75rem; border-color:#27ae60; color:#27ae60;">Contacter </a>
                        </div>
                    </div>`;
            });
        })
        .catch(e => { container.innerHTML = ''; });
}

// Jobs
function loadJobs() {
    const container = document.getElementById('jobs-container');
    if(!container) return;

    const colors = ['#ffebee', '#e3f2fd', '#e8f5e9', '#fff3e0', '#f3e5f5', '#e0f2f1'];
    const textColors = ['#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#6a1b9a', '#00695c'];

    fetch('jobs.json')
        .then(res => res.json())
        .then(jobs => {
            container.innerHTML = ''; 
            if(jobs.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px;">Aucune offre.</div>'; return; }
            
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
                        <div class="job-main-info"><h3>${job.title}</h3><div class="job-company"><span>🏢 ${job.company}</span><span>📍 ${job.location}</span></div></div>
                    </div>
                    <div class="job-tags-row"><span class="job-pill highlight">${job.tag}</span><span class="job-pill">📅 ${job.date}</span></div>
                    <p class="job-desc">${job.desc}</p>
                    <div class="job-footer"><span class="job-salary">${job.salary}</span><a href="${waLink}" class="btn btn-primary" style="font-size:0.8rem; padding:8px 20px;">Postuler </a></div>
                </div>`;
            });
        })
        .catch(e => container.innerHTML = '<div style="text-align:center; color:red;">Erreur chargement.</div>');
}

// Pharmacies
function openPharmaModal() {
    const modal = document.getElementById('pharma-modal');
    const list = document.getElementById('pharma-list');
    if(!modal) return;
    
    modal.classList.add('active');
    if(navigator.vibrate) navigator.vibrate(50);
    
    list.innerHTML = '<div style="text-align:center; padding:20px;">Chargement...</div>';
    
    fetch('pharmacies.json')
        .then(res => res.json())
        .then(data => {
            list.innerHTML = '';
            data.forEach(p => {
                list.innerHTML += `<div class="pharma-item"><div class="pharma-info"><span class="pharma-tag">${p.quartier}</span><h4>${p.nom}</h4><p>📍 ${p.loc}</p></div><a href="tel:${p.tel.replace(/\s/g, '')}" class="btn-call">📞</a></div>`;
            });
        })
        .catch(() => list.innerHTML = '<div style="color:red; text-align:center;">Erreur chargement.</div>');
}
function closePharmaModal() { document.getElementById('pharma-modal').classList.remove('active'); }

// Skeletons
function showSkeletonLoader() {
    const shopC = document.getElementById('shops-container');
    if(shopC) { shopC.innerHTML = ''; for(let i=0;i<5;i++) shopC.innerHTML += `<div class="skeleton-shop-wrapper"><div class="skeleton-shop-circle"></div><div class="skeleton-shop-text"></div></div>`; }
    const promoC = document.getElementById('promo-container');
    if(promoC) { promoC.style.display='flex'; promoC.innerHTML = ''; for(let i=0;i<3;i++) promoC.innerHTML += `<div class="skeleton-promo-card"><div class="skeleton-promo-img"></div><div class="skeleton-promo-content"><div class="skeleton-text-lg"></div><div class="skeleton-text-sm"></div></div></div>`; }
    const prodC = document.getElementById('products-container');
    if(prodC) { prodC.innerHTML = ''; for(let i=0;i<4;i++) prodC.innerHTML += `<div class="skeleton-card skeleton"><div class="skeleton-img skeleton"></div><div class="skeleton-line skeleton"></div></div>`; }
    const jobC = document.getElementById('jobs-container');
    if(jobC) { jobC.innerHTML = ''; for(let i=0;i<4;i++) jobC.innerHTML += `<div class="skeleton-job"><div class="skeleton-title"></div></div>`; }
    const marketHome = document.getElementById('market-home-container');
    if(marketHome) { marketHome.innerHTML = ''; for(let i=0; i<3; i++) { marketHome.innerHTML += `<div class="skeleton-promo-card" style="min-width: 240px; border:1px solid #f0f0f0;"><div class="skeleton-promo-img" style="width:70px; height:70px;"></div><div class="skeleton-promo-content"><div class="skeleton-text-sm" style="width:40%"></div><div class="skeleton-text-lg" style="width:70%"></div><div class="skeleton-text-sm" style="width:90%"></div></div></div>`; } }
}

async function loadShopsOnly() {
    try {
        const res = await fetch('shops.json');
        allShops = await res.json();
        // Tri (Même logique que initApp)
        allShops.sort((a, b) => {
            let sa = (a.boost_level || 0)*1000 + (a.verified?500:0);
            let sb = (b.boost_level || 0)*1000 + (b.verified?500:0);
            return sb - sa;
        });
        renderShops();
    } catch(e) {}
}

// --- 5. UTILITAIRES ---
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
        if(f.length === 0) document.getElementById('products-container').innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">🤷‍♂️ Aucune offre trouvée.</div>`;
        else renderProducts(f);
    });
}
window.clearSearch = function() { const i = document.getElementById('search-input'); if(i){ i.value=''; i.dispatchEvent(new Event('input')); i.focus(); } };

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    if (navigator.vibrate) navigator.vibrate(50);
    localStorage.setItem('em_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
}
function checkDarkMode() { if(localStorage.getItem('em_theme') === 'dark') document.body.classList.add('dark-mode'); }

window.vibratePhone = () => { if (navigator.vibrate) navigator.vibrate(50); };
window.copyLink = (url) => { if (navigator.vibrate) navigator.vibrate(50); navigator.clipboard.writeText(url).then(() => alert("Lien copié !")); };

// Historique
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
    viewedProducts.forEach(p => c.innerHTML += `<a href="${p.url}/index.html?id=${p.id}" class="history-card"><img src="${p.img}"><div style="font-size:0.7rem;">${p.name}</div></a>`);
}
