import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aqiBand,
  parseCoordinates,
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

test('classifies AQI and WMO conditions and validates manual coordinates', () => {
  assert.equal(aqiBand(null).label, 'Unavailable');
  assert.equal(aqiBand(35).label, 'Good');
  assert.equal(aqiBand(126).label, 'Sensitive groups');
  assert.equal(weatherDescription(95), 'Thunderstorm');
  assert.deepEqual(parseCoordinates('40.71, -74.00'), { latitude: 40.71, longitude: -74 });
  assert.equal(parseCoordinates('91, 0'), null);
});
