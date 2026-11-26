export interface WeatherLocation {
  id: string;
  name: string;
  admin1?: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface WeatherConditions {
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent: number;
  windKmh: number;
  windDirection: number;
  windGustKmh: number;
  precipitationMm: number;
  pressureHpa: number;
  cloudCoverPercent: number;
  visibilityKm: number;
  uvIndex: number;
  solarRadiationWm2: number;
  weatherCode: number;
  isDay: boolean;
}

export interface AirQuality {
  usAqi: number | null;
  europeanAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  nitrogenDioxide: number | null;
  ozone: number | null;
  sulphurDioxide: number | null;
  carbonMonoxide: number | null;
  aerosolOpticalDepth: number | null;
  dustUgM3: number | null;
}

export interface HourlyForecast {
  time: string;
  temperatureC: number;
  precipitationProbability: number;
  weatherCode: number;
  boundaryLayerHeightM: number | null;
  soilMoisture3To9cm: number | null;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  nitrogenDioxide: number | null;
  ozone: number | null;
  sulphurDioxide: number | null;
  carbonMonoxide: number | null;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  temperatureMaxC: number;
  temperatureMinC: number;
  precipitationProbability: number;
  uvIndexMax: number | null;
  sunrise: string;
  sunset: string;
}

export interface AqiHistoryDay {
  date: string;
  average: number;
  peak: number;
}

export interface WeatherSnapshot {
  location: WeatherLocation;
  timezone: string;
  elevationM: number;
  observedAt: string;
  current: WeatherConditions;
  air: AirQuality | null;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  aqiHistory: AqiHistoryDay[];
}

export interface OpenMeteoWeatherResponse {
  latitude?: number;
  longitude?: number;
  elevation?: number;
  timezone?: string;
  current?: Record<string, unknown>;
  hourly?: Record<string, unknown[]>;
  daily?: Record<string, unknown[]>;
}

export interface OpenMeteoAirResponse {
  current?: Record<string, unknown>;
  hourly?: Record<string, unknown[]>;
}

const WEATHER_FIELDS =
  'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,uv_index,shortwave_radiation';
const HOURLY_FIELDS =
  'temperature_2m,precipitation_probability,weather_code,boundary_layer_height,soil_moisture_3_to_9cm';
const DAILY_FIELDS = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset';
const AIR_CURRENT_FIELDS =
  'us_aqi,european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,aerosol_optical_depth,dust';
const AIR_HOURLY_FIELDS =
  'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide';

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberOr(value: unknown, fallback: number): number {
  return numberOrNull(value) ?? fallback;
}

function arrayValue(data: Record<string, unknown[]>, key: string, index: number): unknown {
  return data[key]?.[index];
}

function matchingIndexForTime(times: unknown[] | undefined, currentTime: string): number {
  if (!times?.length) return -1;
  const exact = times.findIndex((value) => typeof value === 'string' && value === currentTime);
  if (exact >= 0) return exact;
  const hour = currentTime.slice(0, 13);
  return times.findIndex((value) => typeof value === 'string' && value.slice(0, 13) === hour);
}

function indexForTime(times: unknown[] | undefined, currentTime: string): number {
  const index = matchingIndexForTime(times, currentTime);
  return index >= 0 ? index : 0;
}

function shortTime(value: unknown): string {
  if (typeof value !== 'string') return '--:--';
  return value.includes('T') ? value.split('T')[1].slice(0, 5) : value;
}

export function weatherDescription(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Variable conditions';
}

export function aqiBand(aqi: number | null): { label: string; color: string } {
  if (aqi === null) return { label: 'Unavailable', color: '#94a3b8' };
  if (aqi <= 50) return { label: 'Good', color: '#34d399' };
  if (aqi <= 100) return { label: 'Moderate', color: '#fbbf24' };
  if (aqi <= 150) return { label: 'Sensitive groups', color: '#fb923c' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#f87171' };
  if (aqi <= 300) return { label: 'Very unhealthy', color: '#c084fc' };
  return { label: 'Hazardous', color: '#e879f9' };
}

export function formatLocation(location: WeatherLocation): string {
  return [location.name, location.admin1, location.country].filter(Boolean).join(', ');
}

export function parseCoordinates(query: string): { latitude: number; longitude: number } | null {
  const match = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

export function transformWeatherAndAir(
  location: WeatherLocation,
  weather: OpenMeteoWeatherResponse,
  air: OpenMeteoAirResponse | null
): WeatherSnapshot {
  const current = weather.current ?? {};
  const hourly = weather.hourly ?? {};
  const daily = weather.daily ?? {};
  const airCurrent = air?.current ?? {};
  const airHourly = air?.hourly ?? {};
  const observedAt = typeof current.time === 'string' ? current.time : new Date().toISOString();
  const weatherTimes = hourly.time ?? [];
  const airTimes = airHourly.time ?? [];
  const weatherNow = indexForTime(weatherTimes, observedAt);

  const aqiHistoryByDate = new Map<string, number[]>();
  (airTimes as unknown[]).forEach((time, index) => {
    const aqi = numberOrNull(arrayValue(airHourly, 'us_aqi', index));
    if (typeof time !== 'string' || aqi === null) return;
    const date = time.slice(0, 10);
    const values = aqiHistoryByDate.get(date) ?? [];
    values.push(aqi);
    aqiHistoryByDate.set(date, values);
  });

  const aqiHistory = Array.from(aqiHistoryByDate, ([date, values]) => ({
    date,
    average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    peak: Math.max(...values),
  })).slice(-7);

  const hourlyForecast: HourlyForecast[] = [];
  for (let offset = 0; offset <= 24; offset += 3) {
    const weatherIndex = weatherNow + offset;
    const time = arrayValue(hourly, 'time', weatherIndex);
    if (typeof time !== 'string') continue;
    const airIndex = matchingIndexForTime(airTimes, time);
    hourlyForecast.push({
      time: shortTime(time),
      temperatureC: numberOr(arrayValue(hourly, 'temperature_2m', weatherIndex), 0),
      precipitationProbability: numberOr(
        arrayValue(hourly, 'precipitation_probability', weatherIndex),
        0
      ),
      weatherCode: numberOr(arrayValue(hourly, 'weather_code', weatherIndex), 0),
      boundaryLayerHeightM: numberOrNull(
        arrayValue(hourly, 'boundary_layer_height', weatherIndex)
      ),
      soilMoisture3To9cm: numberOrNull(
        arrayValue(hourly, 'soil_moisture_3_to_9cm', weatherIndex)
      ),
      usAqi: numberOrNull(arrayValue(airHourly, 'us_aqi', airIndex)),
      pm25: numberOrNull(arrayValue(airHourly, 'pm2_5', airIndex)),
      pm10: numberOrNull(arrayValue(airHourly, 'pm10', airIndex)),
      nitrogenDioxide: numberOrNull(arrayValue(airHourly, 'nitrogen_dioxide', airIndex)),
      ozone: numberOrNull(arrayValue(airHourly, 'ozone', airIndex)),
      sulphurDioxide: numberOrNull(arrayValue(airHourly, 'sulphur_dioxide', airIndex)),
      carbonMonoxide: numberOrNull(arrayValue(airHourly, 'carbon_monoxide', airIndex)),
    });
  }

  const dailyForecast: DailyForecast[] = [];
  for (let index = 0; index < (daily.time?.length ?? 0); index += 1) {
    const date = arrayValue(daily, 'time', index);
    if (typeof date !== 'string' || date < observedAt.slice(0, 10)) continue;
    dailyForecast.push({
      date,
      weatherCode: numberOr(arrayValue(daily, 'weather_code', index), 0),
      temperatureMaxC: numberOr(arrayValue(daily, 'temperature_2m_max', index), 0),
      temperatureMinC: numberOr(arrayValue(daily, 'temperature_2m_min', index), 0),
      precipitationProbability: numberOr(
        arrayValue(daily, 'precipitation_probability_max', index),
        0
      ),
      uvIndexMax: numberOrNull(arrayValue(daily, 'uv_index_max', index)),
      sunrise: shortTime(arrayValue(daily, 'sunrise', index)),
      sunset: shortTime(arrayValue(daily, 'sunset', index)),
    });
  }

  return {
    location: {
      ...location,
      timezone: weather.timezone ?? location.timezone,
    },
    timezone: typeof weather.timezone === 'string' ? weather.timezone : location.timezone ?? 'UTC',
    elevationM: numberOr(weather.elevation, 0),
    observedAt,
    current: {
      temperatureC: numberOr(current.temperature_2m, 0),
      feelsLikeC: numberOr(current.apparent_temperature, numberOr(current.temperature_2m, 0)),
      humidityPercent: numberOr(current.relative_humidity_2m, 0),
      windKmh: numberOr(current.wind_speed_10m, 0),
      windDirection: numberOr(current.wind_direction_10m, 0),
      windGustKmh: numberOr(current.wind_gusts_10m, 0),
      precipitationMm: numberOr(current.precipitation, 0),
      pressureHpa: numberOr(current.pressure_msl, 0),
      cloudCoverPercent: numberOr(current.cloud_cover, 0),
      visibilityKm: numberOr(current.visibility, 0) / 1000,
      uvIndex: numberOr(current.uv_index, 0),
      solarRadiationWm2: numberOr(current.shortwave_radiation, 0),
      weatherCode: numberOr(current.weather_code, 0),
      isDay: numberOr(current.is_day, 1) === 1,
    },
    air: Object.keys(airCurrent).length
      ? {
          usAqi: numberOrNull(airCurrent.us_aqi),
          europeanAqi: numberOrNull(airCurrent.european_aqi),
          pm25: numberOrNull(airCurrent.pm2_5),
          pm10: numberOrNull(airCurrent.pm10),
          nitrogenDioxide: numberOrNull(airCurrent.nitrogen_dioxide),
          ozone: numberOrNull(airCurrent.ozone),
          sulphurDioxide: numberOrNull(airCurrent.sulphur_dioxide),
          carbonMonoxide: numberOrNull(airCurrent.carbon_monoxide),
          aerosolOpticalDepth: numberOrNull(airCurrent.aerosol_optical_depth),
          dustUgM3: numberOrNull(airCurrent.dust),
        }
      : null,
    hourly: hourlyForecast,
    daily: dailyForecast,
    aqiHistory,
  };
}

export async function fetchWeather(
  location: WeatherLocation,
  signal?: AbortSignal
): Promise<WeatherSnapshot> {
  const common = {
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: 'auto',
  };
  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  Object.entries({
    ...common,
    current: WEATHER_FIELDS,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
    forecast_days: '7',
  }).forEach(([key, value]) => forecastUrl.searchParams.set(key, value));

  const airUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  Object.entries({
    ...common,
    current: AIR_CURRENT_FIELDS,
    hourly: AIR_HOURLY_FIELDS,
    past_days: '6',
    forecast_days: '2',
  }).forEach(([key, value]) => airUrl.searchParams.set(key, value));

  const weatherResponse = await fetch(forecastUrl, { signal });
  if (!weatherResponse.ok) {
    throw new Error(`Weather service returned ${weatherResponse.status}. Try again shortly.`);
  }
  const weather = (await weatherResponse.json()) as OpenMeteoWeatherResponse;

  let air: OpenMeteoAirResponse | null = null;
  try {
    const airResponse = await fetch(airUrl, { signal });
    if (airResponse.ok) air = (await airResponse.json()) as OpenMeteoAirResponse;
  } catch (error) {
    if (signal?.aborted) throw error;
  }

  return transformWeatherAndAir(location, weather, air);
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal
): Promise<WeatherLocation[]> {
  const coords = parseCoordinates(query);
  if (coords) {
    return [
      {
        id: `coords-${coords.latitude}-${coords.longitude}`,
        name: `${coords.latitude.toFixed(3)}°, ${coords.longitude.toFixed(3)}°`,
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
    ];
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', trimmed);
  url.searchParams.set('count', '6');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Location search returned ${response.status}. Check your connection.`);
  }
  const data = (await response.json()) as {
    results?: Array<{
      id: number;
      name: string;
      admin1?: string;
      country?: string;
      country_code?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    }>;
  };
  return (data.results ?? []).map((item) => ({
    id: String(item.id),
    name: item.name,
    admin1: item.admin1,
    country: item.country,
    countryCode: item.country_code,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone,
  }));
}
