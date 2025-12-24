/* =============================== */
/* MOTEUR D'AGRÉGATION EM AREA V2 */
/* =============================== */

let allProducts = [];
let allShops = [];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    try {
        // 1. Charger les boutiques
        const res = await fetch('shops.json');
        allShops = await res.json();
        
        renderShops();
        
        // 2. Aspirer les produits
        const promises = allShops.map(shop => fetchShopProducts(shop));
        const results = await Promise.all(promises);
        
        let promoItems = []; // Liste pour le slider
        let standardItems = []; // Liste pour la grille

        results.forEach(items => {
            items.forEach(p => {
                // ALGORITHME DE TRI PROMO
                // Si le produit est "Star" OU s'il a un prix original (donc une réduction)
                // On le met dans le slider Promo
                if (p.is_star === true || (p.prix_original && p.prix_original > p.prix)) {
                    promoItems.push(p);
                } else {
                    standardItems.push(p);
                }
            });
        });

        // Mélange
        promoItems.sort(() => 0.5 - Math.random());
        standardItems.sort(() => 0.5 - Math.random());
        
        // On fusionne tout pour la recherche globale, mais on affiche séparément
        allProducts = [...promoItems, ...standardItems];

        // 3. Affichage
        document.getElementById('loader').style.display = 'none';
        
        // Affiche le slider horizontal des promos
        renderPromos(promoItems);
        
        // Affiche la grille classique
        renderProducts(standardItems);

        // Recherche
        document.getElementById('search-input').addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allProducts.filter(p => p.nom.toLowerCase().includes(term));
            // En recherche, on affiche tout dans la grille
            renderProducts(filtered);
            // On cache le slider promo pendant la recherche pour ne pas gêner
            document.getElementById('promo-container').style.display = term ? 'none' : 'flex';
        });

    } catch (e) {
        console.error(e);
    }
}

async function fetchShopProducts(shop) {
    try {
        const res = await fetch(`${shop.url}/data/produits.json`);
        if(!res.ok) return [];
        const data = await res.json();
        const items = data.items ? data.items : data;
        
        return items.map(p => ({
            ...p,
            shopName: shop.name,
            shopUrl: shop.url,
            isVerified: shop.verified,
            image: p.image.startsWith('http') ? p.image : `${shop.url}/${p.image}`
        }));
    } catch { return []; }
}

function renderShops() {
    const container = document.getElementById('shops-container');
    const count = document.getElementById('shop-count');
    if(count) count.textContent = `${allShops.length} actifs`;
    
    allShops.forEach(shop => {
        container.innerHTML += `
            <a href="${shop.url}" class="shop-card" target="_blank">
                <img src="${shop.logo}" class="shop-logo">
                <div class="shop-name">${shop.name}</div>
            </a>
        `;
    });
}

// NOUVEAU : Fonction pour le slider horizontal
function renderPromos(promos) {
    const container = document.getElementById('promo-container');
    container.innerHTML = '';

    if (promos.length === 0) {
        container.innerHTML = '<p style="font-size:0.8rem; color:#888; padding:10px;">Pas de promo aujourd\'hui.</p>';
        return;
    }

    promos.forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        // Affichage ancien prix barré
        const oldPrice = p.prix_original ? `<span class="old-price">${Number(p.prix_original).toLocaleString()} F</span>` : '';

        container.innerHTML += `
            <div class="promo-card">
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank">
                    <img src="${p.image}" loading="lazy">
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
    container.innerHTML = '';
    
    products.slice(0, 24).forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        const certif = p.isVerified ? '<span class="badge-verified">CERTIFIÉ</span>' : '';

        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank">
                    <img src="${p.image}" class="product-img" loading="lazy">
                </a>
                <div class="product-info">
                    <div class="product-shop">${p.shopName} ${certif}</div>
                    <div class="product-title">${p.nom}</div>
                    <div class="product-price">${price}</div>
                    <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank" class="btn btn-outline" style="font-size:0.8rem; padding:5px;">Voir</a>
                </div>
            </div>
        `;
    });
}
