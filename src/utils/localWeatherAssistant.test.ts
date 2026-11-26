import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeatherAdviceMessages } from './localWeatherAssistant';

test('builds a local weather coach prompt from current conditions and user intent', () => {
  const messages = buildWeatherAdviceMessages('US AQI: 120; rain chance: 60%.', 'Should I bike?');

  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /claim access to live web information/i);
  assert.match(messages[0].content, /if AQI is 151 or higher/i);
  assert.match(messages[0].content, /do not recommend walking, cycling, running/i);
  assert.equal(messages[1].role, 'user');
  assert.match(messages[1].content, /US AQI: 120; rain chance: 60%/);
  assert.match(messages[1].content, /Should I bike\?/);
});

test('uses a weather-planning question when the user leaves the question blank', () => {
  const messages = buildWeatherAdviceMessages('Clear skies.', '   ');
  assert.match(messages[1].content, /Give me practical advice for outdoor activities and commuting today\./);
});
