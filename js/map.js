/* --- START OF FILE js/map.js (Version Blindée) --- */

let map;
let allShops = [];
let userPos = null;
let routingControl = null;

// Icônes personnalisées
const iconUser = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const iconShop = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// --- 1. DÉMARRAGE SÉCURISÉ ---
document.addEventListener('DOMContentLoaded', () => {
    // A. On lance la carte TOUT DE SUITE (ne pas attendre les données)
    if(document.getElementById('map')) {
        initMap();
    }

    // B. Ensuite on va chercher les boutiques
    loadShopsData();
});

function initMap() {
    // Initialisation centrée sur Lomé
    map = L.map('map').setView([6.172, 1.23], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'EM AREA'
    }).addTo(map);

    // Heatmap (Zones rouges)
    const hotZones = [
        { lat: 6.1328, lng: 1.2246, radius: 800 }, // Déckon
        { lat: 6.1866, lng: 1.1884, radius: 600 }  // Agoè
    ];
    hotZones.forEach(zone => {
        L.circle([zone.lat, zone.lng], {
            color: 'red', fillColor: '#f03', fillOpacity: 0.1, radius: zone.radius, stroke: false
        }).addTo(map);
    });

    // Boussole
    addCompassControl();
}

async function loadShopsData() {
    try {
        const res = await fetch('shops.json');
        if(!res.ok) throw new Error("Erreur fichier");
        allShops = await res.json();
        
        // Une fois chargé, on ajoute les marqueurs
        addShopsToMap();
        
        // Si on a déjà la position GPS, on recalcule la liste
        if(userPos) renderDistanceList(userPos);
        
    } catch (e) {
        console.error("Erreur chargement boutiques:", e);
        // La carte reste affichée même si erreur
    }
}

function addShopsToMap() {
    allShops.forEach(shop => {
        if(shop.lat && shop.lng) {
            const shopImg = shop.cover || "https://via.placeholder.com/300x150?text=Boutique";
            
            const popupContent = `
                <div style="text-align:center; min-width:200px;">
                    <img src="${shopImg}" style="width:100%; height:100px; object-fit:cover; border-radius:8px; margin-bottom:5px;">
                    <h3 style="margin:0; font-size:1rem; color:#333;">${shop.name}</h3>
                    <p style="margin:5px 0; font-size:0.8rem; color:#666;">${shop.location}</p>
                    <button onclick="drawRoute(${shop.lat}, ${shop.lng})" 
                        style="background:#FF9F1C; color:white; border:none; padding:8px 15px; border-radius:20px; margin-top:8px; cursor:pointer; font-weight:bold;">
                        🏍️ Y aller
                    </button>
                </div>
            `;
            
            L.marker([shop.lat, shop.lng], {icon: iconShop})
             .addTo(map)
             .bindPopup(popupContent);
        }
    });
}

// --- FONCTIONS UTILISATEUR ---

window.locateUser = () => {
    if (!navigator.geolocation) return alert("GPS non supporté.");
    
    const btn = document.querySelector('.btn-primary');
    if(btn) btn.textContent = "⏳ Recherche...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userPos = [position.coords.latitude, position.coords.longitude];
            
            map.setView(userPos, 14);
            L.marker(userPos, {icon: iconUser}).addTo(map).bindPopup("<b>Vous êtes ici</b>").openPopup();
            
            if(btn) btn.textContent = "📍 Position trouvée";
            renderDistanceList(userPos);
        },
        () => { alert("Activez votre GPS !"); if(btn) btn.textContent = "📍 Activer GPS"; },
        { enableHighAccuracy: true }
    );
};

window.drawRoute = (destLat, destLng) => {
    if (!userPos) {
        locateUser();
        setTimeout(() => { if(userPos) drawRoute(destLat, destLng); }, 2000);
        return;
    }
    if (routingControl) map.removeControl(routingControl);
    if (typeof L.Routing !== 'undefined') {
        routingControl = L.Routing.control({
            waypoints: [L.latLng(userPos[0], userPos[1]), L.latLng(destLat, destLng)],
            routeWhileDragging: false, show: false,
            lineOptions: { styles: [{color: '#2EC4B6', opacity: 0.8, weight: 6}] },
            createMarker: function() { return null; }
        }).addTo(map);
        map.closePopup();
    }
};

// --- LISTE AVEC TEMPS DE TRAJET ---
function renderDistanceList(user) {
    const list = document.getElementById('distance-list');
    if(!list) return;
    list.innerHTML = '';
    
    allShops.forEach(s => {
        if(s.lat) s.dist = getDist(user[0], user[1], s.lat, s.lng);
        else s.dist = 9999;
    });
    allShops.sort((a,b) => a.dist - b.dist);

    allShops.forEach(s => {
        if(s.dist < 50) { 
            // CALCUL TEMPS (Vitesse 30km/h)
            let timeMin = Math.round((s.dist / 30) * 60);
            if(timeMin < 1) timeMin = 1;
            
            // Formatage (min ou h)
            let timeText = `${timeMin} min`;
            if(timeMin >= 60) {
                let h = Math.floor(timeMin / 60);
                let m = timeMin % 60;
                timeText = `${h}h ${m}min`;
            }

            list.innerHTML += `
                <div class="distance-item" onclick="map.setView([${s.lat}, ${s.lng}], 16)">
                    <img src="${s.logo}" style="width:40px;height:40px;border-radius:50%;margin-right:10px;border:1px solid #eee; object-fit:cover;">
                    <div style="flex:1;">
                        <div style="font-weight:bold">${s.name}</div>
                        <div style="font-size:0.7rem; color:#666;">${s.location}</div>
                        <div style="font-size:0.75rem; color:#27ae60; font-weight:bold; margin-top:2px;">
                            ⏱️ Env. ${timeText} (Moto)
                        </div>
                    </div>
                    <div class="dist-val">${s.dist.toFixed(1)} km</div>
                </div>`;
        }
    });
}

function addCompassControl() {
    const CompassControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function (map) {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            div.innerHTML = '🧭';
            div.style.cssText = 'background:white; width:35px; height:35px; text-align:center; line-height:35px; cursor:pointer; font-size:20px;';
            div.onclick = () => map.setView(userPos || [6.172, 1.23], 13);
            return div;
        }
    });
    map.addControl(new CompassControl());
}

function getDist(lat1,lon1,lat2,lon2) {
  var R = 6371; 
  var dLat = (lat2-lat1)*(Math.PI/180); var dLon = (lon2-lon1)*(Math.PI/180); 
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)*Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}
