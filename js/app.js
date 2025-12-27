/* =============================== */
/* MOTEUR EM AREA V9.0 (FINAL)     */
/* =============================== */

let allProducts = [];
let allShops = [];
let viewedProducts = JSON.parse(localStorage.getItem('em_history')) || [];

// --- 1. DÉMARRAGE (ROUTING) ---
document.addEventListener('DOMContentLoaded', () => {
    // Vérification thème
    checkDarkMode();
    
    // A. PAGE ACCUEIL (Produits présents)
    if(document.getElementById('products-container')) {
        initApp();
        renderHistory();
    } 
    // B. PAGE JOBS (Conteneur jobs présent)
    else if(document.getElementById('jobs-container')) {
        showSkeletonLoader();
        loadJobs();
    }
    // C. PAGE CARTE (Liste distances présente)
    else if(document.getElementById('distance-list')) {
        // La carte est gérée par map.js, mais on peut charger les logos si besoin
        // Ici on laisse map.js faire le travail principal
    }
    // D. SECONDAIRE (Juste les boutiques)
    else if(document.getElementById('shops-container')) {
        showSkeletonLoader();
        loadShopsOnly();
    }

    // LISTENER FERMETURE MODALE PHARMACIE
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('pharma-modal');
        if (e.target === modal) closePharmaModal();
    });
});

// --- 2. LOGIQUE ACCUEIL ---
async function initApp() {
    showSkeletonLoader();

    try {
        // 1. Récupérer les boutiques
        const res = await fetch('shops.json');
        if (!res.ok) throw new Error("Erreur Shops");
        allShops = await res.json();
        
        renderShops();
        
        // 2. Récupérer les produits de chaque boutique
        const promises = allShops.map(shop => fetchShopProducts(shop));
        const results = await Promise.allSettled(promises);
        
        let promoItems = [];
        let standardItems = [];

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                result.value.forEach(p => {
                    // Algo Promo : Star ou Prix Barré
                    if (p.is_star === true || (p.prix_original && p.prix_original > p.prix)) {
                        promoItems.push(p);
                    } else {
                        standardItems.push(p);
                    }
                });
            }
        });

        // 3. Mélanger pour la variété
        promoItems.sort(() => 0.5 - Math.random());
        standardItems.sort(() => 0.5 - Math.random());
        
        allProducts = [...promoItems, ...standardItems];

        // 4. Afficher
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

// Charge juste les logos (utilitaire)
async function loadShopsOnly() {
    try {
        const res = await fetch('shops.json');
        allShops = await res.json();
        renderShops();
    } catch(e) {}
}

// --- 3. GESTION DES JOBS (DESIGN PRO) ---
function loadJobs() {
    const container = document.getElementById('jobs-container');
    if(!container) return;

    // Palette de couleurs pastels pour les avatars
    const colors = ['#ffebee', '#e3f2fd', '#e8f5e9', '#fff3e0', '#f3e5f5', '#e0f2f1'];
    const textColors = ['#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#6a1b9a', '#00695c'];

    fetch('jobs.json')
        .then(res => res.json())
        .then(jobs => {
            container.innerHTML = ''; // Vide le squelette
            
            if(jobs.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:20px;">Aucune offre pour le moment.</div>';
                return;
            }

            jobs.forEach((job, index) => {
                // Lien WhatsApp
                const msg = `Bonjour, je souhaite postuler pour l'offre *${job.title}* chez ${job.company}.`;
                const waLink = `https://wa.me/${job.whatsapp}?text=${encodeURIComponent(msg)}`;

                // Génération Avatar
                const initial = job.company.charAt(0).toUpperCase();
                const colorIndex = index % colors.length;
                const bgStyle = `background:${colors[colorIndex]}; color:${textColors[colorIndex]};`;

                container.innerHTML += `
                <div class="job-card" data-aos="fade-up">
                    <!-- EN-TÊTE -->
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

                    <!-- TAGS -->
                    <div class="job-tags-row">
                        <span class="job-pill highlight">${job.tag}</span>
                        <span class="job-pill">📅 ${job.date}</span>
                    </div>

                    <!-- DESC -->
                    <p class="job-desc">${job.desc}</p>
                    
                    <!-- FOOTER -->
                    <div class="job-footer">
                        <span class="job-salary">${job.salary}</span>
                        <a href="${waLink}" class="btn btn-primary" style="font-size:0.8rem; padding:8px 20px; border-radius:8px;">
                            Postuler 
                        </a>
                    </div>
                </div>`;
            });
        })
        .catch(e => {
            container.innerHTML = '<div style="text-align:center; color:red;">Erreur chargement jobs.</div>';
        });
}

// --- 4. GESTION PHARMACIES ---
function openPharmaModal() {
    const modal = document.getElementById('pharma-modal');
    const list = document.getElementById('pharma-list');
    
    if(!modal) return;

    modal.classList.add('active');
    vibratePhone();

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

// --- 5. SKELETON LOADER (TOUTES PAGES) ---
function showSkeletonLoader() {
    
    // A. Boutiques
    const shopContainer = document.getElementById('shops-container');
    if(shopContainer) {
        shopContainer.innerHTML = '';
        for(let i=0; i<5; i++) {
            shopContainer.innerHTML += `<div class="skeleton-shop-wrapper"><div class="skeleton-shop-circle"></div><div class="skeleton-shop-text"></div></div>`;
        }
    }

    // B. Promos
    const promoContainer = document.getElementById('promo-container');
    if(promoContainer) {
        promoContainer.style.display = 'flex';
        promoContainer.innerHTML = '';
        for(let i=0; i<3; i++) {
            promoContainer.innerHTML += `<div class="skeleton-promo-card"><div class="skeleton-promo-img"></div><div class="skeleton-promo-content"><div class="skeleton-text-lg"></div><div class="skeleton-text-sm"></div><div class="skeleton-text-sm" style="width:30%"></div></div></div>`;
        }
    }

    // C. Produits
    const prodContainer = document.getElementById('products-container');
    if(prodContainer) {
        prodContainer.innerHTML = '';
        for(let i=0; i<4; i++) {
            prodContainer.innerHTML += `<div class="skeleton-card skeleton"><div class="skeleton-img skeleton"></div><div class="skeleton-line skeleton"></div><div class="skeleton-line short skeleton"></div></div>`;
        }
    }

    // D. Jobs
    const jobsContainer = document.getElementById('jobs-container');
    if(jobsContainer) {
        jobsContainer.innerHTML = '';
        for(let i=0; i<4; i++) {
            jobsContainer.innerHTML += `<div class="skeleton-job"><div class="skeleton-job-top"><span class="skeleton-tag"></span><span class="skeleton-date"></span></div><div class="skeleton-title"></div><div class="skeleton-desc"></div><div class="skeleton-desc" style="width:60%"></div></div>`;
        }
    }
    
    // E. Map List (Optionnel, si géré ici)
    const mapList = document.getElementById('distance-list');
    if(mapList && !document.querySelector('script[src="js/map.js"]')) {
        // Seulement si map.js n'est pas chargé (sinon conflit d'affichage)
        mapList.innerHTML = '';
        for(let i=0; i<5; i++) {
             mapList.innerHTML += `<div class="skeleton-map-item"><div class="skeleton-map-avatar"></div><div class="skeleton-map-lines"><div class="skeleton-title" style="width:50%; margin:0;"></div><div class="skeleton-desc" style="width:30%; margin:0;"></div></div></div>`;
        }
    }
}

// --- 6. RENDU VISUEL ---

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
                <button class="btn-copy" onclick="copyLink('${p.shopUrl}/produit.html?id=${p.id}')">🔗</button>
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" onclick="addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')">
                    <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
                </a>
                <div class="product-info">
                    <div class="product-shop">${p.shopName}</div>
                    <div class="product-title">${p.nom}</div>
                    <div class="product-price">${price}</div>
                    <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" 
                       onclick="vibratePhone(); addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')" 
                       class="btn btn-outline" style="font-size:0.8rem; padding:5px;">
                       Voir
                    </a>
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

// --- 7. UTILITAIRES ---

// Fetch Helper
async function fetchShopProducts(shop) {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000); // 5s timeout
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
/* --- RECHERCHE INTELLIGENTE --- */
function setupSearch() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    
    if(!input) return;

    // Quand on écrit
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        // 1. Gérer l'affichage du bouton X
        if(clearBtn) {
            clearBtn.style.display = term.length > 0 ? 'block' : 'none';
        }

        // 2. Filtrer les produits
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
        
        // Recherche dans le nom ET la description (si elle existe)
        const f = allProducts.filter(p => p.nom.toLowerCase().includes(term));
        
        if(f.length === 0) {
            c.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">
                🤷‍♂️ Aucune offre trouvée pour "${term}"
            </div>`;
        } else {
            renderProducts(f);
        }
    });
}

// Nouvelle fonction pour vider la recherche
window.clearSearch = function() {
    const input = document.getElementById('search-input');
    if(input) {
        input.value = '';
        input.dispatchEvent(new Event('input')); // Déclenche la remise à zéro
        input.focus(); // Remet le curseur dedans
    }
};

// Mode Sombre
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

// Utilitaires système
window.vibratePhone = () => { if (navigator.vibrate) navigator.vibrate(50); };
window.copyLink = (url) => { vibratePhone(); navigator.clipboard.writeText(url).then(() => alert("Lien copié !")); };

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
            </a>`;
    });
}
