import { useEffect, useRef } from 'preact/hooks';

const defaultLocations = {
  'South B': [-1.323, 36.833],
  'Nairobi West': [-1.316, 36.817],
  Kibera: [-1.313, 36.787],
  Mukuru: [-1.316, 36.881],
};

export default function RealRiskMap({ areas = [], onRunModel }) {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const selectedMarkerRef = useRef(null);

  useEffect(() => {
    if (!elementRef.current || !window.L) return undefined;
    const map = window.L.map(elementRef.current, { zoomControl: false, scrollWheelZoom: false, minZoom: 10, maxZoom: 18 }).setView([-1.2921, 36.8219], 12);
    window.L.control.zoom({ position: 'topright' }).addTo(map);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      subdomains: 'abc',
      maxZoom: 19,
      maxNativeZoom: 19,
      updateWhenIdle: true,
      keepBuffer: 3,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    const timer = window.setTimeout(() => map.invalidateSize(), 100);
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;
    markersRef.current.forEach((marker) => marker.remove());
    const visibleAreas = areas.length ? areas : Object.entries(defaultLocations).map(([name, [latitude, longitude]]) => ({
      id: name,
      name,
      latitude,
      longitude,
      riskLevel: 'UNKNOWN',
    }));
    markersRef.current = visibleAreas.flatMap((area) => {
      const coordinates = Number.isFinite(Number(area.latitude)) && Number.isFinite(Number(area.longitude))
        ? [Number(area.latitude), Number(area.longitude)]
        : defaultLocations[area.name];
      if (!coordinates) return [];
      const safeName = String(area.name).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
      const safeZone = String(area.zone || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
      const safeRisk = String(area.riskLevel || 'UNKNOWN').toLowerCase().replace(/[^a-z0-9-]/g, '');
      const rainfall = area.rainfallLast24HoursMm == null ? '' : ` · ${Number(area.rainfallLast24HoursMm).toFixed(1)} mm`;
      const label = `${safeName}${rainfall}`;
      const icon = window.L.divIcon({
        className: 'leaflet-div-icon airbnb-map-marker',
        html: `<span class="airbnb-marker-dot risk-dot-${safeRisk}"></span><b>${label}</b>`,
        iconSize: [170, 42],
        iconAnchor: [18, 21],
      });
      const details = [
        `<strong>${safeName}</strong>`,
        safeZone,
        area.rainfallLast24HoursMm == null ? 'Rainfall readings unavailable' : `${Number(area.rainfallLast24HoursMm).toFixed(1)} mm in the last 24 hours`,
        area.rainfallIntensityMmPerHour == null ? '' : `${Number(area.rainfallIntensityMmPerHour).toFixed(1)} mm/h peak intensity`,
        area.riskLevel && area.riskLevel !== 'UNKNOWN' ? `Latest model assessment: ${area.riskLevel} risk${Number.isFinite(Number(area.riskProbability)) ? ` · ${(Number(area.riskProbability) * 100).toFixed(1)}% model probability (not validated)` : ''}` : 'No saved model assessment for this site yet',
        area.riskPredictedAt ? `Model run: ${new Date(area.riskPredictedAt).toLocaleString()}` : '',
        '<button type="button" class="map-model-link">Run flood risk model</button>',
      ].filter(Boolean).join('<br>');
      const marker = window.L.marker(coordinates, { icon }).bindPopup(details, { closeButton: false, offset: [0, -8] });
      marker.on('popupopen', ({ popup }) => {
        popup.getElement()?.querySelector('.map-model-link')?.addEventListener('click', () => onRunModel?.(area.name));
      });
      marker.on('click', () => {
        if (selectedMarkerRef.current?._icon) selectedMarkerRef.current._icon.classList.remove('airbnb-map-marker-selected');
        selectedMarkerRef.current = marker;
        marker._icon?.classList.add('airbnb-map-marker-selected');
      });
      marker.on('popupclose', () => {
        if (selectedMarkerRef.current === marker) {
          marker._icon?.classList.remove('airbnb-map-marker-selected');
          selectedMarkerRef.current = null;
        }
      });
      marker.addTo(map);
      return [marker];
    });
    selectedMarkerRef.current = null;
    if (markersRef.current.length) {
      map.fitBounds(window.L.featureGroup(markersRef.current).getBounds(), { padding: [38, 38], maxZoom: 13 });
    }
  }, [areas]);

  return <div ref={elementRef} class="real-map" aria-label="Interactive Nairobi flood monitoring map" />;
}
