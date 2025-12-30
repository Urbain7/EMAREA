/* =============================== */
/* MOTEUR EM AREA V15.0 (FINAL)    */
/* =============================== */

let allProducts = [];
let allShops = [];
let viewedProducts = JSON.parse(localStorage.getItem('em_history')) || [];
// --- PANIER (Nouveau) ---
let cart = JSON.parse(localStorage.getItem('em_cart')) || [];

// --- 1. DÉMARRAGE & ROUTING ---
document.addEventListener('DOMContentLoaded', () => {
    checkDarkMode();
    
    // Mise à jour du badge panier au démarrage
    updateCartCount(); 
    
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

    // Listener fermeture modale PANIER (clic en dehors)
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('cart-modal');
        if (e.target === modal) toggleCart();
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
            if(shop.boost_level) score += (shop.boost_level * 1000);
            if(shop.verified) score += 500;
            score += Math.random() * 10; 
            shop.em_score = score;
        });
        
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
                    if(!p.is_star && Math.random() > 0.8) p.is_new = true;
                    
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

// Récupère les produits d'une boutique
async function fetchShopProducts(shop) {
    if (shop.url === '#' || !shop.url) return [];
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000); // Timeout 5s
        
        const jsonUrl = shop.url.endsWith('/') ? `${shop.url}data/produits.json` : `${shop.url}/data/produits.json`;
        
        const res = await fetch(jsonUrl, { signal: controller.signal });
        clearTimeout(id);
        
        if(!res.ok) return [];
        const data = await res.json();
        const items = data.items ? data.items : data;
        
        return items.map(p => {
            let imgSrc = p.image;
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
                shopUrl: shop.url,
                isVerified: shop.verified,
                is_star: p.is_star
            };
        });
    } catch { return []; }
}

// --- 3. RENDU VISUEL (PRODUITS) ---

function renderProducts(products) {
    const container = document.getElementById('products-container');
    if(!container) return; 
    if(container.innerHTML.includes('skeleton')) container.innerHTML = ''; 

    products.slice(0, 30).forEach(p => {
        const priceDisplay = Number(p.prix).toLocaleString() + ' F';
        const newBadgeHTML = p.is_new ? `<div class="badge-new">NOUVEAU</div>` : '';
        const targetUrl = `${p.shopUrl}/index.html?id=${p.id}`;
        
        // Sécurisation des textes pour le JS
        const safeName = p.nom.replace(/'/g, "\\'");
        const safeShop = p.shopName.replace(/'/g, "\\'");

        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                ${newBadgeHTML}
                <button class="btn-copy" onclick="copyLink('${targetUrl}')">🔗</button>
                
                <div style="position:relative;">
                    <a href="${targetUrl}" target="_blank" onclick="addToHistory('${p.id}', '${safeName}', '${p.image}', '${p.shopUrl}')">
                        <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
                    </a>
                    <!-- BOUTON AJOUT PANIER (+) -->
                    <button onclick="addToCart('${p.id}', '${safeName}', ${p.prix}, '${p.image}', '${safeShop}')" 
                        style="position:absolute; bottom:10px; right:10px; width:35px; height:35px; border-radius:50%; border:none; background:white; color:var(--primary); font-weight:bold; box-shadow:0 3px 10px rgba(0,0,0,0.2); cursor:pointer; font-size:1.2rem; display:flex; align-items:center; justify-content:center; z-index:2;">
                        +
                    </button>
                </div>

                <div class="product-info">
                    <div class="product-shop">${p.shopName}</div>
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
                    <div class="product-shop" style="color:#e67e22;">🔥 PROMO</div>
                    <div class="promo-title">${p.nom}</div>
                    <div>${oldPrice}<span class="promo-price">${priceDisplay}</span></div>
                    
                    <button onclick="addToCart('${p.id}', '${safeName}', ${p.prix}, '${p.image}', '${safeShop}')" 
                        class="btn btn-primary" style="font-size:0.75rem; padding:6px 15px; margin-top:8px; width:100%;">
                        Ajouter au Panier
                    </button>
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
            const separator = s.url.includes('?') ? '&' : '?';
            const linkWithTheme = `${s.url}${separator}theme=${currentTheme}`;
            
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

// --- 5. SKELETONS & UTILITAIRES ---

function showSkeletonLoader() {
    const shopC = document.getElementById('shops-container');
    if(shopC) { shopC.innerHTML = ''; for(let i=0;i<5;i++) shopC.innerHTML += `<div class="skeleton-shop-wrapper"><div class="skeleton-shop-circle"></div><div class="skeleton-shop-text"></div></div>`; }
    const promoC = document.getElementById('promo-container');
    if(promoC) { promoC.style.display='flex'; promoC.innerHTML = ''; for(let i=0;i<3;i++) promoC.innerHTML += `<div class="skeleton-promo-card"><div class="skeleton-promo-img"></div><div class="skeleton-promo-content"><div class="skeleton-text-lg"></div><div class="skeleton-text-sm"></div></div></div>`; }
    const prodC = document.getElementById('products-container');
    if(prodC) { prodC.innerHTML = ''; for(let i=0;i<4;i++) prodC.innerHTML += `<div class="skeleton-card skeleton"><div class="skeleton-img skeleton"></div><div class="skeleton-line skeleton"></div></div>`; }
    const jobC = document.getElementById('jobs-container');
    if(jobC) { jobC.innerHTML = ''; for(let i=0;i<4;i++) jobC.innerHTML += `<div class="skeleton-job"><div class="skeleton-title"></div></div>`; }
}

async function loadShopsOnly() {
    try {
        const res = await fetch('shops.json');
        allShops = await res.json();
        allShops.sort((a, b) => {
            let sa = (a.boost_level || 0)*1000 + (a.verified?500:0);
            let sb = (b.boost_level || 0)*1000 + (b.verified?500:0);
            return sb - sa;
        });
        renderShops();
    } catch(e) {}
}

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

// ===============================
// 6. GESTION DU PANIER (NOUVEAU)
// ===============================

function toggleCart() {
    const modal = document.getElementById('cart-modal');
    if(modal) {
        if(modal.classList.contains('active')) {
            modal.classList.remove('active');
        } else {
            renderCart();
            modal.classList.add('active');
        }
    }
}

function addToCart(id, name, price, image, shop) {
    if(navigator.vibrate) navigator.vibrate(50);
    
    cart.push({ id, name, price, image, shop });
    localStorage.setItem('em_cart', JSON.stringify(cart));
    updateCartCount();
    
    // Feedback sur le bouton
    const btn = event.currentTarget; 
    const originalText = btn.innerHTML;
    
    if(btn.innerText.trim() === '+') {
        btn.style.background = '#27ae60';
        btn.style.color = 'white';
        btn.innerText = '✓';
    } else {
        btn.innerText = 'Ajouté !';
        btn.style.background = '#27ae60';
    }
    
    setTimeout(() => {
        if(originalText.trim() === '+') {
            btn.style.background = 'white';
            btn.style.color = 'var(--primary)';
        } else {
            btn.style.background = 'var(--primary)';
        }
        btn.innerHTML = originalText;
    }, 1000);
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
        list.innerHTML = `<div style="text-align:center; padding:40px; color:#ccc;">
            <div style="font-size:3rem; margin-bottom:10px;">🛒</div>
            <p>Votre panier est vide</p>
            <button onclick="toggleCart()" class="btn btn-outline" style="margin-top:10px;">Continuer mes achats</button>
        </div>`;
        if(footer) footer.style.display = 'none';
        return;
    }

    list.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        total += Number(item.price);
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

    if(totalEl) totalEl.innerText = total.toLocaleString() + ' F';
    if(footer) footer.style.display = 'block';
}

function checkoutWhatsApp() {
    if(cart.length === 0) return;

    let msg = "Bonjour, je souhaite commander ces articles :\n\n";
    let total = 0;
    
    cart.forEach(item => {
        msg += `- ${item.name} (${Number(item.price).toLocaleString()} F)\n`;
        total += Number(item.price);
    });
    
    msg += `\n*TOTAL : ${total.toLocaleString()} F*`;
    
    // ⚠ ATTENTION : REMPLACE LE NUMÉRO CI-DESSOUS PAR LE TIEN (Format 228...)
    const myPhone = "22890000000"; 
    
    const url = `https://wa.me/${myPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}
