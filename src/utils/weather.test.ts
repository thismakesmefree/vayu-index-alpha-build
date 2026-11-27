import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aqiBand,
  fetchWeather,
  formatLocation,
  parseCoordinates,
  searchLocations,
  transformWeatherAndAir,
  weatherDescription,
  type OpenMeteoAirResponse,
  type OpenMeteoWeatherResponse,
  type WeatherLocation,
} from './weather';

const location: WeatherLocation = {
  id: 'test',
  name: 'Test City',
  latitude: 40,
  longitude: -73,
  timezone: 'America/New_York',
};

const validWeatherResponse: OpenMeteoWeatherResponse = {
  latitude: 40,
  longitude: -73,
  elevation: 10,
  timezone: 'America/New_York',
  current: {
    temperature_2m: 12,
    relative_humidity_2m: 68,
    apparent_temperature: 10,
    is_day: 1,
    precipitation: 0,
    weather_code: 2,
    cloud_cover: 45,
    pressure_msl: 1018,
    wind_speed_10m: 14,
    wind_direction_10m: 225,
    wind_gusts_10m: 21,
    visibility: 10000,
    uv_index: 2.1,
    shortwave_radiation: 210,
  },
  hourly: { time: [] },
  daily: { time: [] },
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status });
}

async function withMockedFetch<T>(mock: typeof fetch, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('transforms Open-Meteo current conditions, forecasts, and hourly AQI', () => {
  const weather: OpenMeteoWeatherResponse = {
    latitude: 40.1,
    longitude: -73.1,
    elevation: 10,
    timezone: 'America/New_York',
    current: {
      time: '2026-11-26T09:00',
      temperature_2m: 12.4,
      apparent_temperature: 10,
      relative_humidity_2m: 68,
      wind_speed_10m: 14,
      wind_direction_10m: 225,
      wind_gusts_10m: 21,
      precipitation: 0,
      pressure_msl: 1018,
      cloud_cover: 45,
      visibility: 10000,
      uv_index: 2.1,
      shortwave_radiation: 210,
      weather_code: 2,
      is_day: 1,
    },
    hourly: {
      time: ['2026-11-26T09:00', '2026-11-26T10:00', '2026-11-26T11:00', '2026-11-26T12:00'],
      temperature_2m: [12, 13, 14, 14],
      precipitation_probability: [0, 0, 5, 10],
      weather_code: [2, 2, 1, 1],
      boundary_layer_height: [210, 220, 230, 240],
      soil_moisture_3_to_9cm: [0.255, 0.254, 0.253, 0.252],
    },
    daily: {
      time: ['2026-11-26', '2026-11-27'],
      weather_code: [2, 1],
      temperature_2m_max: [15, 16],
      temperature_2m_min: [8, 9],
      precipitation_probability_max: [10, 5],
      uv_index_max: [3.2, 4.1],
      sunrise: ['2026-11-26T06:42', '2026-11-27T06:43'],
      sunset: ['2026-11-26T16:31', '2026-11-27T16:30'],
    },
  };
  const air: OpenMeteoAirResponse = {
    current: {
      us_aqi: 72,
      european_aqi: 44,
      pm2_5: 18.2,
      pm10: 27,
      aerosol_optical_depth: 0.48,
      dust: 2.4,
    },
    hourly: {
      time: ['2026-11-26T09:00', '2026-11-26T10:00', '2026-11-26T11:00', '2026-11-26T12:00'],
      us_aqi: [72, 70, 67, 65],
      pm2_5: [18.2, 17.5, 17, 16],
      pm10: [27, 26, 25, 24],
      nitrogen_dioxide: [21, 20, 19, 18],
      ozone: [38, 39, 40, 41],
      sulphur_dioxide: [4, 3.8, 3.6, 3.5],
      carbon_monoxide: [260, 250, 245, 240],
    },
  };

  const snapshot = transformWeatherAndAir(location, weather, air);
  assert.equal(snapshot.location.latitude, location.latitude);
  assert.equal(snapshot.location.longitude, location.longitude);
  assert.equal(snapshot.current.temperatureC, 12.4);
  assert.equal(snapshot.current.visibilityKm, 10);
  assert.equal(snapshot.current.uvIndex, 2.1);
  assert.equal(snapshot.current.solarRadiationWm2, 210);
  assert.equal(snapshot.air?.usAqi, 72);
  assert.equal(snapshot.air?.aerosolOpticalDepth, 0.48);
  assert.equal(snapshot.air?.dustUgM3, 2.4);
  assert.equal(snapshot.hourly[1].usAqi, 65);
  assert.equal(snapshot.hourly[1].pm10, 24);
  assert.equal(snapshot.hourly[0].boundaryLayerHeightM, 210);
  assert.equal(snapshot.hourly[0].soilMoisture3To9cm, 0.255);
  assert.equal(snapshot.daily[0].sunrise, '06:42');
  assert.equal(snapshot.daily[0].uvIndexMax, 3.2);
});

test('aligns pollutant forecasts to matching weather timestamps', () => {
  const snapshot = transformWeatherAndAir(
    location,
    {
      current: { time: '2026-11-26T09:00' },
      hourly: {
        time: [
          '2026-11-26T09:00',
          '2026-11-26T10:00',
          '2026-11-26T11:00',
          '2026-11-26T12:00',
        ],
        boundary_layer_height: [180, 190, 200, 220],
        soil_moisture_3_to_9cm: [0.25, 0.25, 0.24, 0.24],
      },
    },
    {
      current: { us_aqi: 72 },
      hourly: {
        time: ['2026-11-26T08:00', '2026-11-26T09:00', '2026-11-26T12:00'],
        us_aqi: [90, 72, 65],
        pm2_5: [16, 14, 11],
      },
    }
  );

  assert.equal(snapshot.hourly[0].usAqi, 72);
  assert.equal(snapshot.hourly[1].usAqi, 65);
  assert.equal(snapshot.hourly[0].pm25, 14);
  assert.equal(snapshot.hourly[1].pm25, 11);
  assert.equal(snapshot.hourly[0].boundaryLayerHeightM, 180);
  assert.equal(snapshot.hourly[0].soilMoisture3To9cm, 0.25);
});

test('keeps air-quality unavailable rather than inventing measurements', () => {
  const snapshot = transformWeatherAndAir(location, { current: { time: '2026-11-26T09:00' } }, null);
  assert.equal(snapshot.air, null);
  assert.equal(snapshot.hourly.length, 0);
});

test('excludes future forecast days from AQI history', () => {
  const dates = Array.from({ length: 9 }, (_, index) => `2026-11-${String(index + 20).padStart(2, '0')}T12:00`);
  const snapshot = transformWeatherAndAir(
    location,
    { current: { time: '2026-11-26T09:00' } },
    {
      hourly: {
        time: dates,
        us_aqi: dates.map((_, index) => 50 + index),
      },
    }
  );

  assert.deepEqual(
    snapshot.aqiHistory.map((day) => day.date),
    ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']
  );
  assert.equal(snapshot.aqiHistory.at(-1)?.average, 56);
});

test('fetches weather and air data with the intended Open-Meteo query parameters', async () => {
  const urls: URL[] = [];
  const airResponse = { current: { us_aqi: 42, pm2_5: 9.5 }, hourly: { time: [], us_aqi: [] } };

  const snapshot = await withMockedFetch(
    async (input) => {
      urls.push(new URL(input instanceof Request ? input.url : String(input)));
      return jsonResponse(urls.at(-1)?.pathname.includes('air-quality') ? airResponse : validWeatherResponse);
    },
    () => fetchWeather(location)
  );

  assert.equal(snapshot.current.temperatureC, 12);
  assert.equal(snapshot.air?.usAqi, 42);
  assert.equal(urls.length, 2);
  assert.equal(urls[0].hostname, 'api.open-meteo.com');
  assert.equal(urls[0].pathname, '/v1/forecast');
  assert.equal(urls[0].searchParams.get('timezone'), 'auto');
  assert.equal(urls[0].searchParams.get('forecast_days'), '7');
  assert.equal(urls[1].pathname, '/v1/air-quality');
  assert.equal(urls[1].searchParams.get('past_days'), '6');
});

test('reports weather service and malformed current-data errors instead of fabricating readings', async () => {
  await withMockedFetch(
    async () => jsonResponse({}, 503),
    () => assert.rejects(fetchWeather(location), /Weather service returned 503/)
  );

  await withMockedFetch(
    async () => jsonResponse({ ...validWeatherResponse, current: { temperature_2m: 12 } }),
    () => assert.rejects(fetchWeather(location), /incomplete current conditions/)
  );

  await withMockedFetch(
    async () => jsonResponse({ ...validWeatherResponse, hourly: { time: 'invalid' } }),
    () => assert.rejects(fetchWeather(location), /invalid hourly forecast data/)
  );
  await withMockedFetch(
    async () => jsonResponse({ ...validWeatherResponse, elevation: 'unknown' }),
    () => assert.rejects(fetchWeather(location), /invalid elevation value/)
  );
});

test('keeps weather available when the optional air-quality endpoint fails', async () => {
  let callCount = 0;
  const snapshot = await withMockedFetch(
    async () => {
      callCount += 1;
      return callCount === 1 ? jsonResponse(validWeatherResponse) : jsonResponse({}, 503);
    },
    () => fetchWeather(location)
  );

  assert.equal(snapshot.current.temperatureC, 12);
  assert.equal(snapshot.air, null);
});

test('propagates cancellation while requesting optional air-quality data', async () => {
  const controller = new AbortController();
  let callCount = 0;

  await withMockedFetch(
    async () => {
      callCount += 1;
      if (callCount === 1) return jsonResponse(validWeatherResponse);
      controller.abort();
      throw new DOMException('The operation was aborted.', 'AbortError');
    },
    () => assert.rejects(fetchWeather(location, controller.signal), { name: 'AbortError' })
  );
});

test('searches places and resolves coordinate queries without a network request', async () => {
  let called = false;
  const coordinateResults = await withMockedFetch(
    async () => {
      called = true;
      throw new Error('Coordinates should not call the geocoder.');
    },
    () => searchLocations('40.71, -74')
  );
  assert.equal(called, false);
  assert.deepEqual(
    { latitude: coordinateResults[0].latitude, longitude: coordinateResults[0].longitude },
    { latitude: 40.71, longitude: -74 }
  );

  const placeResults = await withMockedFetch(
    async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.pathname, '/v1/search');
      assert.equal(url.searchParams.get('name'), 'Test City');
      return jsonResponse({
        results: [{
          id: 123,
          name: 'Test City',
          admin1: 'Test Region',
          country: 'Test Country',
          country_code: 'TC',
          latitude: 40,
          longitude: -73,
          timezone: 'America/New_York',
        }],
      });
    },
    () => searchLocations(' Test City ')
  );
  assert.deepEqual(placeResults[0], {
    id: '123',
    name: 'Test City',
    admin1: 'Test Region',
    country: 'Test Country',
    countryCode: 'TC',
    latitude: 40,
    longitude: -73,
    timezone: 'America/New_York',
  });
});

test('skips short location queries and rejects failed or malformed geocoder responses', async () => {
  let called = false;
  assert.deepEqual(
    await withMockedFetch(
      async () => {
        called = true;
        throw new Error('Short queries should not call the geocoder.');
      },
      () => searchLocations(' ')
    ),
    []
  );
  assert.equal(called, false);

  await withMockedFetch(
    async () => jsonResponse({}, 503),
    () => assert.rejects(searchLocations('Nowhere'), /Location search returned 503/)
  );
  await withMockedFetch(
    async () => jsonResponse({ results: [{ id: 1, name: 'Invalid', latitude: 91, longitude: 0 }] }),
    () => assert.rejects(searchLocations('Invalid'), /invalid result/)
  );
  assert.deepEqual(
    await withMockedFetch(async () => jsonResponse({ results: null }), () => searchLocations('No match')),
    []
  );
});

test('classifies AQI and WMO conditions and validates manual coordinates', () => {
  assert.equal(aqiBand(null).label, 'Unavailable');
  assert.equal(aqiBand(35).label, 'Good');
  assert.equal(aqiBand(126).label, 'Sensitive groups');
  assert.equal(aqiBand(50).label, 'Good');
  assert.equal(aqiBand(100).label, 'Moderate');
  assert.equal(aqiBand(150).label, 'Sensitive groups');
  assert.equal(aqiBand(200).label, 'Unhealthy');
  assert.equal(aqiBand(300).label, 'Very unhealthy');
  assert.equal(aqiBand(301).label, 'Hazardous');
  assert.equal(weatherDescription(0), 'Clear sky');
  assert.equal(weatherDescription(1), 'Mainly clear');
  assert.equal(weatherDescription(3), 'Overcast');
  assert.equal(weatherDescription(48), 'Fog');
  assert.equal(weatherDescription(51), 'Drizzle');
  assert.equal(weatherDescription(57), 'Drizzle');
  assert.equal(weatherDescription(61), 'Rain');
  assert.equal(weatherDescription(67), 'Rain');
  assert.equal(weatherDescription(71), 'Snow');
  assert.equal(weatherDescription(77), 'Snow');
  assert.equal(weatherDescription(82), 'Rain showers');
  assert.equal(weatherDescription(86), 'Snow showers');
  assert.equal(weatherDescription(95), 'Thunderstorm');
  assert.equal(weatherDescription(99), 'Thunderstorm');
  assert.equal(weatherDescription(4), 'Variable conditions');
  assert.deepEqual(parseCoordinates('40.71, -74.00'), { latitude: 40.71, longitude: -74 });
  assert.deepEqual(parseCoordinates('-90 180'), { latitude: -90, longitude: 180 });
  assert.equal(parseCoordinates('90.1, 0'), null);
  assert.equal(parseCoordinates('0, -180.1'), null);
  assert.equal(parseCoordinates('somewhere'), null);
  assert.equal(formatLocation({ ...location, admin1: undefined, country: undefined }), 'Test City');
  assert.equal(parseCoordinates('91, 0'), null);
});
