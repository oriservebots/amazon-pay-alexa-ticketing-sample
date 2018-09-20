let config = require('config').AMAZON_PAY

const setupPayloadVersioning = {
    type: 'SetupAmazonPayRequest',
    version: "2"
}

const processPayloadVersioning = {
    type: 'ChargeAmazonPayRequest',
    version: "2"
}

var setupPayload = function (language) {

    var payload = {};
    payload['@type'] = setupPayloadVersioning.type;
    payload['@version'] = setupPayloadVersioning.version;
    payload['sellerId'] = config.MERCHANT_ID;
    payload['countryOfEstablishment'] = config.COUNTRY_OF_ESTABLISHMENT;
    payload['ledgerCurrency'] = config.LEDGER_CURRENCY
    payload['checkoutLanguage'] = language
    payload['billingAgreementAttributes'] = {
        "@type": "BillingAgreementAttributes",
        "@version": "2",
        "sellerNote": config.SELLER_NOTE,
        "sellerBillingAgreementAttributes" : createBillingAgreementAttributes()
    }
    payload['sandboxCustomerEmailId'] = config.SANDBOX_CUSTOMER_EMAIL;
    payload['sandboxMode'] = config.SANDBOX;
    payload['needAmazonShippingAddress'] = config.NEED_AMAZON_SHIPPING_ADDRESS;

    return payload;
};

var createBillingAgreementAttributes = function() {
    var attributes = {};
    attributes['@type'] = 'SellerBillingAgreementAttributes';
    attributes['@version'] = "2";
    //attributes['sellerBillingAgreementId'] = SOME RANDOM STRING;
    attributes['storeName'] = config.STORE_NAME;
    attributes['customInformation'] = config.CUSTOM_INFO;
    return attributes;
};


var chargePayload = function (billingAgreementId, authorizationReferenceId, sellerOrderId, amount, token) {
    
    var payload = {};
    payload['@type'] = processPayloadVersioning.type;
    payload['@version'] = processPayloadVersioning.version;
    payload['sellerId'] = config.MERCHANT_ID;
    payload['billingAgreementId'] = billingAgreementId;
    payload['paymentAction'] = config.PAYMENT_ACTION;
    payload['authorizeAttributes'] = {
        "@type": "AuthorizeAttributes",
        "@version": "2",
        "authorizationReferenceId": authorizationReferenceId,
        "authorizationAmount": {
            "@type": "Price",
            "@version": "2",
            "amount": amount.toString(),
            "currencyCode": "EUR" //config.LEDGER_CURRENCY
        },
        'transactionTimeout': config.TRANSACTION_TIMEOUT,
        "sellerAuthorizationNote": config.SELLER_AUTH_NOTE,
        "softDescriptor": config.AUTH_SOFT_DESCRIPTOR,
    }
    payload['sellerOrderAttributes'] = {
        "@type": "SellerOrderAttributes",
        "@version": "2",
        'sellerOrderId': sellerOrderId,
        "storeName": config.STORE_NAME,
        'customInformation': config.CUSTOM_INFO,
        'sellerNote': config.SELLER_NOTE
    }
    return payload;
};


module.exports = {
    'setupPayload': setupPayload,
    'chargePayload': chargePayload
};
