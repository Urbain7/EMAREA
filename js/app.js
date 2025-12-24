/* =============================== */
/* MOTEUR EM AREA V3 (Full Features) */
/* =============================== */

let allProducts = [];
let allShops = [];
let viewedProducts = JSON.parse(localStorage.getItem('em_history')) || [];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    checkDarkMode(); // Vérifie le thème
    renderHistory(); // Affiche l'historique
});

// --- 1. INITIALISATION ---
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

        // Nettoyage
        document.getElementById('products-container').innerHTML = ''; 
        const loader = document.getElementById('loader');
        if(loader) loader.style.display = 'none';
        
        renderPromos(promoItems);
        renderProducts(standardItems);
        setupSearch();

    } catch (e) {
        console.error(e);
        document.getElementById('products-container').innerHTML = `<div style="text-align:center;">Erreur connexion.</div>`;
    }
}

// --- 2. FONCTIONS DE RENDU (Modifiées pour Copie Lien & Historique) ---
function renderProducts(products) {
    const container = document.getElementById('products-container');
    if(container.innerHTML.includes('skeleton')) container.innerHTML = ''; 

    if(products.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:#999;">Rien trouvé.</div>`;
        return;
    }

    products.slice(0, 30).forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        
        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                <!-- Bouton Copier Lien (Idée 6.55) -->
                <button class="btn-copy" onclick="copyLink('${p.shopUrl}/produit.html?id=${p.id}')">🔗</button>
                
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" onclick="addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')">
                    <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
                </a>
                <div class="product-info">
                    <div class="product-shop">${p.shopName}</div>
                    <div class="product-title">${p.nom}</div>
                    <div class="product-price">${price}</div>
                    <!-- Bouton avec Vibration (Idée 2.2) -->
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

// --- 3. FONCTIONS UTILITAIRES ---

// Fetch sécurisé
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

// Rendering Promos & Shops (Identique avant, résumé pour gain de place)
function renderShops() {
    const c = document.getElementById('shops-container');
    c.innerHTML = '';
    allShops.forEach(s => {
        c.innerHTML += `<a href="${s.url}" class="shop-card"><img src="${s.logo}" class="shop-logo"><div class="shop-name">${s.name}</div></a>`;
    });
    // Ajout du lien vers Jobs dans la liste des shops (Optionnel)
    c.innerHTML += `<a href="jobs.html" class="shop-card"><div class="shop-logo" style="display:flex;align-items:center;justify-content:center;background:#333;color:white;">💼</div><div class="shop-name">Jobs</div></a>`;
}

function renderPromos(promos) {
    const c = document.getElementById('promo-container');
    if(promos.length===0) { c.style.display='none'; return; }
    c.innerHTML = '';
    promos.forEach(p => {
        c.innerHTML += `<div class="promo-card"><a href="${p.shopUrl}" onclick="addToHistory('${p.id}', '${p.nom}', '${p.image}', '${p.shopUrl}')"><img src="${p.image}"></a><div class="promo-info"><div class="product-shop" style="color:#e67e22;">🔥 PROMO</div><div class="promo-title">${p.nom}</div><span class="promo-price">${Number(p.prix).toLocaleString()} F</span></div></div>`;
    });
}

// --- 4. NOUVELLES FONCTIONNALITÉS ---

// Dark Mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    vibratePhone();
    // Sauvegarde
    if(document.body.classList.contains('dark-mode')) {
        localStorage.setItem('em_theme', 'dark');
    } else {
        localStorage.setItem('em_theme', 'light');
    }
}

function checkDarkMode() {
    const theme = localStorage.getItem('em_theme');
    if(theme === 'dark') {
        document.body.classList.add('dark-mode');
    }
}

// Vibration (Haptique)
window.vibratePhone = () => {
    if (navigator.vibrate) {
        navigator.vibrate(50); // Vibre 50ms
    }
};

// Copier Lien
window.copyLink = (url) => {
    vibratePhone();
    navigator.clipboard.writeText(url).then(() => {
        alert("Lien copié !");
    });
};

// Historique
window.addToHistory = (id, name, img, url) => {
    // Évite les doublons
    viewedProducts = viewedProducts.filter(p => p.id !== id);
    // Ajoute au début
    viewedProducts.unshift({ id, name, img, url });
    // Garde max 10
    if(viewedProducts.length > 10) viewedProducts.pop();
    // Sauvegarde
    localStorage.setItem('em_history', JSON.stringify(viewedProducts));
};

function renderHistory() {
    const container = document.getElementById('history-container');
    if(!container || viewedProducts.length === 0) return;
    
    document.getElementById('history-section').style.display = 'block';
    container.innerHTML = '';
    
    viewedProducts.forEach(p => {
        container.innerHTML += `
            <a href="${p.url}/produit.html?id=${p.id}" class="history-card">
                <img src="${p.img}">
                <div>${p.name}</div>
            </a>
        `;
    });
}

// Search et Loader (Déjà vus)
function setupSearch() {
    document.getElementById('search-input').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const c = document.getElementById('products-container');
        c.innerHTML = '';
        const f = allProducts.filter(p => p.nom.toLowerCase().includes(term));
        if(f.length>0) renderProducts(f);
        else c.innerHTML = '<div style="text-align:center;width:100%;">Rien trouvé</div>';
    });
}
function showSkeletonLoader() {
    const c = document.getElementById('products-container');
    c.innerHTML = '';
    for(let i=0; i<4; i++) c.innerHTML += `<div class="skeleton-card skeleton"><div class="skeleton-img skeleton"></div><div class="skeleton-line skeleton"></div></div>`;
}
