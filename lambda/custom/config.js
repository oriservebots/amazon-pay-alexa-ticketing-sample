
exports.ENV_CONFIG = {
    debug: true
};

exports.AMAZON_PAY = {

    GENERAL: {
        VERSION: "2.0",
        NEED_AMAZON_SHIPPING_ADDRESS: true,
        PAYMENT_ACTION: "AuthorizeAndCapture",
        TRANSACTION_TIMEOUT: 0,
        PLATFORM_ID: undefined
    },
    REGIONAL: {
        "en-US": {
            MERCHANT_ID: "",
            COUNTRY_OF_ESTABLISHMENT: "US",
            LEDGER_CURRENCY: "USD",
            SANDBOX_CUSTOMER_EMAIL: "",
            SANDBOX: true,
            TICKET_PRICE: 6
        },
        "en-GB":{
            MERCHANT_ID: "",
            COUNTRY_OF_ESTABLISHMENT: "GB",
            LEDGER_CURRENCY: "GBP",
            SANDBOX_CUSTOMER_EMAIL: "",
            SANDBOX: true,
            TICKET_PRICE: 6
        },
        "de-DE": {
            MERCHANT_ID: "",
            COUNTRY_OF_ESTABLISHMENT: "DE",
            LEDGER_CURRENCY: "EUR",
            SANDBOX_CUSTOMER_EMAIL: "",
            SANDBOX: true,
            TICKET_PRICE: 6
        }
    },    
};