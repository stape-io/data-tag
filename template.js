const copyFromDataLayer = require('copyFromDataLayer');
const JSON = require('JSON');
const getUrl = require('getUrl');
const getReferrerUrl = require('getReferrerUrl');
const readTitle = require('readTitle');
const injectScript = require('injectScript');
const callInWindow = require('callInWindow');
const makeNumber = require('makeNumber');
const readCharacterSet = require('readCharacterSet');
const localStorage = require('localStorage');
const sendPixel = require('sendPixel');
const encodeUriComponent = require('encodeUriComponent');
const toBase64 = require('toBase64');
const makeString = require('makeString');
const setCookie = require('setCookie');
const getCookieValues = require('getCookieValues');
const getContainerVersion = require('getContainerVersion');

let pageLocation = getUrl();

if (pageLocation && pageLocation.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
    data.gtmOnSuccess();

    return;
}

let requestType = determinateRequestType();

if (requestType === 'post') {
    const dataTagScriptUrl = 'https://cdn.stape.io/dtag/v4.js';
    injectScript(dataTagScriptUrl, sendPostRequest, data.gtmOnFailure, dataTagScriptUrl);
} else {
    sendGetRequest();
}

function sendPostRequest() {
    let eventData = {};

    eventData = addCommonDataForPostRequest(data, eventData);
    eventData = addRequiredDataForPostRequest(data, eventData);
    eventData = addGaRequiredData(data, eventData);

    callInWindow('dataTagSendData', eventData, buildEndpoint()+'?v=' + eventData.v + '&event_name=' + encodeUriComponent(eventData.event_name));
    data.gtmOnSuccess();
}

function sendGetRequest() {
    sendPixel(addDataForGetRequest(data, buildEndpoint()), data.gtmOnSuccess, data.gtmOnFailure);
}

function buildEndpoint() {
    return data.gtm_server_domain + data.request_path;
}

function addRequiredDataForPostRequest(data, eventData) {
    eventData.event_name = getEventName(data);
    eventData.v = makeNumber(data.protocol_version);

    let customData = getCustomData(data, true);

    for (let key in customData) {
        eventData[customData[key].name] = customData[key].value;
    }

    return eventData;
}

function addGaRequiredData(data, eventData) {
    if (data.addGaParameters && data.gaId) {
        eventData['x-ga-measurement_id'] = data.gaId;
        eventData['x-ga-page_id'] = copyFromDataLayer('gtm.start');
        eventData['x-ga-mp2-richsstsse'] = '';
        eventData['x-ga-mp2-seg'] = 1;
        eventData['x-ga-request_count'] = 1;
        eventData['x-ga-protocol_version'] = 2;
        eventData.v = 2;
    }

    return eventData;
}

function addDataForGetRequest(data, url) {
    let eventData = {};
    url += '?v=' + data.protocol_version + '&event_name=' + encodeUriComponent(getEventName(data));

    if (data.add_common) {
        eventData = addCommonData(data, eventData);
    }

    let customData = getCustomData(data, false);

    if (customData.length) {
        for (let customDataKey in customData) {
            eventData[customData[customDataKey].name] = customData[customDataKey].value;
        }
    }

    if (data.request_type === 'auto') {
        return url + '&dtdc=' + encodeUriComponent(toBase64(JSON.stringify(eventData)));
    }

    for (let eventDataKey in eventData) {
        url += '&' + eventDataKey + '=' + (eventData[eventDataKey] ? encodeUriComponent(eventData[eventDataKey]) : '');
    }

    return url;
}

function addCommonDataForPostRequest(data, eventData) {
    if (data.add_common || data.add_data_layer) {
        const dataTagData = callInWindow('dataTagGetData', getContainerVersion()['containerId']);

        if (data.add_data_layer && dataTagData.dataModel) {
            for (let dataKey in dataTagData.dataModel) {
                eventData[dataKey] = dataTagData.dataModel[dataKey];
            }
        }

        if (data.add_common) {
            eventData = addCommonData(data, eventData);
            eventData.screen_resolution = dataTagData.screen.width + 'x' + dataTagData.screen.height;
            eventData.viewport_size = dataTagData.innerWidth + 'x' + dataTagData.innerHeight;
        }
    }

    return eventData;
}

function addCommonData(data, eventData) {
    eventData.page_location = getUrl();
    eventData.page_path = getUrl('path');
    eventData.page_hostname = getUrl('host');
    eventData.page_referrer = getReferrerUrl();
    eventData.page_title = readTitle();
    eventData.page_encoding = readCharacterSet();

    return eventData;
}

function getEventName(data) {
    const eventName = 'page_view';

    if (data.event_type === 'standard') {
        return data.event_name_standard ? data.event_name_standard : eventName;
    }

    if (data.event_type === 'custom') {
        return data.event_name_custom ? data.event_name_custom : eventName;
    }

    return eventName;
}

function getCustomData(data, dtagLoaded) {
    let dataToStore = [];
    let customData = [];

    if (data.custom_data && data.custom_data.length) {
        customData = data.custom_data;
    }

    if (data.user_data && data.user_data.length) {
        for (let userDataKey in data.user_data) {
            customData.push(data.user_data[userDataKey]);
        }
    }

    for (let dataKey in customData) {
        let dataValue = customData[dataKey].value;
        let dataTransformation = customData[dataKey].transformation;

        if (dataValue) {
            if (dataTransformation === 'trim') {
                dataValue = makeString(dataValue);
                dataValue = dataValue.trim();
            }

            if (dataTransformation === 'to_lower_case') {
                dataValue = makeString(dataValue);
                dataValue = dataValue.trim().toLowerCase();
            }

            if (dataTransformation === 'base64') {
                dataValue = makeString(dataValue);
                dataValue = toBase64(dataValue);
            }

            if (dtagLoaded && dataTransformation === 'md5') {
                dataValue = makeString(dataValue);
                dataValue = callInWindow('dataTagMD5', dataValue.trim().toLowerCase());
            }

            if (dtagLoaded && dataTransformation === 'sha256base64') {
                dataValue = makeString(dataValue);
                dataValue = callInWindow('dataTag256', dataValue.trim().toLowerCase(), 'B64');
            }

            if (dtagLoaded && dataTransformation === 'sha256hex') {
                dataValue = makeString(dataValue);
                dataValue = callInWindow('dataTag256', dataValue.trim().toLowerCase(), 'HEX');
            }

            if (customData[dataKey].store && customData[dataKey].store !== 'none') {
                dataToStore.push({
                    'store': customData[dataKey].store,
                    'name': customData[dataKey].name,
                    'value': dataValue,
                });
            }

            customData[dataKey].value = dataValue;
        }
    }

    if (dataToStore.length !== 0) {
        storeData(dataToStore);
    }

    return customData;
}

function storeData(dataToStore) {
    let dataToStoreCookieResult = {};
    let dataToStoreLocalStorageResult = {};
    let dataToStoreCookie = getCookieValues('stape')[0];

    if (dataToStoreCookie) {
        dataToStoreCookie = JSON.parse(dataToStoreCookie);

        if (dataToStoreCookie) {
            for (let attrName in dataToStoreCookie) {
                if (dataToStoreCookie[attrName]) dataToStoreCookieResult[attrName] = dataToStoreCookie[attrName];
            }
        }
    }

    if (localStorage) {
        let dataToStoreLocalStorage = localStorage.getItem('stape');

        if (dataToStoreLocalStorage) {
            dataToStoreLocalStorage = JSON.parse(dataToStoreLocalStorage);

            if (dataToStoreLocalStorage) {
                for (let attrName in dataToStoreLocalStorage) {
                    if (dataToStoreLocalStorage[attrName]) dataToStoreLocalStorageResult[attrName] = dataToStoreLocalStorage[attrName];
                }
            }
        }
    }

    for (let attrName in dataToStore) {
        if (dataToStore[attrName].value) {
            if (dataToStore[attrName].store === 'all' || dataToStore[attrName].store === 'localStorage') {
                dataToStoreLocalStorageResult[dataToStore[attrName].name] = dataToStore[attrName].value;
            }

            if (dataToStore[attrName].store === 'all' || dataToStore[attrName].store === 'cookies') {
                dataToStoreCookieResult[dataToStore[attrName].name] = dataToStore[attrName].value;
            }
        }
    }

    if (localStorage && getObjectLength(dataToStoreLocalStorageResult) !== 0) {
        localStorage.setItem('stape', JSON.stringify(dataToStoreLocalStorageResult));
    }

    if (getObjectLength(dataToStoreCookieResult) !== 0) {
        setCookie('stape', JSON.stringify(dataToStoreCookieResult), {secure: true, domain: 'auto', path: '/'});
    }
}

function getObjectLength(object) {
    let length = 0;

    for (let key in object) {
        if (object.hasOwnProperty(key)) {
            ++length;
        }
    }
    return length;
}

function determinateRequestType() {
    if (data.request_type !== 'auto') {
        return data.request_type;
    }

    if (data.add_data_layer) {
        return 'post';
    }

    let customDataLength = 0;
    let userDataLength = 0;

    if (data.custom_data && data.custom_data.length) customDataLength = makeNumber(JSON.stringify(data.custom_data).length);
    if (data.user_data && data.user_data.length) userDataLength = makeNumber(JSON.stringify(data.user_data).length);

    return (customDataLength + userDataLength) > 1500 ? 'post' : 'get';
}
