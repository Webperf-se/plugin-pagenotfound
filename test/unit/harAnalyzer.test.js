import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HarAnalyzer } from '../../lib/harAnalyzer.js';

function knowledge(lang, bodyText) {
  return {
    url: 'https://example.com/missing',
    group: 'example.com',
    'is-page-not-found-page': true,
    issues: {},
    lang,
    'page-title': 'Lorem',
    h1: 'Lorem',
    'body-text': bodyText,
    'status-code': 404,
    'other-404-responses': []
  };
}

function severity(analyzer, lang, bodyText, rule) {
  const data = knowledge(lang, bodyText);
  analyzer.addIssuesFromKnowledgeData(data);
  return data.issues[rule].severity;
}

const analyzer = new HarAnalyzer();

test('locale code is the primary subtag in lowercase', () => {
  assert.equal(analyzer.getLocaleCode('de-DE'), 'de');
  assert.equal(analyzer.getLocaleCode('SV'), 'sv');
  assert.equal(analyzer.getLocaleCode('en-GB'), 'en');
  assert.equal(analyzer.getLocaleCode('fr_FR'), 'fr');
});

test('norwegian written forms use the no locale', () => {
  assert.equal(analyzer.getLocaleCode('nb-NO'), 'no');
  assert.equal(analyzer.getLocaleCode('nn'), 'no');
});

test('missing lang gives no locale code', () => {
  assert.equal(analyzer.getLocaleCode(undefined), undefined);
  assert.equal(analyzer.getLocaleCode(''), undefined);
});

test('swedish and english locales are loaded without duplicates', () => {
  assert.ok(analyzer.locales.sv.length > 20);
  assert.ok(analyzer.locales.en.length > 20);
  assert.equal(new Set(analyzer.locales.sv).size, analyzer.locales.sv.length);
  assert.equal(new Set(analyzer.locales.en).size, analyzer.locales.en.length);
});

test('matching ignores case', () => {
  assert.equal(severity(analyzer, 'sv', 'Hoppsan! Sidan du letar efter verkar ha försvunnit.', 'no-valid-not-found-text-in-body'), 'resolved');
  assert.equal(severity(analyzer, 'en', 'PAGE NOT FOUND. Check the URL.', 'no-valid-not-found-text-in-body'), 'resolved');
});

test('swedish page without a known phrase fails the text rule', () => {
  assert.equal(severity(analyzer, 'sv', 'Välkommen till vår webbplats.', 'no-valid-not-found-text-in-body'), 'warning');
});

test('unsupported language gets the locale warning and is checked against every locale', () => {
  const data = knowledge('xx', 'This page could not be found.');
  analyzer.addIssuesFromKnowledgeData(data);
  assert.equal(data.issues['no-unsupported-locale-use'].severity, 'warning');
  assert.equal(data.issues['no-valid-not-found-text-in-body'].severity, 'resolved');
});

test('unsupported language without any known phrase fails both rules', () => {
  const data = knowledge('xx', 'Lorem ipsum dolor sit amet.');
  analyzer.addIssuesFromKnowledgeData(data);
  assert.equal(data.issues['no-unsupported-locale-use'].severity, 'warning');
  assert.equal(data.issues['no-valid-not-found-text-in-body'].severity, 'warning');
});

test('missing lang is checked against every locale without a locale warning', () => {
  const data = knowledge(undefined, 'Sidan kunde inte hittas.');
  analyzer.addIssuesFromKnowledgeData(data);
  assert.equal(data.issues['no-unsupported-locale-use'].severity, 'resolved');
  assert.equal(data.issues['no-valid-not-found-text-in-body'].severity, 'resolved');
});

test('a german page is not matched against swedish phrases', () => {
  // Fails until locale/de.json exists; the phrase is a common German 404 wording.
  const data = knowledge('de', 'Die angeforderte Seite wurde leider nicht gefunden.');
  analyzer.addIssuesFromKnowledgeData(data);
  assert.equal(data.issues['no-unsupported-locale-use'].severity, 'resolved');
  assert.equal(data.issues['no-valid-not-found-text-in-body'].severity, 'resolved');
});

test('every locale file loads and matches a phrase seen on a real page', () => {
  const samples = {
    da: 'Hov, siden findes ikke. Den kan være blevet flyttet eller slettet.',
    de: 'Die aufgerufene Seite existiert nicht.',
    en: 'The page could not be found.',
    es: 'Lo sentimos, no podemos encontrar la página que estás buscando.',
    fi: 'Sivua ei löytynyt. Sivun osoite on väärin.',
    fr: 'La page que vous recherchez n’existe plus.',
    is: 'Síðan sem þú leitaðir að fannst því miður ekki.',
    it: 'Ci dispiace ma la pagina che stai cercando non è stata trovata.',
    no: 'Beklager, vi finner ikke siden du leter etter.',
    sv: 'Sidan kunde inte hittas.'
  };
  assert.deepEqual(Object.keys(analyzer.locales).sort(), Object.keys(samples).sort());
  for (const [lang, text] of Object.entries(samples)) {
    assert.equal(severity(analyzer, lang, text, 'no-valid-not-found-text-in-body'), 'resolved', lang);
    assert.equal(severity(analyzer, lang, text, 'no-unsupported-locale-use'), 'resolved', lang);
  }
});

test('nynorsk wording is covered by the no locale', () => {
  assert.equal(severity(analyzer, 'no', 'Sida finst ikkje lenger.', 'no-valid-not-found-text-in-body'), 'resolved');
});

test('wording only in the title still counts', () => {
  const data = knowledge('fr', 'Retour à la page d’accueil.');
  data['page-title'] = 'Oups ! Page introuvable';
  analyzer.addIssuesFromKnowledgeData(data);
  assert.equal(data.issues['no-valid-not-found-text-in-body'].severity, 'resolved');
});
