/* --- START OF FILE js/app.js --- */

/* =============================== */
/* MOTEUR D'AGRÉGATION EM AREA V2.2 (Version Sécurisée) */
/* =============================== */

let allProducts = [];
let allShops = [];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // 1. On affiche l'animation de chargement tout de suite
    showSkeletonLoader();

    try {
        // 2. Charger la liste des boutiques
        const res = await fetch('shops.json');
        if (!res.ok) throw new Error("Impossible de charger les boutiques");
        allShops = await res.json();
        
        renderShops(); // Affiche les logos en haut
        
        // 3. Aspirer les produits de manière sécurisée
        // On utilise Promise.allSettled : Si une boutique plante, les autres continuent de charger !
        const promises = allShops.map(shop => fetchShopProducts(shop));
        const results = await Promise.allSettled(promises);
        
        let promoItems = [];
        let standardItems = [];

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                const items = result.value;
                items.forEach(p => {
                    // Algorithme Promo : Si "Star" ou "Réduction"
                    if (p.is_star === true || (p.prix_original && p.prix_original > p.prix)) {
                        promoItems.push(p);
                    } else {
                        standardItems.push(p);
                    }
                });
            }
        });

        // Mélange aléatoire des produits (Shuffle) pour varier l'affichage
        promoItems.sort(() => 0.5 - Math.random());
        standardItems.sort(() => 0.5 - Math.random());
        
        // Stockage global pour la recherche
        allProducts = [...promoItems, ...standardItems];

        // 4. Nettoyage et Affichage Final
        // On vide le loader (le skeleton) avant d'afficher les vrais produits
        document.getElementById('products-container').innerHTML = ''; 
        document.getElementById('loader').style.display = 'none';
        
        renderPromos(promoItems);
        renderProducts(standardItems);

        // Active la barre de recherche
        setupSearch();

    } catch (e) {
        console.error("Erreur critique:", e);
        document.getElementById('products-container').innerHTML = 
            `<div style="text-align:center; col-span:2;">Erreur de connexion au marché.</div>`;
    }
}

// Fonction sécurisée avec "Timeout" (Si une boutique met + de 5s, on annule)
async function fetchShopProducts(shop) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 secondes max

        const res = await fetch(`${shop.url}/data/produits.json`, { signal: controller.signal });
        clearTimeout(timeoutId); // On annule le timer si c'est bon

        if(!res.ok) return [];
        const data = await res.json();
        const items = data.items ? data.items : data;
        
        // Normalisation des données (Ajout des infos de la boutique sur chaque produit)
        return items.map(p => ({
            ...p,
            shopName: shop.name,
            shopUrl: shop.url,
            isVerified: shop.verified,
            // Gestion de l'image : si lien absolu on garde, sinon on colle l'url de la boutique
            image: p.image.startsWith('http') ? p.image : `${shop.url}/${p.image}`
        }));
    } catch (err) { 
        // Si ça échoue, on log juste l'erreur dans la console, on ne bloque pas le site
        console.warn(`Boutique ${shop.name} inaccessible ou lente.`);
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
        container.style.display = 'none'; // Cache le slider s'il est vide
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
    
    // Si c'est pour afficher les résultats de recherche, on vide d'abord
    // Sinon (au chargement initial), on a déjà vidé dans initApp
    if(container.innerHTML.includes('skeleton')) container.innerHTML = ''; 

    if(products.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:#999;">Aucun produit trouvé.</div>`;
        return;
    }

    // On limite à 30 produits pour ne pas faire laguer le téléphone
    products.slice(0, 30).forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        const certif = p.isVerified ? '<span class="badge-verified">✓</span>' : '';

        // On ajoute data-aos pour l'animation d'apparition
        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                <a href="${p.shopUrl}/produit.html?id=${p.id}" target="_blank">
                    <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150?text=Image+Error'">
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

// Fonction Recherche
function setupSearch() {
    const input = document.getElementById('search-input');
    
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const promoContainer = document.getElementById('promo-container');
        const container = document.getElementById('products-container');

        if(term.length === 0) {
            // Si recherche vide, on remet l'affichage normal
            promoContainer.style.display = 'flex';
            container.innerHTML = ''; // On clean
            // On retrouve nos produits standards dans allProducts (il faudrait idéalement séparer, mais ici on recharge tout simple)
            // Pour faire simple sans re-trier, on relance l'init ou on filtre malin.
            // Le plus simple ici : on réaffiche tout ce qui n'est pas promo dans la grille
            const standards = allProducts.filter(p => !p.prix_original || p.prix_original <= p.prix);
            renderProducts(standards);
            return;
        }

        // Si on cherche, on cache les promos pour éviter la confusion
        promoContainer.style.display = 'none';
        
        // On vide la grille et on affiche les résultats
        container.innerHTML = '';
        const filtered = allProducts.filter(p => p.nom.toLowerCase().includes(term));
        renderProducts(filtered);
    });
}

// Affiche les rectangles gris animés
function showSkeletonLoader() {
    const container = document.getElementById('products-container');
    container.innerHTML = '';
    // On génère 4 fausses cartes
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
