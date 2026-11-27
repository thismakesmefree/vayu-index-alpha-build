import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ArrowUpRight, MapPin, Search } from 'lucide-react';
import {
  aqiBand,
  formatLocation,
  searchLocations,
  type WeatherLocation,
  type WeatherSnapshot,
} from '../utils/weather';

interface MapViewProps {
  snapshot: WeatherSnapshot;
  theme: 'dark' | 'light';
}

function mapPin(letter: string, color: string): L.DivIcon {
  return L.divIcon({
    className: 'vayu-map-pin',
    html: `<span style="--pin-color:${color}"><b>${letter}</b></span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 38],
  });
}

function MapClickHandler({ onPick }: { onPick: (point: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

export default function MapView({ snapshot, theme }: MapViewProps) {
  const [destination, setDestination] = useState<[number, number]>([
    snapshot.location.latitude + 0.035,
    snapshot.location.longitude + 0.035,
  ]);
  const [destinationName, setDestinationName] = useState('Choose a destination');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [searchError, setSearchError] = useState('');
  const [clickToPlace, setClickToPlace] = useState(false);

  useEffect(() => {
    setDestination([snapshot.location.latitude + 0.035, snapshot.location.longitude + 0.035]);
    setDestinationName('Choose a destination');
  }, [snapshot.location.id, snapshot.location.latitude, snapshot.location.longitude]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError('');
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchLocations(trimmed, controller.signal)
        .then((locations) => {
          setResults(locations.slice(0, 5));
          setSearchError(locations.length ? '' : 'No matching places. Try a nearby city or coordinates.');
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setResults([]);
            setSearchError(error instanceof Error ? error.message : 'Location search failed.');
          }
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const aqi = snapshot.air?.usAqi ?? null;
  const band = aqiBand(aqi);
  const distanceKm = useMemo(() => {
    const [lat1, lon1] = [snapshot.location.latitude, snapshot.location.longitude];
    const [lat2, lon2] = destination;
    const rad = Math.PI / 180;
    const a =
      Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [snapshot.location.latitude, snapshot.location.longitude, destination]);
  const directionsUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${snapshot.location.latitude}%2C${snapshot.location.longitude}%3B${destination[0]}%2C${destination[1]}`;

  const selectDestination = (location: WeatherLocation) => {
    setDestination([location.latitude, location.longitude]);
    setDestinationName(formatLocation(location));
    setQuery('');
    setResults([]);
    setSearchError('');
    setClickToPlace(false);
  };

  return (
    <section className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Local air + weather</p>
          <h1>Atmospheric map</h1>
          <p className="muted">Explore your current conditions and set a destination for an external route.</p>
        </div>
        <div className="map-status">
          <span className="status-dot" style={{ backgroundColor: band.color }} />
          <span>{aqi === null ? 'AQI unavailable' : `US AQI ${aqi} · ${band.label}`}</span>
        </div>
      </header>

      <div className="map-layout">
        <div className={`map-frame ${theme}`}>
          <MapContainer
            key={`${snapshot.location.latitude}-${snapshot.location.longitude}`}
            center={[snapshot.location.latitude, snapshot.location.longitude]}
            zoom={11}
            scrollWheelZoom
            className="weather-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler
              onPick={(point) => {
                if (!clickToPlace) return;
                setDestination(point);
                setDestinationName(`${point[0].toFixed(3)}°, ${point[1].toFixed(3)}°`);
                setClickToPlace(false);
              }}
            />
            <CircleMarker
              center={[snapshot.location.latitude, snapshot.location.longitude]}
              radius={24}
              pathOptions={{ color: band.color, fillColor: band.color, fillOpacity: 0.2, weight: 2 }}
            />
            <Marker
              position={[snapshot.location.latitude, snapshot.location.longitude]}
              icon={mapPin('A', '#16b9c9')}
            />
            <Marker position={destination} icon={mapPin('B', '#9c87ff')} />
            <Polyline
              positions={[
                [snapshot.location.latitude, snapshot.location.longitude],
                destination,
              ]}
              pathOptions={{ color: '#16b9c9', dashArray: '7 9', opacity: 0.7, weight: 3 }}
            />
          </MapContainer>
          {clickToPlace && (
            <div className="map-pick-note" role="status" aria-live="polite">
              Tap the map to place destination B. You can also enter coordinates below.
            </div>
          )}
          <div className="map-caption">
            <span className="map-legend"><i style={{ backgroundColor: band.color }} /> Current AQI</span>
            <span>Weather reading at A · route line is a direct-distance preview</span>
          </div>
        </div>

        <aside className="map-sidebar glass-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Journey planner</p>
              <h2>Start with the map</h2>
            </div>
            <MapPin size={19} />
          </div>
          <div className="route-point">
            <span className="route-letter start">A</span>
            <div><small>Starting point</small><strong>{formatLocation(snapshot.location)}</strong></div>
          </div>
          <div className="route-connector" />
          <div className="route-point">
            <span className="route-letter end">B</span>
            <div><small>Destination</small><strong aria-live="polite">{destinationName}</strong></div>
          </div>

          <label className="field-label" htmlFor="map-destination">Find a destination</label>
          <p className="service-note" id="map-destination-help">
            Enter a city or latitude, longitude. Coordinate search also works without using the map.
          </p>
          <div className="search-field compact">
            <Search size={16} aria-hidden="true" />
            <input
              id="map-destination"
              aria-describedby="map-destination-help"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="City or latitude, longitude"
              autoComplete="off"
            />
          </div>
          {results.length > 0 && (
            <ul className="search-results map-results">
              {results.map((location) => (
                <li key={location.id}>
                  <button type="button" onClick={() => selectDestination(location)}>
                    <span>{formatLocation(location)}</span>
                    <small>{location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchError && <p className="field-message" role="status">{searchError}</p>}

          <button
            className={`button button-secondary full-width ${clickToPlace ? 'is-selected' : ''}`}
            type="button"
            aria-pressed={clickToPlace}
            onClick={() => setClickToPlace((value) => !value)}
          >
            <MapPin size={16} /> {clickToPlace ? 'Cancel map selection' : 'Choose on map'}
          </button>

          <div className="distance-card">
            <span>Direct distance</span>
            <strong>{distanceKm.toFixed(1)} <small>km</small></strong>
            <p>This is not a road distance or air-quality route comparison.</p>
          </div>
          <a className="button button-primary full-width" href={directionsUrl} target="_blank" rel="noreferrer">
            Open directions in OpenStreetMap <ArrowUpRight size={16} />
          </a>
          <p className="service-note">
            Map tiles and turn-by-turn directions load from OpenStreetMap in your browser. Tile availability follows the public service policy.
          </p>
        </aside>
      </div>
    </section>
  );
}
