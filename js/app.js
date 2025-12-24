/* =============================== */
/* MOTEUR EM AREA V3 (Full Features) */
/* =============================== */

let allProducts = [];
let allShops = [];
// Récupère l'historique ou crée un tableau vide
let viewedProducts = JSON.parse(localStorage.getItem('em_history')) || [];

document.addEventListener('DOMContentLoaded', () => {
    // Vérifie le thème sombre avant tout
    checkDarkMode();
    
    // Si on est sur la page d'accueil (où il y a les produits)
    if(document.getElementById('products-container')) {
        initApp();
        renderHistory();
    } 
    // Si on est sur une autre page mais qu'on a besoin des boutiques (ex: Jobs)
    else if(document.getElementById('shops-container')) {
        loadShopsOnly();
    }
});

// --- 1. INITIALISATION ---
async function initApp() {
    showSkeletonLoader();

    try {
        const res = await fetch('shops.json');
        if (!res.ok) throw new Error("Erreur Shops");
        allShops = await res.json();
        
        renderShops();
        
        // Chargement sécurisé des produits
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

// Juste charger les logos (pour pages secondaires si besoin)
async function loadShopsOnly() {
    try {
        const res = await fetch('shops.json');
        allShops = await res.json();
        renderShops();
    } catch(e) {}
}

// --- 2. FONCTIONS DE RENDU ---

function renderProducts(products) {
    const container = document.getElementById('products-container');
    if(!container) return; // Sécurité

    if(container.innerHTML.includes('skeleton')) container.innerHTML = ''; 

    if(products.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:#999;">Aucun produit trouvé.</div>`;
        return;
    }

    products.slice(0, 30).forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        
        // NOTE : Pas de badge vérifié ici (réservé Premium)
        
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
    
    // Mise à jour du compteur
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
    // NOTE : On ne met plus le bouton "Jobs" ici, il est dans le menu du bas.
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

// --- 3. FONCTIONS UTILITAIRES ---

// Fetch sécurisé avec Timeout
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
            // Réaffiche les produits standards
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
function showSkeletonLoader() {
    const c = document.getElementById('products-container');
    if(!c) return;
    c.innerHTML = '';
    for(let i=0; i<4; i++) c.innerHTML += `<div class="skeleton-card skeleton"><div class="skeleton-img skeleton"></div><div class="skeleton-line skeleton"></div><div class="skeleton-line short skeleton"></div></div>`;
}

// --- 4. FEATURES "FOLLES" ---

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
/* --- AJOUTS DANS js/app.js (Système de Vues Uniques) --- */

// 1. Au chargement, on vérifie les vues déjà enregistrées
document.addEventListener('DOMContentLoaded', () => {
    // On sélectionne toutes les cartes Job
    const jobs = document.querySelectorAll('.job-card');
    
    jobs.forEach(job => {
        const id = job.id; // ex: 'job-1'
        const baseViews = parseInt(job.getAttribute('data-views'));
        const viewText = document.getElementById(`view-txt-${id}`);
        
        // On regarde dans la mémoire du téléphone si c'est déjà vu
        const hasSeen = localStorage.getItem(`seen_${id}`);
        
        if (hasSeen) {
            // Si déjà vu, on affiche le nombre + 1
            viewText.textContent = formatViews(baseViews + 1);
            // On ajoute une petite classe visuelle (optionnel)
            viewText.style.color = "#FF9F1C"; // Orange pour dire "Vu"
        } else {
            // Sinon on affiche le nombre de base
            viewText.textContent = formatViews(baseViews);
        }
    });
});

// 2. Fonction déclenchée au clic (Utilisateur Unique)
window.registerView = (jobId) => {
    // Vérifie si déjà compté
    if (!localStorage.getItem(`seen_${jobId}`)) {
        
        // 1. Marquer comme vu dans le téléphone
        localStorage.setItem(`seen_${jobId}`, 'true');
        
        // 2. Mettre à jour l'affichage visuel (+1)
        const el = document.getElementById(`view-txt-${jobId}`);
        const card = document.getElementById(jobId);
        
        // Récupère le nombre actuel non-formaté depuis l'attribut HTML
        let currentCount = parseInt(card.getAttribute('data-views'));
        let newCount = currentCount + 1;
        
        // Animation simple du chiffre
        el.textContent = formatViews(newCount);
        el.style.color = "#FF9F1C"; // Change la couleur
        
        console.log(`Vue unique comptabilisée pour ${jobId}`);
    }
};

// 3. Formatteur style YouTube (1200 -> 1.2k)
function formatViews(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}
