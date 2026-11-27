import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

test('renders an accessible initial loading state and primary controls', () => {
  const markup = renderToStaticMarkup(React.createElement(App));

  assert.match(markup, /role="status" aria-live="polite"/);
  assert.match(markup, /Reading local conditions/);
  assert.match(markup, /aria-label="Primary navigation"/);
  assert.match(markup, /aria-label="Switch to light theme"/);
});
