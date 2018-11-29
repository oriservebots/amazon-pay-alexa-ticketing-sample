/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
const localization = require('localization');
const directiveBuilder = require('directive-builder');
const payloadBuilder = require('payload-builder');
const utilities = require('utilities');
const config = require('config').AMAZON_PAY;

const LaunchRequestHandler = {

    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        utilities.debug(`Launch Intent input: ${JSON.stringify(handlerInput)}`);
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
            && handlerInput.requestEnvelope.request.dialogState === 'STARTED';
    },
    handle(handlerInput) {
        // permission check
        const permissions = utilities.getPermissions(handlerInput);
        const amazonPayPermission = permissions.scopes['payments:autopay_consent'];
        if (amazonPayPermission.status === "DENIED") {
            const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            const permissionRequest = requestAttributes.t('PAY_PERMISSION_REQUEST');
            return handlerInput.responseBuilder
                .speak(permissionRequest)
                .withAskForPermissionsConsentCard(['payments:autopay_consent'])
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

        if (count && count.value === "?" || count.value === "0") {
            currentIntent.slots.count = null;
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
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const statusCode = handlerInput.requestEnvelope.request.status.code;
        if (statusCode != 200) {

            return handlerInput.responseBuilder
                .speak(requestAttributes.t('PAYMENT_ERROR'))
                .getResponse();
            
        } else {
            // get the BA id
            const payload = handlerInput.requestEnvelope.request.payload;
            const billingAgreementDetails = payload.billingAgreementDetails;
            const billingAgreementId = billingAgreementDetails.billingAgreementId;

            if(billingAgreementDetails.billingAgreementStatus === "SUSPENDED"){
                // no need to call charge
                const payload = handlerInput.requestEnvelope.request.payload;
                const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
                const errorMessage = requestAttributes.t("PAYMENT_IPM_REPEAT");
                
                return handlerInput.responseBuilder
                    .speak(errorMessage)
                    .withShouldEndSession(true)
                    .getResponse();;
            }

            // prepare actual charge
            return new Promise((resolve, reject) => {
                handlerInput.attributesManager.getPersistentAttributes()
                    .then((attributes) => {
                        const token = handlerInput.requestEnvelope.context.System.user.userId;
                        const locale = handlerInput.requestEnvelope.request.locale;
                        const regionalConfig = config.REGIONAL[locale];
                        var orderTotal = attributes.count * regionalConfig.TICKET_PRICE;
                        var payload = payloadBuilder.chargePayload(billingAgreementId, utilities.generateRandomString(16), utilities.generateRandomString(6), orderTotal, locale);
                        const chargeRequestDirective = directiveBuilder.createChargeDirective(payload, token);
                        utilities.debug(`Created directive for charge ${JSON.stringify(chargeRequestDirective)}`);
                        resolve(handlerInput.responseBuilder
                            .addDirective(chargeRequestDirective)
                            .withShouldEndSession(true)
                            .getResponse());
                    })
                    .catch((error) => {
                        reject(error);
                    })
            });

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

        const statusCode = handlerInput.requestEnvelope.request.status.code;
        if(statusCode == 400){
            // E.g. IPM error due to previous IPM decline on the BA without a customer reacting (if this happens all over in Sandbox, please manually close the agreement)
            const payload = handlerInput.requestEnvelope.request.payload;
            const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            let errorMessage = requestAttributes.t("PAYMENT_ERROR");
            if(payload.errorCode && payload.errorCode === "InvalidPaymentMethod"){
                errorMessage = requestAttributes.t("PAYMENT_IPM_REPEAT");
            }

            return handlerInput.responseBuilder
                .speak(errorMessage)
                .withShouldEndSession(true)
                .getResponse();
        }
        const payload = handlerInput.requestEnvelope.request.payload;
        const authorizationDetails = payload.authorizationDetails;

        const authorizationId = authorizationDetails.amazonAuthorizationId;
        const authorizationStatus = authorizationDetails.authorizationStatus;

        if (authorizationStatus.state != "Declined") {
            utilities.debug('Transaction was successful, sending ticket reference and thank customer');

            return new Promise((resolve, reject) => {
                handlerInput.attributesManager.getPersistentAttributes()
                    .then((attributes) => {
                        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
                        const count = attributes.count;
                        const locale = handlerInput.requestEnvelope.request.locale;
                        const regionalConfig = config.REGIONAL[locale];
                        const orderTotal = count * regionalConfig.TICKET_PRICE;
                        const speechOutput = requestAttributes.t('THANK_YOU');
                        const cardTitle = requestAttributes.t('CARD_TITLE');
                        const cardContent = requestAttributes.t('SUCCESS_DETAILS_CARD')
                            .replace("$count$", count)
                            .replace("$orderTotal$", orderTotal)
                            .replace("$reference$", utilities.generateRandomString(7));
                        resolve(handlerInput.responseBuilder
                            .speak(speechOutput)
                            .withSimpleCard(cardTitle, cardContent)
                            .getResponse());
                    })
                    .catch((error) => {
                        reject(error);
                    })
            });
        } else {
            utilities.debug('Transaction was declined, handling...');

            const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            const speechOutput = requestAttributes.t('PAYMENT_DECLINED');
            return handlerInput.responseBuilder
                .speak(speechOutput)
                .withShouldEndSession(true)
                .getResponse();
        }
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
        const speechOutput = requestAttributes.t('PAYMENT_ERROR');

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .withShouldEndSession(true)
            .getResponse();
    },
};

// Finding the locale of the user
const LocalizationInterceptor = {
    process(handlerInput) {
        const attributes = handlerInput.attributesManager.getRequestAttributes();
        attributes.t = function (...args) {
        const localizationClient = localization.getClientForPrompts(handlerInput.requestEnvelope.request.locale);
            return localizationClient.t(...args);
        };
    },
};

const SaveSlotsInterceptor = {

    process(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        if (request.type === 'IntentRequest'
            && request.intent.name === 'BuyTicketIntent'
            && request.dialogState !== 'COMPLETED'
            && request.intent.confirmationStatus === "CONFIRMED") {

            let count = request.intent.slots.count.value;
            utilities.debug(`Saving persistent attribute count with value: ${count}`);
            return new Promise((resolve, reject) => {
                handlerInput.attributesManager.getPersistentAttributes()
                    .then((attributes) => {
                        attributes['count'] = count;
                        handlerInput.attributesManager.setPersistentAttributes(attributes);
                        utilities.debug(`Saving persistent attributes : ${attributes['count']}`);

                        return handlerInput.attributesManager.savePersistentAttributes();
                    })
                    .then(() => {
                        resolve();
                    })
                    .catch((error) => {
                        utilities.debug(`${error}`);
                        reject(error);
                    });
            });
        }
    }
};


const skillBuilder = Alexa.SkillBuilders.standard();

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
    .addRequestInterceptors(LocalizationInterceptor, SaveSlotsInterceptor)
    .addErrorHandlers(ErrorHandler)
    .withTableName('AP_ASK_v2')
    .withAutoCreateTable(true)
    .withDynamoDbClient()
    .lambda();
