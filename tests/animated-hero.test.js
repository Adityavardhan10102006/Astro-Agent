const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Animated Hero: 1. Native desktop HTML contains ASTRO hero with accessible navigation and actions', () => {
  const htmlPath = path.join(__dirname, '..', 'src', 'ui', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Verify container and branding
  assert.ok(html.includes('id="home-animated-hero"'), 'Hero container must exist');
  assert.ok(html.includes('class="home-hero astro-animated-hero"'), 'Hero must have styled classes');
  assert.ok(html.includes('Offline-First • Private AI'), 'Offline status badge must be present');

  // Verify navigation destinations
  assert.ok(html.includes('id="hero-nav-chat"'), 'Hero Chat navigation pill must exist');
  assert.ok(html.includes('id="hero-nav-studio"'), 'Hero Studio navigation pill must exist');
  assert.ok(html.includes('id="hero-nav-models"'), 'Hero Models navigation pill must exist');
  assert.ok(html.includes('id="hero-nav-settings"'), 'Hero Settings navigation pill must exist');

  // Verify functional actions
  assert.ok(html.includes('id="hero-btn-start-chat"'), 'Primary Start Chatting button must exist');
  assert.ok(html.includes('id="hero-btn-open-studio"'), 'Secondary Open Coding Studio button must exist');

  // Verify word pull-up elements
  assert.ok(html.includes('pull-up-word'), 'WordsPullUp spans must be present');
});

test('Animated Hero: 2. Design system styles include pull-up keyframes and reduced-motion guard', () => {
  const cssPath = path.join(__dirname, '..', 'src', 'ui', 'theme', 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.astro-animated-hero'), 'Hero styles must be defined in styles.css');
  assert.ok(css.includes('@keyframes wordPullUp'), 'wordPullUp keyframes must be defined');
  assert.ok(css.includes('prefers-reduced-motion: reduce'), 'Reduced-motion accessibility query must be enforced');
  assert.ok(css.includes('.hero-noise-overlay'), 'Noise overlay styling must be present');
});

test('Animated Hero: 3. Controller script binds hero navigation and actions to real application routes', () => {
  const appJsPath = path.join(__dirname, '..', 'src', 'ui', 'app.js');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  assert.ok(appJs.includes('heroNavChat.addEventListener'), 'heroNavChat must be bound to navigateTo');
  assert.ok(appJs.includes('heroNavStudio.addEventListener'), 'heroNavStudio must be bound to navigateTo');
  assert.ok(appJs.includes('heroNavModels.addEventListener'), 'heroNavModels must be bound to navigateTo');
  assert.ok(appJs.includes('heroNavSettings.addEventListener'), 'heroNavSettings must be bound to navigateTo');
  assert.ok(appJs.includes('heroBtnStartChat.addEventListener'), 'heroBtnStartChat must be bound to navigateTo');
  assert.ok(appJs.includes('heroBtnOpenStudio.addEventListener'), 'heroBtnOpenStudio must be bound to navigateTo');
});

test('Animated Hero: 4. Reusable React component in components/ui/prisma-hero.tsx exports required subcomponents', () => {
  const tsxPath = path.join(__dirname, '..', 'components', 'ui', 'prisma-hero.tsx');
  assert.ok(fs.existsSync(tsxPath), 'components/ui/prisma-hero.tsx must exist');

  const tsx = fs.readFileSync(tsxPath, 'utf8');
  assert.ok(tsx.includes('export const WordsPullUp'), 'WordsPullUp component must be exported');
  assert.ok(tsx.includes('export interface WordsPullUpProps'), 'WordsPullUpProps interface must be exported');
  assert.ok(tsx.includes('export const WordsPullUpMultiStyle'), 'WordsPullUpMultiStyle component must be exported');
  assert.ok(tsx.includes('export interface WordsPullUpMultiStyleProps'), 'WordsPullUpMultiStyleProps interface must be exported');
  assert.ok(tsx.includes('export const PrismaHero'), 'PrismaHero component must be exported');
  assert.ok(tsx.includes('export const AstroHero'), 'AstroHero alias must be exported');
  assert.ok(tsx.includes('useReducedMotion'), 'Framer Motion useReducedMotion must be utilized');
});
