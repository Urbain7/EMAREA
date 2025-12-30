/* =============================== */
/* MOTEUR EM AREA V2.0 (ALIBABA)   */
/* =============================== */

// ⚠️ CONFIGURATION ADMIN
const ADMIN_WHATSAPP = "22870901801"; // <--- METS TON NUMÉRO ICI

// ÉTAT GLOBAL
let allProducts = [];
let allShops = [];
let viewedProducts = JSON.parse(localStorage.getItem('em_history')) || [];
let cart = JSON.parse(localStorage.getItem('em_cart')) || [];
let loyaltyPoints = parseInt(localStorage.getItem('em_points')) || 0;

// --- 1. DÉMARRAGE ---
document.addEventListener('DOMContentLoaded', () => {
    checkDarkMode();
    updateCartCount();
    updateLoyaltyBar(); // Nouvelle barre de fidélité

    // Splash Screen
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.visibility = 'hidden', 500);
        }
    }, 1500);

    initPullToRefresh();
    injectConciergeButton(); // Bouton "Je cherche pour toi"

    // ROUTING
    if(document.getElementById('products-container')) {
        initApp(); // Charge boutiques & produits
        renderHistory();
        if(document.getElementById('market-home-container')) loadHomeMarket();
    } 
    else if(document.getElementById('jobs-container')) loadJobs();
    else if(document.getElementById('shops-container')) loadShopsOnly();

    // Listener Modale Panier
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('cart-modal');
        if (e.target === modal) toggleCart();
    });
});

// --- 2. MOTEUR PRINCIPAL ---
async function initApp() {
    showSkeletonLoader();

    try {
        // 1. Charger les boutiques (Central)
        const res = await fetch('shops.json?t=' + Date.now()); // Anti-cache
        if (!res.ok) throw new Error("Erreur Shops");
        const rawShops = await res.json();
        
        // 2. FILTRE & TRI (Monétisation)
        // On ne garde que les "active" et on trie par Boost
        allShops = rawShops.filter(s => s.subscription === 'active');
        allShops.sort((a, b) => (b.boost_level || 0) - (a.boost_level || 0));

        renderShops(); // Affiche le slider des boutiques
        
        // 3. CHARGER LES PRODUITS (Distribué)
        const promises = allShops.map(shop => fetchShopProducts(shop));
        const results = await Promise.allSettled(promises);
        
        let promoItems = [];
        let standardItems = [];

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                result.value.forEach(p => {
                    // Logique de tri "Alibaba"
                    if (p.is_star || p.boost_level > 0 || (p.prix_original > p.prix)) {
                        promoItems.push(p);
                    } else {
                        standardItems.push(p);
                    }
                });
            }
        });

        // Mélange intelligent (Boostés en premier dans chaque liste)
        allProducts = [...promoItems, ...standardItems];

        // 4. RENDU UI
        document.getElementById('loader').style.display = 'none';
        
        renderCategories(); // Barre de navigation
        renderPromos(promoItems);
        renderProducts(standardItems);
        setupSearch();

    } catch (e) {
        console.error(e);
        document.getElementById('products-container').innerHTML = `<div style="text-align:center; padding:20px;">Erreur connexion au marché.</div>`;
    }
}

// Récupération Standard V2
async function fetchShopProducts(shop) {
    if (!shop.url || shop.url === '#') return [];
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 6000);
        
        const jsonUrl = shop.url.endsWith('/') ? `${shop.url}data/produits.json` : `${shop.url}/data/produits.json`;
        const res = await fetch(jsonUrl, { signal: controller.signal });
        clearTimeout(id);
        
        if(!res.ok) return [];
        const data = await res.json();
        const items = data.items ? data.items : data;
        
        return items.map(p => {
            // Correction Image
            let imgSrc = p.image;
            if (imgSrc && !imgSrc.startsWith('http')) {
                if (imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
                const baseUrl = shop.url.endsWith('/') ? shop.url : `${shop.url}/`;
                imgSrc = baseUrl + imgSrc;
            }
            
            // MAPPING V2 (Champs Alibaba)
            return {
                id: p.id,
                nom: p.nom,
                category: p.category || "Divers",
                prix: p.prix,
                prix_original: p.prix_original,
                wholesale_price: p.wholesale_price, // Gros
                min_qty: p.min_qty,
                stock_status: p.stock_status || 'stock', // stock vs order
                video_url: p.video_url, // Vidéo
                negotiable: p.negotiable, // Négociation
                image: imgSrc,
                shopName: shop.name,
                shopUrl: shop.url,
                shopBoost: shop.boost_level || 0,
                isVerified: shop.verified,
                is_star: p.is_star
            };
        });
    } catch { return []; }
}

// --- 3. RENDU AVANCÉ (V2) ---

function renderCategories() {
    // Crée la barre de catégories dynamiquement
    const cats = ['Tout', ...new Set(allProducts.map(p => p.category))];
    const header = document.querySelector('.app-header');
    
    // On l'insère après la recherche si elle n'existe pas
    let bar = document.getElementById('cat-bar');
    if(!bar) {
        bar = document.createElement('div');
        bar.id = 'cat-bar';
        bar.className = 'shops-slider'; // Réutilise le style slider
        bar.style.padding = '0 15px 10px';
        bar.style.marginTop = '-10px';
        // Insérer après la barre de recherche
        const search = document.querySelector('.search-wrapper');
        if(search) search.parentNode.insertBefore(bar, search.nextSibling);
    }

    bar.innerHTML = '';
    cats.forEach(c => {
        bar.innerHTML += `
            <button onclick="filterCategory('${c}', this)" 
            style="border:1px solid #ddd; background:white; padding:6px 15px; border-radius:20px; font-size:0.8rem; white-space:nowrap; cursor:pointer; margin-right:5px; color:#555;">
            ${c}
            </button>`;
    });
}

function filterCategory(cat, btn) {
    // Visuel bouton
    const bar = document.getElementById('cat-bar');
    Array.from(bar.children).forEach(b => { b.style.background='white'; b.style.color='#555'; b.style.borderColor='#ddd'; });
    btn.style.background = 'var(--dark)'; btn.style.color='white'; btn.style.borderColor='var(--dark)';

    if(cat === 'Tout') {
        renderProducts(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category === cat);
        renderProducts(filtered);
    }
}

function renderProducts(products) {
    const container = document.getElementById('products-container');
    if(!container) return; 
    container.innerHTML = ''; 

    if(products.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px;">
            <p>Aucun produit trouvé 😕</p>
            <button class="btn btn-primary" onclick="openConcierge()">Je cherche pour toi 🕵️‍♂️</button>
        </div>`;
        return;
    }

    products.slice(0, 40).forEach(p => {
        const priceDisplay = Number(p.prix).toLocaleString() + ' F';
        
        // BADGES INTELLIGENTS
        let badgesHTML = '';
        if(p.stock_status === 'order') badgesHTML += `<div class="badge-new" style="background:#3498db;">SUR COMMANDE</div>`;
        else if(p.wholesale_price) badgesHTML += `<div class="badge-new" style="background:#9b59b6;">GROSSISTE</div>`;
        else if(p.is_new) badgesHTML += `<div class="badge-new">NOUVEAU</div>`;

        // Lien & Textes
        const targetUrl = `${p.shopUrl}/index.html?id=${p.id}`;
        const safeName = p.nom.replace(/'/g, "\\'");
        const safeShop = p.shopName.replace(/'/g, "\\'");
        
        // Icône Vidéo
        const videoIcon = p.video_url ? '<span style="font-size:0.8rem;">🎥</span>' : '';

        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                ${badgesHTML}
                <button class="btn-copy" onclick="copyLink('${targetUrl}')">🔗</button>
                
                <div style="position:relative;">
                    <a href="${targetUrl}" target="_blank" onclick="addToHistory('${p.id}', '${safeName}', '${p.image}', '${p.shopUrl}')">
                        <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
                    </a>
                    
                    <!-- ACTIONS RAPIDES -->
                    <div style="position:absolute; bottom:10px; right:10px; display:flex; gap:5px;">
                        <!-- Négocier -->
                        ${p.negotiable ? `
                        <button onclick="negotiate('${safeName}', ${p.prix})" 
                            style="width:35px; height:35px; border-radius:50%; border:none; background:white; color:#e67e22; font-weight:bold; box-shadow:0 3px 10px rgba(0,0,0,0.2); cursor:pointer;">
                            💬
                        </button>` : ''}
                        
                        <!-- Panier -->
                        <button onclick="addToCart('${p.id}', '${safeName}', ${p.prix}, '${p.image}', '${safeShop}')" 
                            style="width:35px; height:35px; border-radius:50%; border:none; background:white; color:var(--primary); font-weight:bold; box-shadow:0 3px 10px rgba(0,0,0,0.2); cursor:pointer; font-size:1.2rem;">
                            +
                        </button>
                    </div>
                </div>

                <div class="product-info">
                    <div class="product-shop">${p.shopName} ${videoIcon}</div>
                    <div class="product-title">${p.nom}</div>
                    <div class="product-price">${priceDisplay}</div>
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
        const priceDisplay = Number(p.prix).toLocaleString() + ' F';
        const oldPrice = p.prix_original ? `<span class="old-price">${Number(p.prix_original).toLocaleString()} F</span>` : '';
        const safeName = p.nom.replace(/'/g, "\\'");
        const safeShop = p.shopName.replace(/'/g, "\\'");

        c.innerHTML += `
            <div class="promo-card">
                <img src="${p.image}" onclick="window.open('${p.shopUrl}/index.html?id=${p.id}')">
                <div class="promo-info">
                    <div class="product-shop" style="color:#e67e22;">🔥 FLASH</div>
                    <div class="promo-title">${p.nom}</div>
                    <div>${oldPrice}<span class="promo-price">${priceDisplay}</span></div>
                    
                    <button onclick="addToCart('${p.id}', '${safeName}', ${p.prix}, '${p.image}', '${safeShop}')" 
                        class="btn btn-primary" style="font-size:0.75rem; padding:6px 15px; margin-top:8px; width:100%;">
                        Ajouter
                    </button>
                </div>
            </div>`;
    });
}

function renderShops() {
    const c = document.getElementById('shops-container');
    const countLabel = document.getElementById('shop-count');
    if(c && countLabel) {
        countLabel.textContent = `${allShops.length} actifs`;
        c.innerHTML = '';
        allShops.forEach(s => {
            const separator = s.url.includes('?') ? '&' : '?';
            const linkWithTheme = `${s.url}${separator}theme=${localStorage.getItem('em_theme')}`;
            let sponsorBadge = s.boost_level > 0 ? `<div class="badge-sponsored">SPONSORISÉ</div>` : '';
            
            c.innerHTML += `
            <a href="${linkWithTheme}" class="shop-card" target="_blank">
                <div style="position:relative;">
                    <img src="${s.logo}" class="shop-logo" style="${s.boost_level > 0 ? "border:2px solid #FFD700" : ""}" onerror="this.src='https://via.placeholder.com/70'">
                    ${sponsorBadge}
                </div>
                <div class="shop-name">${s.name}</div>
            </a>`;
        });
    }
}

// --- 4. FONCTIONNALITÉS ALIBABA ---

function setupSearch() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    if(!input) return;
    
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        // UI
        if(clearBtn) clearBtn.style.display = term.length > 0 ? 'block' : 'none';
        const promoC = document.getElementById('promo-container');
        if(promoC) promoC.style.display = term.length === 0 ? 'flex' : 'none';
        
        // RECHERCHE INTELLIGENTE (Nom + Catégorie + Boutique)
        const f = allProducts.filter(p => 
            p.nom.toLowerCase().includes(term) || 
            p.shopName.toLowerCase().includes(term) ||
            p.category.toLowerCase().includes(term)
        );
        
        renderProducts(f);
    });
}

function injectConciergeButton() {
    if(document.getElementById('concierge-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'concierge-btn';
    btn.innerHTML = '🕵️‍♂️';
    btn.style.cssText = "position:fixed; bottom:85px; left:20px; width:45px; height:45px; background:var(--dark); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.5rem; box-shadow:0 4px 10px rgba(0,0,0,0.3); z-index:1900; cursor:pointer; border:2px solid white;";
    btn.onclick = openConcierge;
    document.body.appendChild(btn);
}

function openConcierge() {
    const msg = "Bonjour EM AREA, je cherche un produit spécifique qui n'est pas sur le site. Voici les détails :";
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
}

function negotiate(name, price) {
    const msg = `Bonjour, je suis intéressé par *${name}* (${price} F). Est-ce que le prix est discutable ?`;
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
}

// --- 5. PANIER & LOGISTIQUE (V2) ---

function toggleCart() {
    const modal = document.getElementById('cart-modal');
    if(modal) {
        if(modal.classList.contains('active')) modal.classList.remove('active');
        else { renderCart(); modal.classList.add('active'); }
    }
}

function addToCart(id, name, price, image, shop) {
    if(navigator.vibrate) navigator.vibrate(50);
    cart.push({ id, name, price, image, shop });
    localStorage.setItem('em_cart', JSON.stringify(cart));
    updateCartCount();
    
    // Animation bouton
    const btn = event.currentTarget; 
    const originalText = btn.innerHTML;
    btn.innerHTML = btn.innerText.includes('+') ? '✓' : 'Ajouté';
    btn.style.background = '#27ae60'; btn.style.color='white';
    setTimeout(() => { btn.style.background = 'white'; btn.style.color='var(--primary)'; btn.innerHTML = originalText; }, 1000);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('em_cart', JSON.stringify(cart));
    renderCart();
    updateCartCount();
}

function updateCartCount() {
    const badge = document.getElementById('cart-count');
    if(badge) {
        badge.innerText = cart.length;
        badge.style.display = cart.length > 0 ? 'inline-block' : 'none';
    }
}

function renderCart() {
    const list = document.getElementById('cart-items');
    const footer = document.getElementById('cart-footer');
    const totalEl = document.getElementById('cart-total-amount');
    
    if(!list) return;
    
    if(cart.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:40px; color:#ccc;"><p>Votre panier est vide</p></div>`;
        if(footer) footer.style.display = 'none';
        return;
    }

    list.innerHTML = '';
    let subTotal = 0;

    cart.forEach((item, index) => {
        subTotal += Number(item.price);
        list.innerHTML += `
        <div class="cart-item">
            <img src="${item.image}" onerror="this.src='https://via.placeholder.com/50'">
            <div class="cart-item-info">
                <div class="cart-title">${item.name}</div>
                <div style="font-size:0.7rem; color:#888;">${item.shop}</div>
                <div class="cart-price">${Number(item.price).toLocaleString()} F</div>
            </div>
            <button class="btn-remove" onclick="removeFromCart(${index})">&times;</button>
        </div>`;
    });

    // ZONE LOGISTIQUE INTÉGRÉE
    list.innerHTML += `
        <div style="margin-top:20px; padding:15px; background:#f8f9fa; border-radius:12px;">
            <div style="font-weight:bold; margin-bottom:10px;">Mode de réception :</div>
            
            <label style="display:flex; align-items:center; gap:10px; margin-bottom:10px; cursor:pointer;">
                <input type="radio" name="delivery-mode" value="boutique" checked onchange="updateCartTotal(${subTotal})">
                <span>🏃 Retrait en Boutique (Gratuit)</span>
            </label>
            
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                <input type="radio" name="delivery-mode" value="livraison" onchange="updateCartTotal(${subTotal})">
                <span>🛵 Livraison (+500 F)</span>
            </label>
            
            <input type="text" id="delivery-zone" placeholder="Votre Quartier (ex: Agoè)" 
                style="width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; margin-top:10px; display:none;">
        </div>
    `;

    updateCartTotal(subTotal);
    if(footer) footer.style.display = 'block';
}

function updateCartTotal(subTotal) {
    const mode = document.querySelector('input[name="delivery-mode"]:checked').value;
    const totalEl = document.getElementById('cart-total-amount');
    const zoneInput = document.getElementById('delivery-zone');
    
    let total = subTotal;
    if(mode === 'livraison') {
        total += 500;
        zoneInput.style.display = 'block';
    } else {
        zoneInput.style.display = 'none';
    }
    
    totalEl.innerText = total.toLocaleString() + ' F';
}

function checkoutWhatsApp() {
    if(cart.length === 0) return;
    
    const mode = document.querySelector('input[name="delivery-mode"]:checked').value;
    const zone = document.getElementById('delivery-zone').value;
    
    if(mode === 'livraison' && !zone) {
        alert("Veuillez indiquer votre quartier pour la livraison.");
        return;
    }

    // GESTION FIDÉLITÉ
    loyaltyPoints++;
    localStorage.setItem('em_points', loyaltyPoints);
    updateLoyaltyBar();

    // CONSTRUCTION MESSAGE
    let msg = `*NOUVELLE COMMANDE (${mode === 'livraison' ? 'LIVRAISON' : 'RETRAIT'})* 📦\n`;
    if(mode === 'livraison') msg += `📍 Quartier : ${zone}\n`;
    msg += `---------------------------\n`;

    let total = 0;
    
    // Groupage par boutique (Aspect Pro)
    const grouped = {};
    cart.forEach(item => {
        if(!grouped[item.shop]) grouped[item.shop] = [];
        grouped[item.shop].push(item);
        total += Number(item.price);
    });

    for (const [shopName, items] of Object.entries(grouped)) {
        msg += `🏪 *${shopName}*\n`;
        items.forEach(i => msg += `- ${i.name} (${Number(i.price).toLocaleString()} F)\n`);
        msg += `\n`;
    }

    if(mode === 'livraison') {
        msg += `🚚 Livraison : 500 F\n`;
        total += 500;
    }
    
    msg += `---------------------------\n`;
    msg += `💰 *TOTAL À PAYER : ${total.toLocaleString()} F*`;

    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
}

// --- 6. UTILITAIRES & SYSTEME ---
function updateLoyaltyBar() {
    // Insérer une barre de progression dans le menu du bas ou header si on veut
    // Pour l'instant, simple log ou Toast
    if(loyaltyPoints > 0 && loyaltyPoints % 5 === 0) {
        alert("🎉 Félicitations ! Vous avez gagné un code promo : FIDEL500");
    }
}

function showSkeletonLoader() {
    const shopC = document.getElementById('shops-container');
    if(shopC) { shopC.innerHTML = ''; for(let i=0;i<5;i++) shopC.innerHTML += `<div class="skeleton-shop-wrapper"><div class="skeleton-shop-circle"></div><div class="skeleton-shop-text"></div></div>`; }
    const prodC = document.getElementById('products-container');
    if(prodC) { prodC.innerHTML = ''; for(let i=0;i<4;i++) prodC.innerHTML += `<div class="skeleton-card skeleton"><div class="skeleton-img skeleton"></div><div class="skeleton-line skeleton"></div></div>`; }
}

async function loadShopsOnly() {
    // Pour la page Carte si besoin
    try {
        const res = await fetch('shops.json');
        allShops = await res.json();
        renderShops();
    } catch(e) {}
}

function loadHomeMarket() { /* Code existant Market */ }
function loadJobs() { /* Code existant Jobs */ }

window.clearSearch = function() { const i = document.getElementById('search-input'); if(i){ i.value=''; i.dispatchEvent(new Event('input')); i.focus(); } };
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); localStorage.setItem('em_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
function checkDarkMode() { if(localStorage.getItem('em_theme') === 'dark') document.body.classList.add('dark-mode'); }
window.copyLink = (url) => { if (navigator.vibrate) navigator.vibrate(50); navigator.clipboard.writeText(url).then(() => alert("Lien copié !")); };
window.addToHistory = (id, n, i, u) => { viewedProducts = viewedProducts.filter(p => p.id !== id); viewedProducts.unshift({ id, name: n, img: i, url: u }); if(viewedProducts.length > 10) viewedProducts.pop(); localStorage.setItem('em_history', JSON.stringify(viewedProducts)); };
function renderHistory() { const c = document.getElementById('history-container'); const s = document.getElementById('history-section'); if(!c || !s || viewedProducts.length===0) return; s.style.display = 'block'; c.innerHTML = ''; viewedProducts.forEach(p => c.innerHTML += `<a href="${p.url}/index.html?id=${p.id}" class="history-card"><img src="${p.img}"><div style="font-size:0.7rem;">${p.name}</div></a>`); }
function initPullToRefresh() { /* Code existant PTR */ }
