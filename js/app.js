/* =============================== */
/* MOTEUR EM AREA V6.0 (FINAL)     */
/* =============================== */

let allProducts = [];
let allShops = [];
// Récupère l'historique ou crée un tableau vide
let viewedProducts = JSON.parse(localStorage.getItem('em_history')) || [];

// --- 1. DÉMARRAGE (DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    // A. Vérifie le thème sombre immédiatement
    checkDarkMode();
    
    // B. LOGIQUE ACCUEIL (Si on est sur la page index avec des produits)
    if(document.getElementById('products-container')) {
        initApp();
        renderHistory();
    } 
    // C. LOGIQUE JOBS (Si on est sur la page jobs avec le conteneur vide)
    else if(document.getElementById('jobs-container')) {
        loadJobs();
    }
    // D. LOGIQUE SECONDAIRE (Si on a juste besoin des boutiques, ex: page Map)
    else if(document.getElementById('shops-container')) {
        loadShopsOnly();
    }

    // E. LISTENER FERMETURE MODALE PHARMACIE (Si on clique en dehors)
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('pharma-modal');
        if (e.target === modal) {
            closePharmaModal();
        }
    });
});

// --- 2. INITIALISATION APP (ACCUEIL) ---
async function initApp() {
    showSkeletonLoader();

    try {
        const res = await fetch('shops.json');
        if (!res.ok) throw new Error("Erreur Shops");
        allShops = await res.json();
        
        renderShops();
        
        // Chargement sécurisé des produits (Promise.allSettled)
        const promises = allShops.map(shop => fetchShopProducts(shop));
        const results = await Promise.allSettled(promises);
        
        let promoItems = [];
        let standardItems = [];

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                result.value.forEach(p => {
                    // Algorithme Promo : Produit Star OU Prix barré
                    if (p.is_star === true || (p.prix_original && p.prix_original > p.prix)) {
                        promoItems.push(p);
                    } else {
                        standardItems.push(p);
                    }
                });
            }
        });

        // Mélange aléatoire
        promoItems.sort(() => 0.5 - Math.random());
        standardItems.sort(() => 0.5 - Math.random());
        
        allProducts = [...promoItems, ...standardItems];

        // Nettoyage Loader
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

// Juste charger les logos (pour pages secondaires)
async function loadShopsOnly() {
    try {
        const res = await fetch('shops.json');
        allShops = await res.json();
        renderShops();
    } catch(e) {}
}

// --- 3. GESTION DES JOBS (NOUVEAU via jobs.json) ---
function loadJobs() {
    const container = document.getElementById('jobs-container');
    if(!container) return;

    fetch('jobs.json')
        .then(res => res.json())
        .then(jobs => {
            container.innerHTML = ''; // Vide le loader
            
            if(jobs.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:20px;">Aucune offre pour le moment.</div>';
                return;
            }

            jobs.forEach(job => {
                // Création du lien WhatsApp pré-rempli
                const msg = `Bonjour, je souhaite postuler pour l'offre *${job.title}* chez ${job.company}.`;
                const waLink = `https://wa.me/${job.whatsapp}?text=${encodeURIComponent(msg)}`;

                container.innerHTML += `
                <div class="job-card" data-aos="fade-up">
                    <div class="job-top-row">
                        <span class="job-tag">${job.tag}</span>
                        <div class="job-meta-info">
                            <span>${job.date}</span>
                        </div>
                    </div>
                    
                    <h3 style="margin:5px 0;">${job.title}</h3>
                    <p style="font-size:0.8rem; color:#888;">${job.company} - ${job.location}</p>
                    <p style="font-size:0.85rem; margin-top:10px;">${job.desc}</p>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
                        <span class="job-salary">${job.salary}</span>
                        <a href="${waLink}" class="btn btn-primary" style="font-size:0.7rem; padding:8px 15px;">
                            Postuler 
                        </a>
                    </div>
                </div>`;
            });
        })
        .catch(e => {
            console.error(e);
            container.innerHTML = '<div style="text-align:center; color:red;">Erreur de chargement des jobs.</div>';
        });
}

// --- 4. GESTION PHARMACIES (NOUVEAU) ---
function openPharmaModal() {
    const modal = document.getElementById('pharma-modal');
    const list = document.getElementById('pharma-list');
    
    if(!modal) return;

    // Affiche la modale
    modal.classList.add('active');
    vibratePhone();

    // Charge les données
    list.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Chargement des gardes...</div>';
    
    fetch('pharmacies.json')
        .then(res => res.json())
        .then(data => {
            list.innerHTML = '';
            if(data.length === 0) {
                 list.innerHTML = '<div style="text-align:center; padding:20px;">Aucune info pour cette semaine.</div>';
                 return;
            }
            data.forEach(p => {
                list.innerHTML += `
                    <div class="pharma-item">
                        <div class="pharma-info">
                            <span class="pharma-tag">${p.quartier}</span>
                            <h4>${p.nom}</h4>
                            <p>📍 ${p.loc}</p>
                        </div>
                        <a href="tel:${p.tel.replace(/\s/g, '')}" class="btn-call">📞</a>
                    </div>
                `;
            });
        })
        .catch(() => {
            list.innerHTML = '<div style="color:#e74c3c; text-align:center; padding:20px;">Impossible de charger la liste.</div>';
        });
}

function closePharmaModal() {
    const modal = document.getElementById('pharma-modal');
    if(modal) modal.classList.remove('active');
}

// --- 5. RENDU VISUEL (PRODUITS & BOUTIQUES) ---

function renderProducts(products) {
    const container = document.getElementById('products-container');
    if(!container) return; 

    if(container.innerHTML.includes('skeleton')) container.innerHTML = ''; 

    if(products.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:#999;">Aucun produit trouvé.</div>`;
        return;
    }

    products.slice(0, 30).forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        
        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                <!-- Bouton Copier Lien -->
                <button class="btn-copy" onclick="copyLink('${p.shopUrl}/produit.html?id=${p.id}')">🔗</button>
                
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" onclick="addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')">
                    <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
                </a>
                <div class="product-info">
                    <div class="product-shop">${p.shopName}</div>
                    <div class="product-title">${p.nom}</div>
                    <div class="product-price">${price}</div>
                    <!-- Bouton avec Vibration -->
                    <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" 
                       onclick="vibratePhone(); addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')" 
                       class="btn btn-outline" style="font-size:0.8rem; padding:5px;">
                       Voir
                    </a>
                </div>
            </div>
        `;
    });
}

function renderShops() {
    const c = document.getElementById('shops-container');
    if(!c) return;
    
    const count = document.getElementById('shop-count');
    if(count) count.textContent = `${allShops.length} actifs`;
    
    c.innerHTML = '';
    allShops.forEach(s => {
        c.innerHTML += `
            <a href="${s.url}" class="shop-card" target="_blank">
                <img src="${s.logo}" class="shop-logo" onerror="this.src='https://via.placeholder.com/70'">
                <div class="shop-name">${s.name}</div>
            </a>`;
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
                <a href="${p.shopUrl}/produit.html?id=${p.id}" onclick="addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')" target="_blank">
                    <img src="${p.image}" onerror="this.src='https://via.placeholder.com/80'">
                </a>
                <div class="promo-info">
                    <div class="product-shop" style="color:#e67e22;">🔥 PROMO FLASH</div>
                    <div class="promo-title">${p.nom}</div>
                    <div>
                        ${oldPrice}
                        <span class="promo-price">${price}</span>
                    </div>
                    <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" class="btn btn-primary" style="font-size:0.7rem; padding:5px 15px; margin-top:5px;">Voir</a>
                </div>
            </div>`;
    });
}

// --- 6. UTILITAIRES & FEATURES ---

// Fetch sécurisé
async function fetchShopProducts(shop) {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000); // 5 sec max
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

// Recherche
function setupSearch() {
    const input = document.getElementById('search-input');
    if(!input) return;

    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const promoContainer = document.getElementById('promo-container');
        const c = document.getElementById('products-container');

        if(term.length === 0) {
            if(promoContainer) promoContainer.style.display = 'flex';
            c.innerHTML = '';
            // Réaffiche les standards
            const standards = allProducts.filter(p => !p.prix_original || p.prix_original <= p.prix);
            renderProducts(standards);
            return;
        }

        if(promoContainer) promoContainer.style.display = 'none';
        c.innerHTML = '';
        const f = allProducts.filter(p => p.nom.toLowerCase().includes(term));
        renderProducts(f);
    });
}

// Loader Visuel
// --- LOADER VISUEL UNIFIÉ (Boutiques + Promos + Produits) ---
// --- LOADER VISUEL UNIFIÉ (TOUT LE SITE) ---
function showSkeletonLoader() {
    
    // A. PAGE ACCUEIL : Boutiques (Ronds)
    const shopContainer = document.getElementById('shops-container');
    if(shopContainer) {
        shopContainer.innerHTML = '';
        for(let i=0; i<5; i++) {
            shopContainer.innerHTML += `
                <div class="skeleton-shop-wrapper">
                    <div class="skeleton-shop-circle"></div>
                    <div class="skeleton-shop-text"></div>
                </div>`;
        }
    }

    // B. PAGE ACCUEIL : Promos (Rectangles)
    const promoContainer = document.getElementById('promo-container');
    if(promoContainer) {
        promoContainer.style.display = 'flex';
        promoContainer.innerHTML = '';
        for(let i=0; i<3; i++) {
            promoContainer.innerHTML += `
                <div class="skeleton-promo-card">
                    <div class="skeleton-promo-img"></div>
                    <div class="skeleton-promo-content">
                        <div class="skeleton-text-lg"></div>
                        <div class="skeleton-text-sm"></div>
                        <div class="skeleton-text-sm" style="width:30%"></div>
                    </div>
                </div>`;
        }
    }

    // C. PAGE ACCUEIL : Produits (Grille)
    const prodContainer = document.getElementById('products-container');
    if(prodContainer) {
        prodContainer.innerHTML = '';
        for(let i=0; i<4; i++) {
            prodContainer.innerHTML += `
                <div class="skeleton-card skeleton">
                    <div class="skeleton-img skeleton"></div>
                    <div class="skeleton-line skeleton"></div>
                    <div class="skeleton-line short skeleton"></div>
                </div>`;
        }
    }

    // D. PAGE JOBS : Liste des emplois
    const jobsContainer = document.getElementById('jobs-container');
    if(jobsContainer) {
        jobsContainer.innerHTML = '';
        // On affiche 4 faux jobs
        for(let i=0; i<4; i++) {
            jobsContainer.innerHTML += `
                <div class="skeleton-job">
                    <div class="skeleton-job-top">
                        <span class="skeleton-tag"></span>
                        <span class="skeleton-date"></span>
                    </div>
                    <div class="skeleton-title"></div>
                    <div class="skeleton-desc"></div>
                    <div class="skeleton-desc" style="width:60%"></div>
                </div>`;
        }
    }

    // E. PAGE MAP : Liste des distances (en bas)
    const mapList = document.getElementById('distance-list');
    if(mapList) {
        mapList.innerHTML = '';
        // On affiche 5 fausses lignes de distance
        for(let i=0; i<5; i++) {
            mapList.innerHTML += `
                <div class="skeleton-map-item">
                    <div class="skeleton-map-avatar"></div>
                    <div class="skeleton-map-lines">
                        <div class="skeleton-title" style="width:50%; margin:0;"></div>
                        <div class="skeleton-desc" style="width:30%; margin:0;"></div>
                    </div>
                </div>`;
        }
    }
}

// Dark Mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    vibratePhone();
    localStorage.setItem('em_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
}

function checkDarkMode() {
    if(localStorage.getItem('em_theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }
}

// Vibration
window.vibratePhone = () => {
    if (navigator.vibrate) navigator.vibrate(50);
};

// Copier Lien
window.copyLink = (url) => {
    vibratePhone();
    navigator.clipboard.writeText(url).then(() => alert("Lien copié !"));
};

// Historique
window.addToHistory = (id, name, img, url) => {
    viewedProducts = viewedProducts.filter(p => p.id !== id);
    viewedProducts.unshift({ id, name, img, url });
    if(viewedProducts.length > 10) viewedProducts.pop();
    localStorage.setItem('em_history', JSON.stringify(viewedProducts));
};

function renderHistory() {
    const container = document.getElementById('history-container');
    const section = document.getElementById('history-section');
    if(!container || !section) return;

    if(viewedProducts.length === 0) return;
    
    section.style.display = 'block';
    container.innerHTML = '';
    
    viewedProducts.forEach(p => {
        container.innerHTML += `
            <a href="${p.url}/produit.html?id=${p.id}" class="history-card" style="display:block; margin-right:10px;">
                <img src="${p.img}" onerror="this.src='https://via.placeholder.com/100'">
                <div style="font-size:0.7rem;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
            </a>
        `;
    });
}
