let map;
let allShops = [];
let userPos = null;
let routingControl = null;

document.addEventListener('DOMContentLoaded', async () => {
    const res = await fetch('shops.json');
    allShops = await res.json();
    initMap();
});

function initMap() {
    map = L.map('map').setView([6.172, 1.23], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    allShops.forEach(shop => {
        if(shop.lat && shop.lng) {
            // Bouton "Y aller" qui lance la fonction drawRoute
            const popup = `
                <b>${shop.name}</b><br>${shop.location}<br>
                <button onclick="drawRoute(${shop.lat}, ${shop.lng})" style="background:#2EC4B6; color:white; border:none; padding:5px 10px; border-radius:4px; margin-top:5px; cursor:pointer;">🛣️ Y aller</button>
            `;
            L.marker([shop.lat, shop.lng]).addTo(map).bindPopup(popup);
        }
    });
}

window.locateUser = () => {
    if (!navigator.geolocation) return alert("GPS non supporté");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userPos = [position.coords.latitude, position.coords.longitude];
            
            map.setView(userPos, 13);
            L.marker(userPos, {icon: redIcon()}).addTo(map).bindPopup("Vous").openPopup();
            
            // Calculer les distances pour la liste
            renderDistanceList(userPos);
        },
        () => alert("Activez votre GPS !")
    );
};

// --- FONCTION DE TRACÉ D'ITINÉRAIRE ---
window.drawRoute = (destLat, destLng) => {
    if (!userPos) {
        alert("Veuillez d'abord cliquer sur '📍 Autour de moi' pour vous localiser.");
        return;
    }

    // Supprimer l'ancien tracé s'il y en a un
    if (routingControl) {
        map.removeControl(routingControl);
    }

    // Créer le nouveau tracé
    if (typeof L.Routing !== 'undefined') {
        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(userPos[0], userPos[1]),
                L.latLng(destLat, destLng)
            ],
            routeWhileDragging: false,
            // On cache les instructions textuelles moches (on garde que la ligne)
            show: false, 
            createMarker: function() { return null; } // Pas de nouveaux marqueurs moches
        }).addTo(map);
    } else {
        alert("Chargement de la carte en cours...");
    }
};

function renderDistanceList(user) {
    const list = document.getElementById('distance-list');
    list.innerHTML = '';
    
    allShops.forEach(s => {
        if(s.lat) s.dist = getDist(user[0], user[1], s.lat, s.lng);
        else s.dist = 9999;
    });
    allShops.sort((a,b) => a.dist - b.dist);

    allShops.forEach(s => {
        if(s.dist < 9000) {
            list.innerHTML += `
                <div class="distance-item">
                    <img src="${s.logo}" style="width:40px;height:40px;border-radius:50%;margin-right:10px;">
                    <div style="flex:1;">
                        <div style="font-weight:bold">${s.name}</div>
                        <div style="font-size:0.7rem">${s.location}</div>
                    </div>
                    <div class="dist-val">${s.dist.toFixed(1)} km</div>
                </div>`;
        }
    });
}

function getDist(lat1,lon1,lat2,lon2) {
  var R = 6371; 
  var dLat = (lat2-lat1)*(Math.PI/180); 
  var dLon = (lon2-lon1)*(Math.PI/180); 
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)*Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}

function redIcon() {
    return new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
}
