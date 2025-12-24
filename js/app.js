/* =============================== */
/* MOTEUR D'AGRÉGATION EM AREA V2.2 */
/* =============================== */

let allProducts = [];
let allShops = [];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // 1. Affiche l'animation de chargement
    showSkeletonLoader();

    try {
        // 2. Charger les boutiques
        const res = await fetch('shops.json');
        if (!res.ok) throw new Error("Impossible de charger les boutiques");
        allShops = await res.json();
        
        renderShops();
        
        // 3. Charger les produits (Méthode robuste)
        // Promise.allSettled permet de continuer même si une boutique plante
        const promises = allShops.map(shop => fetchShopProducts(shop));
        const results = await Promise.allSettled(promises);
        
        let promoItems = [];
        let standardItems = [];

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                const items = result.value;
                items.forEach(p => {
                    // Logique Promo : Produit Star OU Prix barré
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
        
        // Stockage global
        allProducts = [...promoItems, ...standardItems];

        // 4. Nettoyage et Affichage
        document.getElementById('products-container').innerHTML = ''; 
        
        renderPromos(promoItems);
        renderProducts(standardItems);

        // Active la recherche
        setupSearch();

    } catch (e) {
        console.error("Erreur critique:", e);
        document.getElementById('products-container').innerHTML = 
            `<div style="text-align:center; padding:20px;">Erreur de connexion au marché.</div>`;
    }
}

async function fetchShopProducts(shop) {
    try {
        // Timeout de 5 secondes pour ne pas bloquer le site
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`${shop.url}/data/produits.json`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if(!res.ok) return [];
        const data = await res.json();
        const items = data.items ? data.items : data;
        
        // Normalisation
        return items.map(p => ({
            ...p,
            shopName: shop.name,
            shopUrl: shop.url,
            isVerified: shop.verified,
            // Si l'image n'est pas un lien complet, on ajoute l'URL de la boutique
            image: p.image.startsWith('http') ? p.image : `${shop.url}/${p.image}`
        }));
    } catch (err) { 
        console.warn(`Boutique ${shop.name} inaccessible.`);
        return []; 
    }
}

function renderShops() {
    const container = document.getElementById('shops-container');
    const count = document.getElementById('shop-count');
    if(count) count.textContent = `${allShops.length} actifs`;
    
    container.innerHTML = '';
    allShops.forEach(shop => {
        container.innerHTML += `
            <a href="${shop.url}" class="shop-card" target="_blank">
                <img src="${shop.logo}" class="shop-logo" onerror="this.src='https://via.placeholder.com/70'">
                <div class="shop-name">${shop.name}</div>
            </a>
        `;
    });
}

function renderPromos(promos) {
    const container = document.getElementById('promo-container');
    container.innerHTML = '';

    if (promos.length === 0) {
        container.style.display = 'none';
        return;
    }

    promos.forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        const oldPrice = p.prix_original ? `<span class="old-price">${Number(p.prix_original).toLocaleString()} F</span>` : '';

        container.innerHTML += `
            <div class="promo-card">
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank">
                    <img src="${p.image}" loading="lazy" onerror="this.src='https://via.placeholder.com/80?text=No+Img'">
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
            </div>
        `;
    });
}

function renderProducts(products) {
    const container = document.getElementById('products-container');
    
    if(container.innerHTML.includes('skeleton')) container.innerHTML = ''; 

    if(products.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:#999;">Aucun produit trouvé.</div>`;
        return;
    }

    products.slice(0, 30).forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        
        // PAS DE BADGE CERTIFIÉ ICI
        
        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank">
                    <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150?text=Image+Error'">
                </a>
                <div class="product-info">
                    <div class="product-shop">${p.shopName}</div>
                    <div class="product-title">${p.nom}</div>
                    <div class="product-price">${price}</div>
                    <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" class="btn btn-outline" style="font-size:0.8rem; padding:5px;">Voir</a>
                </div>
            </div>
        `;
    });
}

function setupSearch() {
    const input = document.getElementById('search-input');
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const promoContainer = document.getElementById('promo-container');
        const container = document.getElementById('products-container');

        if(term.length === 0) {
            promoContainer.style.display = 'flex';
            container.innerHTML = '';
            // On réaffiche les produits standards (simplifié)
            const standards = allProducts.filter(p => !p.prix_original || p.prix_original <= p.prix);
            renderProducts(standards);
            return;
        }

        promoContainer.style.display = 'none';
        container.innerHTML = '';
        const filtered = allProducts.filter(p => p.nom.toLowerCase().includes(term));
        renderProducts(filtered);
    });
}

function showSkeletonLoader() {
    const container = document.getElementById('products-container');
    container.innerHTML = '';
    // Génère 4 fausses cartes de chargement
    for(let i=0; i<4; i++) {
        container.innerHTML += `
            <div class="skeleton-card skeleton">
                <div class="skeleton-img skeleton"></div>
                <div class="skeleton-line skeleton"></div>
                <div class="skeleton-line short skeleton"></div>
            </div>
        `;
    }
}
