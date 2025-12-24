/* =============================== */
/* MOTEUR D'AGRÉGATION EM AREA    */
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
        
        // Afficher les logos
        renderShops();
        
        // 2. Aspirer les produits
        const promises = allShops.map(shop => fetchShopProducts(shop));
        const results = await Promise.all(promises);
        
        // 3. Algorithme de tri intelligent
        // On veut mélanger, mais mettre les "Nouveaux" (3 derniers de chaque boutique) en avant
        let newItems = [];
        let standardItems = [];

        results.forEach(items => {
            // Les produits JSON sont souvent du plus vieux au plus récent
            // On inverse pour avoir les récents
            const reversed = items.reverse();
            
            // Les 3 premiers sont "Nouveaux"
            reversed.forEach((p, index) => {
                if(index < 3) {
                    p.isNew = true;
                    newItems.push(p);
                } else {
                    standardItems.push(p);
                }
            });
        });

        // Mélange aléatoire des standards pour l'équité
        standardItems.sort(() => 0.5 - Math.random());
        // Mélange des nouveaux aussi
        newItems.sort(() => 0.5 - Math.random());

        // Fusion : Nouveaux d'abord, le reste ensuite
        allProducts = [...newItems, ...standardItems];

        // 4. Affichage
        document.getElementById('loader').style.display = 'none';
        renderProducts(allProducts);

        // Activer la recherche
        document.getElementById('search-input').addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allProducts.filter(p => p.nom.toLowerCase().includes(term));
            renderProducts(filtered);
        });

    } catch (e) {
        console.error(e);
        document.getElementById('loader').innerHTML = "Erreur de connexion.";
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
            // Correction URL image absolue
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

function renderProducts(products) {
    const container = document.getElementById('products-container');
    container.innerHTML = '';

    // Pagination simple : on affiche les 20 premiers pour l'instant
    // (Vous pourrez réactiver le Load More plus tard)
    products.slice(0, 24).forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        const badge = p.isNew ? '<span class="tag-new">NOUVEAU</span>' : '';
        const certif = p.isVerified ? '<span class="badge-verified">CERTIFIÉ</span>' : '';

        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                ${badge}
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
