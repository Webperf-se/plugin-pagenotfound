// import { JSDOM } from 'jsdom';
import { Rating } from 'webperf-sitespeedio-plugin';

export function rateResponseStatusCode(globalTranslation, localTranslation, statusCode) {
  const rating404 = new Rating(globalTranslation, getConfig('general.review.improve-only'));
  const comment = localTranslation('TEXT_REVIEW_WRONG_STATUS_CODE').replace('{code}', statusCode);

  if (statusCode === 404) {
    rating404.setOverall(5.0, comment);
    rating404.setStandards(5.0, comment);
  } else {
    rating404.setOverall(1.0, comment);
    rating404.setStandards(1.0, comment);
  }

  return rating404;
}

export function rateResponseTitle(globalTranslation, resultDict, localTranslation, soup) {
  const ratingTitle = new Rating(globalTranslation, getConfig('general.review.improve-only'));
  const title = soup.querySelector('title');
  const comment = localTranslation('TEXT_REVIEW_NO_TITLE');

  if (title) {
    resultDict.pageTitle = title.textContent;
    ratingTitle.setOverall(5.0, comment);
    ratingTitle.setStandards(5.0, comment);
    ratingTitle.setA11y(5.0, comment);
  } else {
    ratingTitle.setOverall(1.0, comment);
    ratingTitle.setStandards(1.0, comment);
    ratingTitle.setA11y(1.0, comment);
  }

  return ratingTitle;
}

export function rateResponseHeader1(globalTranslation, resultDict, localTranslation, soup) {
  const ratingH1 = new Rating(globalTranslation, getConfig('general.review.improve-only'));
  const h1 = soup.querySelector('h1');
  const comment = localTranslation('TEXT_REVIEW_MAIN_HEADER');

  if (h1) {
    resultDict.h1 = h1.textContent;
    ratingH1.setOverall(5.0, comment);
    ratingH1.setStandards(5.0, comment);
    ratingH1.setA11y(5.0, comment);
  } else {
    ratingH1.setOverall(1.0, comment);
    ratingH1.setStandards(1.0, comment);
    ratingH1.setA11y(1.0, comment);
  }

  return ratingH1;
}

export function rateCorrectLanguageText(soup, requestText, orgUrl, globalTranslation, localTranslation) {
  let foundMatch = false;
  let pageLang = getSupportedLangCodeOrDefault(soup);

  if (pageLang !== 'sv') {
    const contentRootPage = getHttpContent(orgUrl, true);
    const soupRootPage = new JSDOM(contentRootPage).window.document;
    const rootPageLang = getSupportedLangCodeOrDefault(soupRootPage);

    if (rootPageLang !== pageLang) {
      pageLang = 'sv';
    }
  }

  const fourOFourStrings = get404Texts(pageLang);
  const textFromPage = requestText.toLowerCase();

  for (const item of fourOFourStrings) {
    if (textFromPage.includes(item)) {
      foundMatch = true;
      break;
    }
  }

  const ratingSwedishText = new Rating(globalTranslation, getConfig('general.review.improve-only'));
  const comment = localTranslation('TEXT_REVIEW_NO_SWEDISH_ERROR_MSG');

  if (foundMatch) {
    ratingSwedishText.setOverall(5.0, comment);
    ratingSwedishText.setA11y(5.0, comment);
  } else {
    ratingSwedishText.setOverall(1.0, comment);
    ratingSwedishText.setA11y(1.0, comment);
  }

  return ratingSwedishText;
}
