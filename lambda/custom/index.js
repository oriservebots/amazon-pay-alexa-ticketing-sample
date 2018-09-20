/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
const utilities = require('utilities');
const directiveBuilder = require('directive-builder');
const payloadBuilder = require('payload-builder');
//const error = require('error-handler');
const config = require('config').AMAZON_PAY;
const translations = require('translations');
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');

const LaunchRequestHandler = {

    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        utilities.debug(`Intent input: ${JSON.stringify(handlerInput)}`);
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechOutput = requestAttributes.t('WELCOME');
        const cardTitle = requestAttributes.t('CARD_TITLE');

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(speechOutput)
            .withSimpleCard(cardTitle, speechOutput)
            .getResponse();
    },
};

const MovieDetailsIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'MovieDetailsIntent';
    },
    handle(handlerInput) {
        utilities.debug(`Intent input: ${JSON.stringify(handlerInput)}`);
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechOutput = requestAttributes.t('MOVIE_DETAILS');
        const cardTitle = requestAttributes.t('CARD_TITLE');
        const cardContent = requestAttributes.t('MOVIE_DETAILS_CARD');
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .withSimpleCard(cardTitle, cardContent)
            .getResponse();
    },
};

const BuyTicketIntentStartedHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' 
        && handlerInput.requestEnvelope.request.intent.name === 'BuyTicketIntent'
        && handlerInput.requestEnvelope.request.dialogState == 'STARTED';
    },
    handle(handlerInput) {
        // permission check
        const permissions = utilities.getPermissions(handlerInput);
        const amazonPayPermission = permissions.scopes['payments:autopay_consent'];
        if(amazonPayPermission.status === "DENIED"){
            const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            const permissionRequest = requestAttributes.t('PAY_PERMISSION_REQUEST');
            return handlerInput.responseBuilder
                .speak(permissionRequest)
                .withAskForPermissionsConsentCard([ 'payments:autopay_consent' ])
                .getResponse();
        }
        utilities.debug(`Intent input: ${JSON.stringify(handlerInput)}`);
        const currentIntent = handlerInput.requestEnvelope.request.intent;
        return handlerInput.responseBuilder
                .addDelegateDirective(currentIntent)
                .getResponse();
    }
}

const BuyTicketIntentCompletedHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'BuyTicketIntent'
            && handlerInput.requestEnvelope.request.dialogState !== 'COMPLETED';
    },
    handle(handlerInput) {
        // confirmation of selection needed
        utilities.debug(`Intent input: ${JSON.stringify(handlerInput)}`);
        const currentIntent = handlerInput.requestEnvelope.request.intent;
        const count = currentIntent.slots.count.value;
        handlerInput.attributesManager.setSessionAttributes({
            count: count
        });
        if (count && count.value == "?" || count.value == "0") {
            currentIntent.slots.amount = null;
            return handlerInput.responseBuilder
                .addElicitSlotDirective('count', currentIntent)
                .getResponse();
        } else {
            return handlerInput.responseBuilder
                .addDelegateDirective(currentIntent)
                .getResponse();
        }
    }
}

const ConfirmedBuyTicketIntentCompletedHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'BuyTicketIntent'
            && handlerInput.requestEnvelope.request.dialogState === 'COMPLETED'
            && handlerInput.requestEnvelope.request.intent.confirmationStatus === 'CONFIRMED';
    },
    handle(handlerInput) {
        utilities.debug(`Intent input: ${JSON.stringify(handlerInput)}`);
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const token = handlerInput.requestEnvelope.context.System.user.userId;

        // start Amazon Pay setup here
        const payload = payloadBuilder.setupPayload(handlerInput.requestEnvelope.request.locale);
        const directive = directiveBuilder.createSetupDirective(payload, token);

        utilities.debug(`Setup directive: ${JSON.stringify(directive)}`);

        return handlerInput.responseBuilder
            .addDirective(directive)
            .withShouldEndSession(true)
            .getResponse();
    }
}

const ConnectionsSetupResponseHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === "Connections.Response" 
        && handlerInput.requestEnvelope.request.name === "Setup";
    },
    handle(handlerInput) {
        utilities.debug(`Intent input: ${JSON.stringify(handlerInput)}`);

        const actionResponsePayload = handlerInput.requestEnvelope.request.payload;
        const actionResponseStatusCode = handlerInput.requestEnvelope.request.status.code;
        if (actionResponseStatusCode != 200) {
            // TODO add error handling!

            /*
            const result = error.handleErrors(handlerInput);
            // If it is a permissions error send a permission consent card to the user, otherwise .speak() error to resolve during testing
            if (result.permissionsError) {
                return handlerInput.responseBuilder
                    .speak(requestAttributes.t('PAY_PERMISSION_REQUEST'))
                    .withAskForPermissionsConsentCard([errorMessages.scope])
                    .getResponse();
            } else {
                utilities.log(result.errorMessage);
                return handlerInput.responseBuilder
                .speak(requestAttributes.t('PAYMENT_ERROR'))
                .getResponse();
            }
            */

            return handlerInput.responseBuilder
                .speak(requestAttributes.t('PAYMENT_ERROR'))
                .getResponse();
        } else {
            const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

            // get the BA id
            const billingAgreementDetails = actionResponsePayload.billingAgreementDetails;
            const billingAgreementID = billingAgreementDetails.billingAgreementId;
            const billingAgreementStatus = billingAgreementDetails.billingAgreementStatus;

            if(billingAgreementStatus === 'OPEN'){
                // prepare actual charge
                const token = handlerInput.requestEnvelope.context.System.user.userId;

                var amount = sessionAttributes['count'] * config.TICKET_PRICE;
                if(!amount || amount == 0 || amount == null){ // TODO: count stored in the session , we need a database!!
                    amount = 99; 
                }

                const payload = payloadBuilder.chargePayload(billingAgreementID, utilities.generateRandomString(16),utilities.generateRandomString(6), amount);
                const directive = directiveBuilder.createChargeDirective(payload, token);

                utilities.debug(`Charge directive: ${JSON.stringify(directive)}`);

                return handlerInput.responseBuilder
                    .addDirective(directive)
                    .withShouldEndSession(true)
                    .getResponse();
            }
            
        }
    }
}

const ConnectionsChargeResponseHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === "Connections.Response" 
        && handlerInput.requestEnvelope.request.name === "Charge";
    },
    handle(handlerInput) {
        utilities.debug(`Intent input: ${JSON.stringify(handlerInput)}`);
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        var count = sessionAttributes['count'];
        if (count <= 0){ // TODO, store count in database
            count = 99; 
        }
        const speechOutput = requestAttributes.t('THANK_YOU');
        const cardTitle = requestAttributes.t('CARD_TITLE');
        const cardContent = requestAttributes.t('SUCCESS_DETAILS_CARD')
            .replace("$count$", count)
            .replace("$reference$", utilities.generateRandomString(7));

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .withSimpleCard(cardTitle, cardContent)
            .getResponse();

    }
}


const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechOutput = requestAttributes.t('HELP');
        const cardTitle = requestAttributes.t('CARD_TITLE');
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(speechOutput)
            .withSimpleCard(cardTitle, speechOutput)
            .getResponse();
    },
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        utilities.debug(`Intent input: ${JSON.stringify(handlerInput)}`);
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechOutput = requestAttributes.t('GOODBYE');
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .getResponse();
    },
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        utilities.debug(`Intent input: ${JSON.stringify(handlerInput)}`);
        utilities.debug(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`)
        return handlerInput.responseBuilder.getResponse();
    },
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        utilities.debug(`Intent input: ${JSON.stringify(handlerInput)}`);
        utilities.debug(`Error handled: ${error.message}`);
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechOutput = requestAttributes.t('ERROR_PROMPT');
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(speechOutput)
            .getResponse();
    },
};

// Finding the locale of the user
const LocalizationInterceptor = {
    process(handlerInput) {

        const localizationClient = i18n.use(sprintf).init({
            lng: handlerInput.requestEnvelope.request.locale,
            overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
            resources: translations.languageString,
            returnObjects: true
        });

        const attributes = handlerInput.attributesManager.getRequestAttributes();

        attributes.t = function (...args) {
            return localizationClient.t(...args);
        };
    },
};


const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
    .addRequestHandlers(
        LaunchRequestHandler,
        MovieDetailsIntentHandler,
        BuyTicketIntentStartedHandler,
        BuyTicketIntentCompletedHandler,
        ConfirmedBuyTicketIntentCompletedHandler,
        ConnectionsSetupResponseHandler,
        ConnectionsChargeResponseHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler
    )
    .addRequestInterceptors(LocalizationInterceptor)
    .addErrorHandlers(ErrorHandler)
    .lambda();
