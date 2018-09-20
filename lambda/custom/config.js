
exports.ENV_CONFIG = {
    debug: true
};

exports.AMAZON_PAY = {

    //GENERAL
    MERCHANT_ID: "",
    VERSION: "2.0",
    COUNTRY_OF_ESTABLISHMENT: "DE",
    LEDGER_CURRENCY: "EUR",
    NEED_AMAZON_SHIPPING_ADDRESS: false,
    SANDBOX_CUSTOMER_EMAIL: "",
    SANDBOX: true,
    TICKET_PRICE: 6,

    // PROCESS PAYMENT
    PAYMENT_ACTION: "AuthorizeAndCapture",


    // AUTHORIZE ATTRIBUTES
    SELLER_AUTH_NOTE: "Thank you.",
    AUTH_SOFT_DESCRIPTOR: 'AP ASK v2',	// Optional; Max 16 chars, should indicate who the merchant is
    TRANSACTION_TIMEOUT: 0,

    // SELLER ORDER ATTRIBUTES
    CUSTOM_INFO: "custom information",
    SELLER_NOTE: "",
    STORE_NAME: "AP ASK v2"

};

// ERROR RESPONSE STRINGS - Optional just for demo purposes
exports.AMAZON_PAY_ERRORS = {
    errorMessage: 'Merchant error occurred. ',
    errorUnknown: 'Unknown error occurred. ',
    errorStatusCode: 'Status code: ',
    errorStatusMessage: ' Status message: ',
    errorPayloadMessage: ' Payload message: ',
    errorBillingAgreement: 'Billing agreement state is ',
    errorBillingAgreementMessage: '. Reach out to the user to resolve this issue.',
    authorizationDeclineMessage: 'Your order was not placed and you have not been charged.'
};
