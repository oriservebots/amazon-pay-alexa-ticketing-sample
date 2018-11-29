const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');
const translations = require('translations');


function getClientForPrompts(locale){
    return i18n.use(sprintf).init({
        lng: locale,
        overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
        resources: translations.languageString,
        returnObjects: true
    });
}

function getClientForPayload(locale){
    return i18n.use(sprintf).init({
        lng: locale,
        overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
        resources: translations.payloadString,
        returnObjects: true
    });
}

module.exports = {
    'getClientForPrompts': getClientForPrompts,
    'getClientForPayload': getClientForPayload
}