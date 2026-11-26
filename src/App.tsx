import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Check,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cpu,
  Download,
  Droplets,
  Eye,
  Gauge,
  LayoutDashboard,
  LocateFixed,
  MapPin,
  Moon,
  RectangleHorizontal,
  RectangleVertical,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import AtmosphericBackground from './components/AtmosphericBackground';
import MapView from './components/MapView';
import {
  aqiBand,
  fetchWeather,
  formatLocation,
  searchLocations,
  weatherDescription,
  type WeatherLocation,
  type WeatherSnapshot,
} from './utils/weather';
import type {
  LocalWeatherAssistantEvent,
  LocalWeatherAssistantRequest,
} from './utils/localWeatherAssistant';

type View = 'dashboard' | 'map' | 'coach' | 'history' | 'settings';
type Theme = 'dark' | 'light';

const LOCATION_KEY = 'vayu.location.v1';
const SNAPSHOT_KEY = 'vayu.weather.snapshot.v3';
const THEME_KEY = 'vayu.theme.v1';
const DOCK_ORIENTATION_KEY = 'vayu.dock.orientation.v1';
const DEFAULT_LOCATION: WeatherLocation = {
  id: 'tokyo-default',
  name: 'Tokyo',
  admin1: 'Tokyo',
  country: 'Japan',
  latitude: 35.6762,
  longitude: 139.6503,
};

const navigation: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'coach', label: 'Weather coach', icon: Sparkles },
  { id: 'map', label: 'Air map', icon: MapPin },
  { id: 'history', label: 'Trends', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('Vayu Index could not save local preferences:', error);
  }
}

function isWeatherLocation(value: unknown): value is WeatherLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as Partial<WeatherLocation>;
  return (
    typeof location.id === 'string' &&
    typeof location.name === 'string' &&
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  );
}

function readStoredLocation(): WeatherLocation | null {
  try {
    const raw = readStorage(LOCATION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isWeatherLocation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readStoredSnapshot(): WeatherSnapshot | null {
  try {
    const raw = readStorage(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const snapshot = parsed as Partial<WeatherSnapshot>;
    return isWeatherLocation(snapshot.location) &&
      snapshot.current !== undefined &&
      snapshot.air !== undefined &&
      Array.isArray(snapshot.hourly) &&
      Array.isArray(snapshot.daily)
      ? snapshot as WeatherSnapshot
      : null;
  } catch {
    return null;
  }
}

function IconForWeather({ code, size = 22 }: { code: number; size?: number }) {
  if (code === 0 || code === 1) return <Sun size={size} />;
  if (code === 2) return <CloudSun size={size} />;
  if (code === 3) return <Cloud size={size} />;
  if (code === 45 || code === 48) return <CloudFog size={size} />;
  if (code >= 51 && code <= 57) return <CloudDrizzle size={size} />;
  if (code >= 61 && code <= 67) return <CloudRain size={size} />;
  if (code >= 71 && code <= 77) return <CloudSnow size={size} />;
  if (code >= 80 && code <= 82) return <CloudRain size={size} />;
  if (code >= 95) return <CloudLightning size={size} />;
  return <CloudSun size={size} />;
}

function SearchBox({
  onChoose,
  onLocate,
  compact = false,
}: {
  onChoose: (location: WeatherLocation) => void;
  onLocate: () => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setResults([]);
      setMessage('');
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const matches = await searchLocations(value, controller.signal);
        setResults(matches);
        setMessage(matches.length ? '' : 'No matches. Try another city or coordinates.');
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
          setMessage(error instanceof Error ? error.message : 'Location search failed.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className={`location-search ${compact ? 'compact-search' : ''}`}>
      <label className="search-field">
        <Search size={17} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a city or coordinates"
          aria-label="Search a city or coordinates"
          autoComplete="off"
        />
        {searching && <span className="search-spinner" aria-label="Searching" />}
      </label>
      {message && <p className="field-message" role="status">{message}</p>}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((location) => (
            <li key={location.id}>
              <button
                type="button"
                onClick={() => {
                  onChoose(location);
                  setQuery('');
                  setResults([]);
                  setMessage('');
                }}
              >
                <MapPin size={15} aria-hidden="true" />
                <span>{formatLocation(location)}</span>
                <small>{location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!compact && (
        <button className="text-button locate-button" type="button" onClick={onLocate}>
          <LocateFixed size={15} /> Use my location
        </button>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tint = 'cyan',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tint?: string;
}) {
  return (
    <article className="glass-card stat-card">
      <div className={`stat-icon ${tint}`}><Icon size={18} /></div>
      <div className="stat-copy">
        <span className="muted">{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function Sparkline({ values, color }: { values: Array<number | null>; color: string }) {
  const data = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const min = data.length ? Math.min(...data) : 0;
  const range = data.length ? Math.max(...data) - min : 0;
  const paths: string[] = [];
  const dots: Array<{ x: number; y: number }> = [];
  let segment: string[] = [];
  const finishSegment = () => {
    if (segment.length > 1) paths.push(segment.join(' '));
    else if (segment.length === 1) {
      const [x, y] = segment[0].split(',').map(Number);
      dots.push({ x, y });
    }
    segment = [];
  };

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      finishSegment();
      return;
    }
    const x = (index / Math.max(1, values.length - 1)) * 120;
    const y = range === 0 ? 17 : 28 - ((value - min) / range) * 22;
    segment.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  finishSegment();

  return (
    <svg className="pollutant-sparkline" viewBox="0 0 120 32" aria-hidden="true">
      {paths.map((points, index) => (
        <polyline
          key={`segment-${index}`}
          className="sparkline-trace"
          points={points}
          pathLength={1}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {dots.map(({ x, y }, index) => (
        <circle key={`point-${index}`} className="sparkline-dot" cx={x} cy={y} r="2" fill={color} />
      ))}
    </svg>
  );
}

function cardinalDirection(degrees: number): string {
  return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][
    Math.round(degrees / 22.5) % 16
  ];
}

function dewPointC(temperature: number, humidity: number): number {
  const safeHumidity = Math.max(1, Math.min(100, humidity)) / 100;
  const gamma = Math.log(safeHumidity) + (17.625 * temperature) / (243.04 + temperature);
  return (243.04 * gamma) / (17.625 - gamma);
}

function daylightDuration(sunrise: string, sunset: string): string {
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  if (sunrise === '--:--' || sunset === '--:--') return '—';
  const duration = Math.max(0, toMinutes(sunset) - toMinutes(sunrise));
  return `${Math.floor(duration / 60)}.${Math.round((duration % 60) / 6)}h`;
}

function WeatherSummary({
  snapshot,
  loading,
  onRefresh,
  onChooseLocation,
  onLocate,
  onNavigate,
}: {
  snapshot: WeatherSnapshot;
  loading: boolean;
  onRefresh: () => void;
  onChooseLocation: (location: WeatherLocation) => void;
  onLocate: () => void;
  onNavigate: (view: View) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { current, air } = snapshot;
  const band = aqiBand(air?.usAqi ?? null);
  const firstDay = snapshot.daily[0];
  const firstHour = snapshot.hourly[0];
  const boundaryLayerHeight = firstHour?.boundaryLayerHeightM ?? null;
  const soilMoisture = firstHour?.soilMoisture3To9cm ?? null;
  const aerosolSummary = air?.aerosolOpticalDepth == null
    ? 'AOD —'
    : `AOD ${air.aerosolOpticalDepth.toFixed(2)}`;
  const dustSummary = air?.dustUgM3 == null
    ? 'Dust —'
    : `Dust ${air.dustUgM3.toFixed(1)} µg/m³`;

  useEffect(() => {
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) return;
    const revealItems = Array.from(
      document.querySelectorAll<HTMLElement>('.weather-dashboard .dashboard-reveal')
    );
    if (!revealItems.length) return;
    revealItems.forEach((element) => element.classList.add('dashboard-reveal-pending'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('dashboard-revealed');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '-28px 0px -28px 0px' }
    );
    revealItems.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [snapshot.location.id]);

  const pollutants = [
    { name: 'PM2.5', value: air?.pm25 ?? null, unit: 'µg/m³', reference: 15, key: 'pm25' as const },
    { name: 'PM10', value: air?.pm10 ?? null, unit: 'µg/m³', reference: 45, key: 'pm10' as const },
    { name: 'NO₂', value: air?.nitrogenDioxide ?? null, unit: 'µg/m³', reference: 25, key: 'nitrogenDioxide' as const },
    { name: 'O₃', value: air?.ozone ?? null, unit: 'µg/m³', reference: 100, key: 'ozone' as const },
    { name: 'SO₂', value: air?.sulphurDioxide ?? null, unit: 'µg/m³', reference: 40, key: 'sulphurDioxide' as const },
    { name: 'CO', value: air?.carbonMonoxide == null ? null : air.carbonMonoxide / 1000, unit: 'mg/m³', reference: 4, key: 'carbonMonoxide' as const },
  ];
  const dominant = pollutants
    .filter((pollutant) => pollutant.value !== null)
    .sort((a, b) => (b.value! / b.reference) - (a.value! / a.reference))[0];
  const sunrise = firstDay?.sunrise ?? '--:--';
  const sunset = firstDay?.sunset ?? '--:--';
  const metricCards = [
    { label: 'Temperature', value: `${current.temperatureC.toFixed(1)}°C`, detail: `Feels ${current.feelsLikeC.toFixed(1)}°C`, icon: Thermometer },
    { label: 'Humidity & Dew Pt', value: `${Math.round(current.humidityPercent)}%`, detail: `Dew pt approx. ${dewPointC(current.temperatureC, current.humidityPercent).toFixed(1)}°C`, icon: Droplets },
    { label: 'Wind & Gusts', value: `${current.windKmh.toFixed(1)} km/h ${cardinalDirection(current.windDirection)}`, detail: `Gusts ${current.windGustKmh.toFixed(1)} km/h · ${Math.round(current.windDirection)}°`, icon: Wind },
    { label: 'Barometric Pressure', value: `${Math.round(current.pressureHpa)} hPa`, detail: `Elevation ${Math.round(snapshot.elevationM)} m`, icon: Gauge },
    { label: 'Precipitation', value: `${current.precipitationMm.toFixed(1)} mm`, detail: `Forecast chance ${Math.round(snapshot.hourly[0]?.precipitationProbability ?? 0)}%`, icon: CloudRain },
    { label: 'Cloud & Visibility', value: `${Math.round(current.cloudCoverPercent)}% · ${current.visibilityKm.toFixed(1)} km`, detail: 'Cloud cover · estimated visibility', icon: Cloud },
    { label: 'UV & Solar Flux', value: `UV ${current.uvIndex.toFixed(1)} · ${Math.round(current.solarRadiationWm2)} W/m²`, detail: `Peak UV today ${firstDay?.uvIndexMax?.toFixed(1) ?? '—'}`, icon: Sun },
    {
      label: 'Dispersion & Soil/PBL',
      value: [
        boundaryLayerHeight == null ? null : `PBL ${(boundaryLayerHeight / 1000).toFixed(2)} km`,
        soilMoisture == null ? null : `VWC ${(soilMoisture * 100).toFixed(0)}%`,
      ].filter(Boolean).join(' · ') || 'Unavailable',
      detail: 'Boundary-layer height · 3–9 cm soil VWC (model estimates)',
      icon: Wind,
    },
  ];
  const maxHourlyAqi = Math.max(50, ...snapshot.hourly.map((hour) => hour.usAqi ?? 0));
  const observedLabel = snapshot.observedAt.replace('T', ' ');
  const locationDetail = [snapshot.location.admin1, snapshot.location.country].filter(Boolean).join(', ');

  return (
    <div className="page-stack weather-dashboard">
      <header className="dashboard-location">
        <div className="dashboard-location-copy">
          <div className="dashboard-city-line">
            <h1>{snapshot.location.name}</h1>
            {locationDetail && <span>{locationDetail}</span>}
          </div>
          <p className="location-meta">
            <span>{snapshot.location.latitude.toFixed(3)}°, {snapshot.location.longitude.toFixed(3)}°</span>
            <span aria-hidden="true">·</span>
            <span>Elev {Math.round(snapshot.elevationM)} m</span>
            <span aria-hidden="true">·</span>
            <span>{snapshot.timezone.replaceAll('_', ' ')}</span>
            <span aria-hidden="true">·</span>
            <span>Live · {observedLabel}</span>
          </p>
        </div>
        <div className="dashboard-location-actions">
          <button type="button" className="control-button" onClick={() => setSearchOpen((open) => !open)}>
            <MapPin size={14} /> {searchOpen ? 'Close Search' : 'Change Location'}
          </button>
          <button type="button" className="control-button" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinning' : ''} /> {loading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      {searchOpen && (
        <div className="dashboard-search">
          <SearchBox onChoose={(location) => { onChooseLocation(location); setSearchOpen(false); }} onLocate={onLocate} />
        </div>
      )}

      <section className="dashboard-overview-grid">
        <div className="dashboard-left-stack">
          <article className="glass-card dashboard-aqi-card dashboard-reveal">
            <div className="aqi-card-heading">
              <span>{weatherDescription(current.weatherCode)} · {current.temperatureC.toFixed(1)}°C</span>
              <span style={{ color: band.color }}>{band.label}</span>
            </div>
            <div className="aqi-dial">
              <svg viewBox="0 0 220 200" role="img" aria-label={`US AQI ${air?.usAqi ?? 'unavailable'}`}>
                <defs>
                  <filter id="aqi-dial-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <circle cx="110" cy="110" r="98" className="aqi-dial-ticks" />
                <circle cx="110" cy="110" r="84" className="aqi-dial-track" />
                {air?.usAqi != null && (
                  <>
                    <circle
                      cx="110"
                      cy="110"
                      r="84"
                      className="aqi-dial-value"
                      style={{ stroke: band.color }}
                      strokeDasharray={`${2 * Math.PI * 84 * 0.75 * Math.min(1, air.usAqi / 350)} ${2 * Math.PI * 84}`}
                      filter="url(#aqi-dial-glow)"
                    />
                    <circle
                      cx={110 + 84 * Math.cos(((135 + 270 * Math.min(1, air.usAqi / 350)) * Math.PI) / 180)}
                      cy={110 + 84 * Math.sin(((135 + 270 * Math.min(1, air.usAqi / 350)) * Math.PI) / 180)}
                      r="5.5"
                      className="aqi-dial-head"
                    />
                  </>
                )}
              </svg>
              <div className="aqi-dial-label">
                <span>US AQI</span>
                <strong>{air?.usAqi ?? '—'}</strong>
                <b style={{ color: band.color }}>{band.label}</b>
              </div>
            </div>
            <div className="aqi-stat-row">
              <div><span>EU AQI</span><strong>{air?.europeanAqi ?? '—'}</strong></div>
              <div><span>Dominant</span><strong className="cyan-text">{dominant?.name ?? '—'}</strong></div>
              <div><span>PM2.5</span><strong>{air?.pm25?.toFixed(1) ?? '—'}</strong></div>
            </div>
            <div className="sun-stat-row">
              <div><span><Sunrise size={12} /> Sunrise</span><strong>{sunrise}</strong></div>
              <div><span><Sunset size={12} /> Sunset</span><strong>{sunset}</strong></div>
              <div><span><Eye size={12} /> Daylight</span><strong>{daylightDuration(sunrise, sunset)}</strong></div>
            </div>
          </article>

          <article className="glass-card coach-summary-card dashboard-reveal">
            <div className="coach-summary-heading">
              <h2>On-device Weather Coach</h2>
              <span>PRIVATE · NO ACCOUNT</span>
            </div>
            <p>
              Get a private weather-aware suggestion for {snapshot.location.name} from a free model running in your browser.
            </p>
            <div className="coach-summary-actions">
              <button type="button" className="coach-primary-button" onClick={() => onNavigate('coach')}>
                <Sparkles size={14} /> Open Weather Coach
              </button>
              <button type="button" className="coach-secondary-button" onClick={() => onNavigate('map')}>
                Open Map <ArrowUpRight size={14} />
              </button>
            </div>
          </article>
        </div>

        <div className="dashboard-right-stack">
          <article className="glass-card meteorology-card dashboard-reveal">
            <div className="reference-section-heading">
              <h2>Complete Meteorological &amp; Boundary-Layer Suite</h2>
              <span className="air-quality-summary">{aerosolSummary} · {dustSummary}</span>
            </div>
            <div className="meteorology-grid">
              {metricCards.map(({ label, value, detail, icon: Icon }, index) => (
                <div className="meteorology-tile dashboard-reveal" key={label} style={{ '--card-index': index } as CSSProperties}>
                  <div><span>{label}</span><Icon size={14} /></div>
                  <strong>{value}</strong>
                  <small>{detail}</small>
                </div>
              ))}
            </div>
          </article>

          <section className="pollutant-cards-grid" aria-label="Current pollutant readings">
            {pollutants.map((pollutant, index) => {
              const series = snapshot.hourly.map((hour) => {
                const value = hour[pollutant.key];
                return pollutant.key === 'carbonMonoxide' && value !== null ? value / 1000 : value;
              });
              const status = pollutant.value === null
                ? { label: 'Unavailable', color: '#64748b' }
                : pollutant.value <= pollutant.reference
                  ? { label: 'Within reference', color: '#00d6a2' }
                  : { label: 'Above reference', color: '#f5b322' };
              const first = series[0] ?? null;
              const sixHoursAhead = series[2] ?? null;
              const change = first !== null && sixHoursAhead !== null && first !== 0
                ? Math.round(((sixHoursAhead - first) / first) * 100)
                : null;
              return (
                <article className="glass-card pollutant-card dashboard-reveal" key={pollutant.name} style={{ '--card-index': index } as CSSProperties}>
                  <div className="pollutant-card-heading"><strong>{pollutant.name}</strong><span style={{ color: status.color }}>{status.label}</span></div>
                  <div className="pollutant-value-row">
                    <strong>{pollutant.value === null ? '—' : pollutant.value.toFixed(1)}</strong>
                    <span>{pollutant.unit}</span>
                  </div>
                  <Sparkline values={series} color={status.color} />
                  <div className="pollutant-meta">
                    <span>Ref {pollutant.reference} {pollutant.unit}</span>
                    <span className={change !== null && change > 0 ? 'trend-up' : 'trend-down'}>
                      {change === null ? '—' : `${change > 0 ? '+' : ''}${change}% next 6h`}
                    </span>
                  </div>
                </article>
              );
            })}
          </section>
          <p className="dashboard-source-note">Pollutant figures are Open-Meteo model estimates. Reference comparisons are informational, not health thresholds.</p>
        </div>
      </section>

      <section className="dashboard-forecast-grid">
        <article className="glass-card forecast-timeline-card dashboard-reveal">
          <h2>24-Hour AQI, Temperature &amp; Precip Forecast</h2>
          <p>Air-quality forecast paired with temperature and rain chance</p>
          <div className="forecast-bars">
            {snapshot.hourly.map((hour, index) => {
              const value = hour.usAqi;
              const height = value === null ? 16 : Math.max(18, Math.round((value / maxHourlyAqi) * 100));
              const hourBand = aqiBand(value);
              return (
                <div className="forecast-bar-column" key={`${hour.time}-${index}`}>
                  <strong>{value ?? '—'}</strong>
                  <div className="forecast-bar-track">
                    <i style={{ height: `${height}%`, background: value === null ? 'linear-gradient(180deg,#38bdf8,rgba(56,189,248,.25))' : `linear-gradient(180deg,${hourBand.color},rgba(148,163,184,.16))` }} />
                  </div>
                  <span>{hour.temperatureC.toFixed(1)}° · {Math.round(hour.precipitationProbability)}%</span>
                  <small>{index === 0 ? 'Now' : hour.time}</small>
                </div>
              );
            })}
          </div>
        </article>

        <article className="glass-card week-outlook-card dashboard-reveal">
          <h2>7-Day Weather &amp; UV Outlook</h2>
          <p>Daily temperatures, rain probability and peak UV</p>
          <div className="week-outlook-list">
            {snapshot.daily.map((day, index) => (
              <div className="week-outlook-row" key={day.date}>
                <strong>{index === 0 ? 'Today' : new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</strong>
                <IconForWeather code={day.weatherCode} size={15} />
                <span>{weatherDescription(day.weatherCode)}</span>
                <small>{Math.round(day.precipitationProbability)}%</small>
                <small>UV {day.uvIndexMax?.toFixed(1) ?? '—'}</small>
                <b>{Math.round(day.temperatureMinC)}° / {Math.round(day.temperatureMaxC)}°</b>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function HistoryView({ snapshot }: { snapshot: WeatherSnapshot }) {
  const history = snapshot.aqiHistory;
  const values = history.map((day) => day.average);
  const max = Math.max(100, ...values);
  const points = history.map((day, index) => {
    const x = history.length <= 1 ? 300 : 32 + (index / (history.length - 1)) * 536;
    const y = 172 - (day.average / max) * 132;
    return { day, x, y };
  });
  const pointList = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = points.length
    ? `32,174 ${pointList} ${points[points.length - 1].x},174`
    : '';

  return (
    <section className="page-stack">
      <header className="page-heading">
        <div><p className="eyebrow">Recent conditions</p><h1>Air-quality trends</h1><p className="muted">{formatLocation(snapshot.location)} · hourly US AQI averages</p></div>
      </header>
      <article className="glass-card chart-card">
        <div className="section-title-row">
          <div><p className="eyebrow">Past 7 days</p><h2>Daily AQI trend</h2></div>
          <div className="chart-legend"><i /> Daily mean <span>Peak values shown on hover</span></div>
        </div>
        {history.length ? (
          <div className="chart-wrap">
            <svg viewBox="0 0 600 210" role="img" aria-label="Seven day average AQI chart">
              {[0, 1, 2, 3].map((step) => <line key={step} x1="30" x2="570" y1={36 + step * 44} y2={36 + step * 44} className="chart-grid" />)}
              <polygon points={area} className="chart-area" />
              <polyline points={pointList} className="chart-line" />
              {points.map(({ day, x, y }) => {
                const color = aqiBand(day.average).color;
                return (
                  <g key={day.date}>
                    <title>{day.date}: average {day.average}, peak {day.peak} AQI</title>
                    <circle cx={x} cy={y} r="5" fill={color} className="chart-point" />
                    <text x={x} y="199" textAnchor="middle" className="chart-label">
                      {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
                    </text>
                    <text x={x} y={y - 11} textAnchor="middle" className="chart-value">{day.average}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="empty-chart"><Activity size={24} /><p>Recent AQI history is not available for this place.</p></div>
        )}
        <p className="service-note">Historical readings are supplied by Open-Meteo’s air-quality forecast model; coverage and completeness vary by region.</p>
      </article>
      <div className="metric-grid two">
        <StatCard icon={Activity} label="Current US AQI" value={snapshot.air?.usAqi?.toString() ?? 'Unavailable'} detail={aqiBand(snapshot.air?.usAqi ?? null).label} />
        <StatCard icon={Wind} label="Current PM2.5" value={snapshot.air?.pm25 == null ? 'Unavailable' : `${snapshot.air.pm25.toFixed(1)} µg/m³`} detail="Model estimate at selected coordinates" tint="violet" />
      </div>
    </section>
  );
}

function CoachView({ snapshot }: { snapshot: WeatherSnapshot }) {
  const workerRef = useRef<Worker | null>(null);
  const [question, setQuestion] = useState(
    'Give me practical advice for outdoor activities and commuting today.'
  );
  const [assistantStatus, setAssistantStatus] = useState<
    'idle' | 'loading' | 'generating' | 'ready' | 'error'
  >('idle');
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [assistantError, setAssistantError] = useState('');
  const band = aqiBand(snapshot.air?.usAqi ?? null);
  const weatherContext = useMemo(
    () => [
      `Location: ${formatLocation(snapshot.location)}.`,
      `Observed at ${snapshot.observedAt} (${snapshot.timezone}).`,
      `Weather: ${snapshot.current.temperatureC.toFixed(1)}°C, feels like ${snapshot.current.feelsLikeC.toFixed(1)}°C, ${weatherDescription(snapshot.current.weatherCode).toLowerCase()}, ${snapshot.current.humidityPercent}% humidity, ${snapshot.current.windKmh.toFixed(1)} km/h wind, ${snapshot.current.precipitationMm.toFixed(1)} mm precipitation, ${Math.round(snapshot.current.uvIndex)} UV.`,
      snapshot.air?.usAqi == null
        ? 'Air quality: current AQI data is unavailable.'
        : `Air quality model estimate: US AQI ${snapshot.air.usAqi} (${band.label}), PM2.5 ${snapshot.air.pm25?.toFixed(1) ?? 'unavailable'} µg/m³, PM10 ${snapshot.air.pm10?.toFixed(1) ?? 'unavailable'} µg/m³.`,
      snapshot.hourly[0]?.precipitationProbability == null
        ? 'Forecast rain probability: unavailable.'
        : `Forecast rain probability: ${Math.round(snapshot.hourly[0].precipitationProbability)}%.`,
    ].join('\n'),
    [snapshot, band.label]
  );
  const airQualitySafetyNote = snapshot.air?.usAqi != null && snapshot.air.usAqi >= 151
    ? `Air-quality note: US AQI ${snapshot.air.usAqi} is ${band.label}. Consider reducing prolonged or strenuous outdoor activity and follow official local guidance.`
    : null;

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    []
  );

  const createWorker = () => {
    const worker = new Worker(new URL('./workers/localWeatherAssistant.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = ({ data }: MessageEvent<LocalWeatherAssistantEvent>) => {
      if (data.type === 'phase') {
        setAssistantStatus(data.phase);
        setStatusMessage(data.message);
      } else if (data.type === 'progress') {
        setModelProgress(data.progress);
        setStatusMessage(data.progress === null
          ? `Preparing ${data.file}…`
          : `Downloading ${data.file} · ${Math.round(data.progress)}%`);
      } else if (data.type === 'answer') {
        setAssistantAnswer(data.answer);
        setAssistantStatus('ready');
        setModelProgress(100);
        setStatusMessage('Generated locally on your device.');
      } else {
        setAssistantError(data.message);
        setAssistantStatus('error');
      }
    };
    worker.onerror = (event) => {
      setAssistantError(event.message || 'The local AI worker stopped unexpectedly.');
      setAssistantStatus('error');
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
    workerRef.current = worker;
    return worker;
  };

  const generateAdvice = () => {
    setAssistantError('');
    setAssistantAnswer('');
    setModelProgress(null);
    setAssistantStatus('loading');
    setStatusMessage('Starting the on-device model…');
    try {
      const worker = workerRef.current ?? createWorker();
      const request: LocalWeatherAssistantRequest = {
        type: 'generate',
        weatherContext,
        question,
      };
      worker.postMessage(request);
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : String(error));
      setAssistantStatus('error');
    }
  };

  const cancelGeneration = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setAssistantStatus('idle');
    setModelProgress(null);
    setStatusMessage('Generation cancelled.');
  };

  return (
    <section className="page-stack">
      <header className="page-heading">
        <div><p className="eyebrow">Private on-device assistant</p><h1>Weather coach</h1><p className="muted">Free, open-weight AI that runs in your browser—no sign-in or AI API key.</p></div>
      </header>
      <article className="coach-hero">
        <div className="coach-orb"><Cpu size={25} /></div>
        <div>
          <p className="eyebrow">Runs locally on this device</p>
          <h2>Private weather-aware guidance</h2>
          <p>The SmolLM2 360M instruction model downloads on first use (about 400 MB) and is cached by your browser. Generation runs on your device; your question and weather context are not sent to an AI service. A compatible GPU is used when available, otherwise it falls back to CPU.</p>
        </div>
      </article>
      <article className="glass-card local-coach-card">
        <div className="section-title-row">
          <div><p className="eyebrow">Model: SmolLM2 360M · Apache 2.0</p><h2>{formatLocation(snapshot.location)}</h2></div>
          <span className="prompt-aqi" style={{ color: band.color }}>AQI {snapshot.air?.usAqi ?? '—'}</span>
        </div>
        <label className="prompt-label" htmlFor="weather-question">What would you like help planning?</label>
        <textarea
          id="weather-question"
          className="weather-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          aria-label="Question for the local weather coach"
          maxLength={500}
        />
        <p className="service-note">Advice is generated from the weather snapshot above. It may be inaccurate and is not medical or emergency guidance.</p>
        <div className="weather-context-summary" aria-label="Weather data sent to the local model">
          <span>{snapshot.current.temperatureC.toFixed(1)}°C · {weatherDescription(snapshot.current.weatherCode)}</span>
          <span>Rain {Math.round(snapshot.hourly[0]?.precipitationProbability ?? 0)}%</span>
          <span>US AQI {snapshot.air?.usAqi ?? 'unavailable'} · {band.label}</span>
        </div>
        {assistantStatus === 'loading' && (
          <div className="model-progress" role="status" aria-live="polite">
            <div className="model-progress-label"><span>{statusMessage}</span>{modelProgress !== null && <strong>{Math.round(modelProgress)}%</strong>}</div>
            <progress value={modelProgress ?? undefined} max={100} aria-label="Local AI model download progress" />
          </div>
        )}
        {assistantStatus === 'generating' && <p className="model-status" role="status" aria-live="polite">{statusMessage}</p>}
        {assistantError && <p className="field-message" role="alert">Local AI could not generate advice: {assistantError}</p>}
        {assistantAnswer && (
          <section className="local-coach-answer" aria-live="polite">
            <h3>Weather-aware guidance</h3>
            <p>{assistantAnswer}</p>
          </section>
        )}
        {assistantAnswer && airQualitySafetyNote && (
          <p className="air-quality-safety-note" role="note">{airQualitySafetyNote}</p>
        )}
        <div className="prompt-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={generateAdvice}
            disabled={assistantStatus === 'loading' || assistantStatus === 'generating'}
          >
            <Sparkles size={16} />
            {assistantStatus === 'loading' ? 'Loading local model…' : assistantStatus === 'generating' ? 'Generating…' : assistantStatus === 'error' ? 'Try again' : assistantStatus === 'ready' ? 'Generate another answer' : 'Generate weather advice'}
          </button>
          {(assistantStatus === 'loading' || assistantStatus === 'generating') && (
            <button type="button" className="button button-secondary" onClick={cancelGeneration}>Cancel</button>
          )}
        </div>
      </article>
    </section>
  );
}

function SettingsView({
  theme,
  onThemeChange,
  onRefresh,
  offline,
}: {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onRefresh: () => void;
  offline: boolean;
}) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installMessage, setInstallMessage] = useState('');

  useEffect(() => {
    const checkStandalone = () => {
      setInstalled(
        window.matchMedia('(display-mode: standalone)').matches ||
          Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
      );
    };
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', checkStandalone);
    checkStandalone();
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', checkStandalone);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setInstallMessage('Use your browser’s menu and choose “Install app” or “Add to Home Screen”. On iPhone/iPad, use Share → Add to Home Screen in Safari.');
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallMessage(choice.outcome === 'accepted' ? 'Vayu Index is being installed.' : 'Installation was dismissed.');
    setInstallPrompt(null);
  };

  return (
    <section className="page-stack">
      <header className="page-heading"><div><p className="eyebrow">Your preferences</p><h1>Settings</h1><p className="muted">Local by design. No account, tracking profile, or API key required.</p></div></header>
      <div className="settings-grid">
        <article className="glass-card settings-card">
          <div className="section-title-row"><div><p className="eyebrow">Appearance</p><h2>Choose your theme</h2></div><Moon size={18} /></div>
          <div className="theme-choices">
            {(['dark', 'light'] as const).map((option) => (
              <button key={option} type="button" className={`theme-choice ${theme === option ? 'selected' : ''}`} onClick={() => onThemeChange(option)}>
                {option === 'dark' ? <Moon size={18} /> : <Sun size={18} />}<span>{option === 'dark' ? 'Midnight' : 'Daylight'}</span>{theme === option && <Check size={16} />}
              </button>
            ))}
          </div>
        </article>
        <article className="glass-card settings-card">
          <div className="section-title-row"><div><p className="eyebrow">Installable app</p><h2>Take Vayu Index with you</h2></div><Activity size={18} /></div>
          <p className="muted">Install the PWA for an app-like window and a cached interface that can reopen offline. Live weather refresh requires a connection.</p>
          <button type="button" className="button button-primary" onClick={install}>{installed ? <Check size={16} /> : <ArrowUpRight size={16} />}{installed ? 'Installed' : 'Install Vayu Index'}</button>
          {installMessage && <p className="field-message" role="status">{installMessage}</p>}
        </article>
        <article className="glass-card settings-card">
          <div className="section-title-row"><div><p className="eyebrow">Data sources</p><h2>Weather & privacy</h2></div><Shield size={18} /></div>
          <ul className="privacy-list">
            <li>Weather and air-quality requests go directly from this browser to Open-Meteo.</li>
            <li>City search uses Open-Meteo geocoding. Selected location and last reading stay in this browser.</li>
            <li>Map tiles use OpenStreetMap. Weather advice uses a cached local model; questions are not sent to an AI service.</li>
            <li>{offline ? 'You are offline. Showing the most recently saved weather snapshot, if available.' : 'You are online. Use refresh to request current conditions.'}</li>
          </ul>
          <button type="button" className="button button-secondary" onClick={onRefresh}><RefreshCw size={15} /> Refresh weather data</button>
        </article>
      </div>
    </section>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [location, setLocation] = useState<WeatherLocation | null>(() => readStoredLocation() ?? DEFAULT_LOCATION);
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(() => {
    const savedLocation = readStoredLocation();
    const savedSnapshot = readStoredSnapshot();
    return savedLocation?.id === savedSnapshot?.location.id ? savedSnapshot : null;
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [theme, setTheme] = useState<Theme>(() => (readStorage(THEME_KEY) === 'light' ? 'light' : 'dark'));
  const [dockOrientation, setDockOrientation] = useState<'vertical' | 'horizontal'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'horizontal';
    return readStorage(DOCK_ORIENTATION_KEY) === 'horizontal' ? 'horizontal' : 'vertical';
  });
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [geoMessage, setGeoMessage] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#08122f' : '#e9eef8');
    writeStorage(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const handleResize = () => {
      if (readStorage(DOCK_ORIENTATION_KEY)) return;
      setDockOrientation(window.innerWidth < 768 ? 'horizontal' : 'vertical');
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, []);

  useEffect(() => {
    if (!location) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    fetchWeather(location, controller.signal)
      .then((fresh) => {
        setSnapshot(fresh);
        writeStorage(SNAPSHOT_KEY, JSON.stringify(fresh));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const cached = readStoredSnapshot();
        if (cached?.location.id === location.id) setSnapshot(cached);
        setLoadError(error instanceof Error ? error.message : 'Weather could not be refreshed.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [location]);

  const selectLocation = (next: WeatherLocation) => {
    setGeoMessage('');
    const cached = readStoredSnapshot();
    setSnapshot(cached?.location.id === next.id ? cached : null);
    setLocation(next);
    writeStorage(LOCATION_KEY, JSON.stringify(next));
    setView('dashboard');
  };

  const locateMe = () => {
    setGeoMessage('');
    if (!navigator.geolocation) {
      setGeoMessage('Location access is unavailable. Search for a city or enter coordinates instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        selectLocation({
          id: `gps-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
          name: 'Current location',
          latitude,
          longitude,
        });
      },
      (error) => {
        setGeoMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Search for a city or enter coordinates instead.'
            : 'Could not determine your location. Search for a city or enter coordinates instead.'
        );
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const retry = () => {
    if (location) setLocation({ ...location });
  };

  const toggleDockOrientation = () => {
    setDockOrientation((orientation) => {
      const next = orientation === 'vertical' ? 'horizontal' : 'vertical';
      writeStorage(DOCK_ORIENTATION_KEY, next);
      return next;
    });
  };

  const renderContent = () => {
    if (!location) {
      return (
        <section className="welcome-panel">
          <div className="welcome-glow" aria-hidden="true" />
          <div className="welcome-mark"><Wind size={28} /></div>
          <p className="eyebrow">A clearer read on your day</p>
          <h1>Weather, with awareness.</h1>
          <p className="welcome-copy">Vayu Index brings local weather and air quality together, so your next decision starts with the conditions around you.</p>
          <div className="welcome-search">
            <SearchBox onChoose={selectLocation} onLocate={locateMe} />
          </div>
          {geoMessage && <p className="field-message" role="alert">{geoMessage}</p>}
          <div className="welcome-note"><Shield size={15} /> No sign-in. Your location stays in this browser.</div>
        </section>
      );
    }

    if (loading && !snapshot) {
      return <div className="loading-panel"><span className="large-spinner" /><h2>Reading local conditions</h2><p>Connecting to Open-Meteo for weather and air-quality data.</p></div>;
    }

    if (!snapshot) {
      return (
        <div className="loading-panel error-panel">
          <Cloud size={28} /><h2>Couldn’t load conditions</h2><p>{loadError || 'Check your connection and try again.'}</p>
          <button className="button button-primary" type="button" onClick={retry}><RefreshCw size={16} /> Try again</button>
        </div>
      );
    }

    switch (view) {
      case 'map':
        return <MapView snapshot={snapshot} theme={theme} />;
      case 'coach':
        return <CoachView snapshot={snapshot} />;
      case 'history':
        return <HistoryView snapshot={snapshot} />;
      case 'settings':
        return <SettingsView theme={theme} onThemeChange={setTheme} onRefresh={retry} offline={!online} />;
      case 'dashboard':
      default:
        return (
          <WeatherSummary
            snapshot={snapshot}
            loading={loading}
            onRefresh={retry}
            onChooseLocation={selectLocation}
            onLocate={locateMe}
            onNavigate={setView}
          />
        );
    }
  };

  const currentLabel = snapshot ? formatLocation(snapshot.location) : 'Choose a location';

  return (
    <div className="app-shell">
      <AtmosphericBackground theme={theme} />
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setView('dashboard')} aria-label="Vayu Index home">
          <span>Vayu Index</span>
        </button>
        <div className="header-location-pill">
          <MapPin size={13} />
          <span className="header-city">{snapshot ? snapshot.location.name : currentLabel}</span>
        </div>
        <div className="header-actions">
          <button type="button" className="header-action-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
          <button type="button" className="header-action-button install-action" onClick={() => setView('settings')}>
            <Download size={14} /> <span>Install App</span>
          </button>
        </div>
      </header>

      {!online && (
        <div className="offline-banner" role="status">
          <span className="online-indicator offline" /> Offline · {snapshot ? 'showing the last saved reading' : 'live weather needs a connection'}
        </div>
      )}
      {loadError && snapshot && (
        <div className="sync-banner" role="status">
          <span>{loadError} Showing your last saved reading.</span>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      )}

      <main className="main-content app-main">{renderContent()}</main>

      <footer className="app-footer">
        <span>Vayu Index</span><span>Weather &amp; air-quality data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></span><span>Not a medical or emergency service</span>
      </footer>

      <nav className={`floating-dock ${dockOrientation}`} aria-label="Primary navigation">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={view === id ? 'active' : ''} onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined} aria-label={label} title={label}>
            <Icon size={19} /><span className="dock-active-dot" />
          </button>
        ))}
        <span className="dock-divider" aria-hidden="true" />
        <button
          type="button"
          className="dock-orientation-button"
          onClick={toggleDockOrientation}
          aria-label={dockOrientation === 'vertical' ? 'Turn bar horizontal' : 'Turn bar vertical'}
          title={dockOrientation === 'vertical' ? 'Turn bar horizontal' : 'Turn bar vertical'}
        >
          {dockOrientation === 'vertical' ? <RectangleHorizontal size={19} /> : <RectangleVertical size={19} />}
        </button>
      </nav>
    </div>
  );
}
