/* --- START OF FILE js/map.js --- */

let map;
let allShops = [];
let userPos = null;
let routingControl = null;

// Icônes personnalisées Leaflet
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

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('shops.json');
        allShops = await res.json();
        initMap();
    } catch (e) {
        console.error("Erreur chargement map:", e);
    }
});

function initMap() {
    // 1. Initialisation centrée sur Lomé
    map = L.map('map').setView([6.172, 1.23], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'EM AREA'
    }).addTo(map);

    // 2. HEATMAP (Zones Chaudes - Idée 5.4)
    // Cercles rouges transparents sur zones commerciales
    const hotZones = [
        { lat: 6.1328, lng: 1.2246, radius: 800 }, // Déckon
        { lat: 6.1866, lng: 1.1884, radius: 600 }  // Agoè
    ];

    hotZones.forEach(zone => {
        L.circle([zone.lat, zone.lng], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.1, 
            radius: zone.radius,
            stroke: false
        }).addTo(map);
    });

    // 3. Placement des boutiques
    allShops.forEach(shop => {
        if(shop.lat && shop.lng) {
            // Photo Devanture ou Placeholder
            const shopImg = shop.cover || "https://via.placeholder.com/300x150?text=Boutique";
            
            // NOTE : Badge vérifié RETIRÉ (Premium)
            const popupContent = `
                <div style="text-align:center; min-width:200px;">
                    <img src="${shopImg}" style="width:100%; height:100px; object-fit:cover; border-radius:8px; margin-bottom:5px;">
                    <h3 style="margin:0; font-size:1rem;">${shop.name}</h3>
                    <p style="margin:5px 0; font-size:0.8rem; color:#666;">${shop.location}</p>
                    <br>
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

    // 4. BOUSSOLE (Idée 5.5)
    addCompassControl();
}

// Fonction GPS Utilisateur
window.locateUser = () => {
    if (!navigator.geolocation) return alert("GPS non supporté");

    const btn = document.querySelector('.btn-primary');
    if(btn) btn.textContent = "⏳ Localisation...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userPos = [position.coords.latitude, position.coords.longitude];
            
            map.setView(userPos, 14);
            L.marker(userPos, {icon: iconUser}).addTo(map).bindPopup("<b>Vous êtes ici</b>").openPopup();
            
            if(btn) btn.textContent = "📍 Ma Position (OK)";
            
            // Calculer distances et Prix Zem
            renderDistanceList(userPos);
        },
        () => {
            alert("Erreur GPS. Vérifiez vos paramètres.");
            if(btn) btn.textContent = "📍 Activer mon GPS";
        },
        { enableHighAccuracy: true }
    );
};

// Fonction Tracé Itinéraire
window.drawRoute = (destLat, destLng) => {
    if (!userPos) {
        locateUser();
        // Petite attente pour voir si le GPS répond vite
        setTimeout(() => { if(userPos) drawRoute(destLat, destLng); }, 2000);
        return;
    }

    // Nettoyage ancien tracé
    if (routingControl) map.removeControl(routingControl);

    // Création du tracé
    if (typeof L.Routing !== 'undefined') {
        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(userPos[0], userPos[1]),
                L.latLng(destLat, destLng)
            ],
            routeWhileDragging: false,
            show: false, // Pas d'instructions écrites
            lineOptions: { styles: [{color: '#2EC4B6', opacity: 0.8, weight: 6}] },
            createMarker: function() { return null; }
        }).addTo(map);
        map.closePopup();
    }
};

function renderDistanceList(user) {
    const list = document.getElementById('distance-list');
    if(!list) return;

    list.innerHTML = '';
    
    // Calcul distances
    allShops.forEach(s => {
        if(s.lat) s.dist = getDist(user[0], user[1], s.lat, s.lng);
        else s.dist = 9999;
    });
    
    allShops.sort((a,b) => a.dist - b.dist);

    allShops.forEach(s => {
        if(s.dist < 50) { 
            // Formule Prix Zem : 150F base + 75F/km
            let priceZem = 150 + (s.dist * 75);
            priceZem = Math.ceil(priceZem / 50) * 50; 
            if(priceZem < 200) priceZem = 200;

            list.innerHTML += `
                <div class="distance-item" onclick="map.setView([${s.lat}, ${s.lng}], 16)">
                    <img src="${s.logo}" style="width:40px;height:40px;border-radius:50%;margin-right:10px;border:1px solid #eee;">
                    <div style="flex:1;">
                        <div style="font-weight:bold">${s.name}</div>
                        <div style="font-size:0.7rem; color:#666;">${s.location}</div>
                        <div style="font-size:0.7rem; color:#e67e22; font-weight:bold;">🏍️ Zem: env. ${priceZem} F</div>
                    </div>
                    <div class="dist-val">${s.dist.toFixed(1)} km</div>
                </div>`;
        }
    });
}

// Contrôle Boussole
function addCompassControl() {
    const CompassControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            container.innerHTML = '🧭';
            container.style.backgroundColor = 'white';
            container.style.width = '35px';
            container.style.height = '35px';
            container.style.lineHeight = '35px';
            container.style.textAlign = 'center';
            container.style.cursor = 'pointer';
            container.style.fontSize = '20px';
            container.onclick = function(){
                map.setView(userPos || [6.172, 1.23], 13);
            }
            return container;
        }
    });
    map.addControl(new CompassControl());
}

function getDist(lat1,lon1,lat2,lon2) {
  var R = 6371; 
  var dLat = (lat2-lat1)*(Math.PI/180); 
  var dLon = (lon2-lon1)*(Math.PI/180); 
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)*Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}
