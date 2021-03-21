const copyFromDataLayer = require('copyFromDataLayer');
const copyFromWindow = require('copyFromWindow');
const JSON = require('JSON');
const getUrl = require('getUrl');
const getReferrerUrl = require('getReferrerUrl');
const readTitle = require('readTitle');
const injectScript = require('injectScript');
const callInWindow = require('callInWindow');
const queryPermission = require('queryPermission');
const makeNumber = require('makeNumber');
const readCharacterSet = require('readCharacterSet');
const localStorage = require('localStorage');
const sendPixel = require('sendPixel');
const encodeUriComponent = require('encodeUriComponent');

if (data.request_type === 'post') {
    const dataTagScriptUrl = 'https://cdn.gtm-server.com/dtag.js';

    if (queryPermission('inject_script', dataTagScriptUrl)) {
        injectScript(dataTagScriptUrl, sendPostRequest, data.gtmOnFailure, dataTagScriptUrl);
    } else {
        data.gtmOnFailure();
    }
} else {
    sendGetRequest();
}

function sendPostRequest() {
    let eventData = {};

    eventData = addDataLayerDataForPostRequest(data, eventData);
    eventData = addCommonDataForPostRequest(data, eventData);
    eventData = addRequiredDataForPostRequest(data, eventData);

    callInWindow('dataTagSendData', eventData, buildEndpoint(), data.gtm_server_preview_header);
    data.gtmOnSuccess();
}

function sendGetRequest() {
    let url = buildEndpoint();

    url = addRequiredDataForGetRequest(data, url);
    url = addCommonDataForGetRequest(data, url);

    sendPixel(url, data.gtmOnSuccess, data.gtmOnFailure);
}

function getDtclid() {
    if (localStorage) {
        const dtclid = localStorage.getItem('dtclid');

        return dtclid ? dtclid : '';
    }

    return '';
}

function buildEndpoint() {
    return 'https://' + data.gtm_server_domain + data.request_path;
}

function addRequiredDataForPostRequest(data, eventData) {
    eventData.event_name = getEventName(data);
    eventData.protocol_version = makeNumber(data.protocol_version);
    eventData.data_tag = true;
    eventData.data_tag_custom_data = getCustomData(data);
    eventData.dtclid = getDtclid();

    return eventData;
}

function addRequiredDataForGetRequest(data, url) {
    url = url + '?event_name=' + encodeUriComponent(getEventName(data)) + '&dtclid=' + encodeUriComponent(getDtclid()) + '&v=' + makeNumber(data.protocol_version);

    let customData = getCustomData(data);

    if (customData.length) {
        for (let customDataKey in customData) {
            url = url + '&' + customData[customDataKey].name + '=' + encodeUriComponent(customData[customDataKey].value);
        }
    }

    return url;
}

function addDataLayerDataForPostRequest(data, eventData) {
    if (data.add_data_layer) {
        const gtmId = copyFromDataLayer('gtm.uniqueEventId');
        const dataLayer = copyFromWindow('dataLayer');

        if (dataLayer && gtmId) {
            let obj = dataLayer.map(o => {
                if (o['gtm.uniqueEventId']) return o;

                o = JSON.parse(JSON.stringify(o));

                for (let prop in o) {
                    return o[prop];
                }
            }).filter(o => {
                if (o['gtm.uniqueEventId'] === gtmId) return true;
            });

            if (obj.length) {
                obj = obj[0];

                for (let objKey in obj) {
                    eventData[objKey] = obj[objKey];
                }
            }
        }

    }

    return eventData;
}

function addCommonDataForPostRequest(data, eventData) {
    if (data.add_common) {
        const dataTagData = callInWindow('dataTagGetData');

        eventData = addCommonData(data, eventData);
        eventData.screen_resolution = dataTagData.screen.width + 'x' + dataTagData.screen.height;
        eventData.viewport_size = dataTagData.innerWidth + 'x' + dataTagData.innerHeight;
    }

    return eventData;
}

function addCommonDataForGetRequest(data, url) {
    if (data.add_common) {
        let eventData = {};
        eventData = addCommonData(data, eventData);

        for (let eventDataKey in eventData) {
            url = url + '&' + eventDataKey + '=' + encodeUriComponent(eventData[eventDataKey]);
        }
    }

    return url;
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
    let eventName = 'page_view';

    if (data.event_type === 'standard') {
        return data.event_name_standard ? data.event_name_standard : eventName;
    }

    if (data.event_type === 'custom') {
        return data.event_name_custom ? data.event_name_custom : eventName;
    }

    return eventName;
}

function getCustomData(data) {
    let customData = [];

    if (data.custom_data && data.custom_data.length) {
        customData = data.custom_data;
    }

    if (data.user_data && data.user_data.length) {
        for (let userDataKey in data.user_data) {
            customData.push(data.user_data[userDataKey]);
        }
    }

    return customData;
}
