/* --- START OF FILE js/map.js (CORRIGÉ V2) --- */

let myMap = null;
let mapShops = []; 
let userPos = null;
let routingControl = null;

// Icônes
const iconUser = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const iconShop = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// Initialisation
window.addEventListener('load', () => {
    if(document.getElementById('map')) {
        initMap();
        loadMapData();
    }
});

function initMap() {
    if (myMap !== null) myMap.remove();
    
    myMap = L.map('map').setView([6.172, 1.23], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'EM AREA',
        maxZoom: 19
    }).addTo(myMap);

    // Cercles de zones (Heatmap)
    [{ lat: 6.1328, lng: 1.2246, r: 800 }, { lat: 6.1866, lng: 1.1884, r: 600 }].forEach(z => {
        L.circle([z.lat, z.lng], { color: 'red', fillColor: '#f03', fillOpacity: 0.1, radius: z.r, stroke: false }).addTo(myMap);
    });

    addCompass();
    setTimeout(() => { myMap.invalidateSize(); }, 500);
}

async function loadMapData() {
    try {
        const res = await fetch('shops.json');
        mapShops = await res.json();
        
        // 1. On place les marqueurs sur la carte
        mapShops.forEach(shop => {
            if(shop.lat && shop.lng) {
                const imgUrl = shop.logo || "https://via.placeholder.com/50";
                
                // Popup centrée
                const popupHTML = `
                    <div style="text-align:center; min-width:150px;">
                        <img src="${imgUrl}" 
                             style="width:50px; height:50px; border-radius:50%; margin: 0 auto 5px auto; display:block; object-fit:cover; border:1px solid #eee;">
                        <h3 style="margin:0; font-size:0.9rem;">${shop.name}</h3>
                        <p style="margin:0; font-size:0.7rem; color:#666;">${shop.location}</p>
                        <button onclick="drawRoute(${shop.lat}, ${shop.lng})" 
                            style="background:#FF9F1C; color:white; border:none; padding:5px 10px; border-radius:15px; margin-top:5px; cursor:pointer;">
                            🏍️ Y aller
                        </button>
                    </div>`;
                
                L.marker([shop.lat, shop.lng], {icon: iconShop}).addTo(myMap).bindPopup(popupHTML);
            }
        });

        // 2. CORRECTION : On affiche la liste TOUT DE SUITE (même sans GPS)
        // On passe 'null' pour dire qu'on n'a pas encore la position
        updateMapList(userPos);

    } catch (e) { console.error("Erreur Map Data:", e); }
}

// GPS Utilisateur (Douce)
window.locateUser = function() {
    if (!navigator.geolocation) {
        showError("GPS non supporté", "Votre navigateur ne gère pas la géolocalisation.");
        return;
    }
    
    const btn = document.getElementById('loc-btn');
    const originalContent = btn ? btn.innerHTML : '';

    if(btn) {
        btn.innerHTML = '<span class="spinning">⏳</span> <span>Recherche...</span>';
        btn.classList.add('btn-disabled');
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            // SUCCÈS
            userPos = [pos.coords.latitude, pos.coords.longitude];
            myMap.setView(userPos, 15);
            
            L.marker(userPos, {icon: iconUser}).addTo(myMap)
             .bindPopup("<b>📍 Vous êtes ici</b>").openPopup();
            
            // Mise à jour de la liste AVEC les distances
            updateMapList(userPos);

            if(btn) {
                btn.innerHTML = '✅ <span>Trouvé !</span>';
                btn.classList.remove('btn-disabled');
                setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
            }
        },
        (err) => {
            // ERREUR
            console.error(err);
            let msg = "Impossible de vous localiser.";
            if (err.code === 1) msg = "Accès GPS refusé.";
            else if (err.code === 2) msg = "Signal GPS introuvable.";
            
            if (typeof showCustomAlert === 'function') showCustomAlert("Erreur GPS", msg);
            else alert(msg);
            
            if(btn) {
                btn.innerHTML = originalContent;
                btn.classList.remove('btn-disabled');
            }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
};

// Itinéraire
window.drawRoute = function(lat, lng) {
    if (!userPos) {
        locateUser(); // Tente de localiser si pas fait
        return;
    }

    if (routingControl) myMap.removeControl(routingControl);

    if (typeof L.Routing !== 'undefined') {
        routingControl = L.Routing.control({
            waypoints: [L.latLng(userPos[0], userPos[1]), L.latLng(lat, lng)],
            routeWhileDragging: false,
            show: false,
            lineOptions: { styles: [{color: '#2EC4B6', opacity: 0.8, weight: 6}] },
            createMarker: () => null
        }).addTo(myMap);
        myMap.closePopup();
    }
};

// Liste des distances (Intelligente)
function updateMapList(user) {
    const list = document.getElementById('distance-list');
    if(!list) return;
    list.innerHTML = '';
    
    // Si on a la position, on calcule les distances
    if (user) {
        mapShops.forEach(s => { s.dist = s.lat ? getDist(user[0], user[1], s.lat, s.lng) : 9999; });
        mapShops.sort((a,b) => a.dist - b.dist);
    } else {
        // Sinon, on garde l'ordre par défaut (ou alphabétique si tu veux)
        // Pas de calcul de distance
    }

    mapShops.forEach(s => {
        // Si GPS actif : on affiche temps trajet
        // Si GPS inactif : on affiche juste "Voir sur la carte"
        let metaInfo = '';
        let distanceInfo = '';

        if (user) {
            // AVEC GPS
            if(s.dist < 50) { // On filtre les trop loins
                let m = Math.round((s.dist / 30) * 60);
                if(m < 1) m = 1;
                let t = m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m} min`;
                
                metaInfo = `<div style="font-size:0.75rem;color:#27ae60;">⏱️ ${t} (Moto)</div>`;
                distanceInfo = `<div class="dist-val">${s.dist.toFixed(1)} km</div>`;
            } else {
                return; // Trop loin
            }
        } else {
            // SANS GPS (Par défaut)
            metaInfo = `<div style="font-size:0.75rem;color:#999;">📍 ${s.location}</div>`;
            distanceInfo = `<div class="dist-val" style="font-size:1.2rem; opacity:0.2;">›</div>`;
        }

        list.innerHTML += `
            <div class="distance-item" onclick="window.scrollTo(0,0); myMap.setView([${s.lat}, ${s.lng}], 16); myMap.openPopup();">
                <img src="${s.logo}" style="width:40px;height:40px;border-radius:50%;margin-right:10px;object-fit:cover;border:1px solid #eee;">
                <div style="flex:1;">
                    <div style="font-weight:bold">${s.name}</div>
                    ${metaInfo}
                </div>
                ${distanceInfo}
            </div>`;
    });
}

function addCompass() {
    const d = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function (map) {
            const c = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            c.innerHTML = '🧭';
            c.style.cssText = 'background:white;width:35px;height:35px;line-height:35px;text-align:center;font-size:20px;cursor:pointer;';
            c.onclick = () => myMap.setView(userPos || [6.172, 1.23], 13);
            return c;
        }
    });
    myMap.addControl(new d());
}

function getDist(lat1,lon1,lat2,lon2) {
  var R = 6371, dLat = (lat2-lat1)*(Math.PI/180), dLon = (lon2-lon1)*(Math.PI/180); 
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)*Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}

function showError(t, m) {
    if (typeof showCustomAlert === 'function') showCustomAlert(t, m);
    else alert(m);
}
