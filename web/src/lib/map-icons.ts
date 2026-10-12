import L from 'leaflet';

/**
 * Custom Driver Marker (Scooter / Motorbike with live radar pulse)
 */
export const driverIcon = L.divIcon({
  className: 'custom-leaflet-icon',
  html: `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <!-- Pulsing radar ring -->
      <div class="driver-marker-pulse" style="position: absolute; width: 44px; height: 44px; background: rgba(34, 197, 94, 0.4); border-radius: 50%;"></div>
      <!-- Center badge -->
      <div style="position: relative; width: 36px; height: 36px; background: #006e2f; border: 2.5px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);">
        <!-- Motorcycle / Delivery Scooter SVG -->
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="5" cy="18" r="3"></circle>
          <circle cx="19" cy="18" r="3"></circle>
          <path d="M5 18h4l3-8h5"></path>
          <path d="M16 10l2 8"></path>
          <path d="M14 5h4"></path>
          <rect x="7" y="7" width="4.5" height="4" rx="0.8" fill="#ffffff" stroke="none"></rect>
        </svg>
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

/**
 * Custom Pickup Location Marker (Green Pin with Package Icon)
 */
export const pickupIcon = L.divIcon({
  className: 'custom-leaflet-icon',
  html: `
    <div style="position: relative; width: 34px; height: 44px; display: flex; flex-direction: column; align-items: center;">
      <div style="width: 32px; height: 32px; background: #15803d; border: 2.5px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25); color: #ffffff;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </div>
      <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #15803d; margin-top: -2px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));"></div>
    </div>
  `,
  iconSize: [34, 44],
  iconAnchor: [17, 44],
});

/**
 * Custom Dropoff Location Marker (Red Pin with Destination Flag)
 */
export const dropoffIcon = L.divIcon({
  className: 'custom-leaflet-icon',
  html: `
    <div style="position: relative; width: 34px; height: 44px; display: flex; flex-direction: column; align-items: center;">
      <div style="width: 32px; height: 32px; background: #dc2626; border: 2.5px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25); color: #ffffff;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
          <line x1="4" y1="22" x2="4" y2="15"></line>
        </svg>
      </div>
      <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #dc2626; margin-top: -2px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));"></div>
    </div>
  `,
  iconSize: [34, 44],
  iconAnchor: [17, 44],
});
