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
const isConsentGranted = require('isConsentGranted');
const getTimestampMillis = require('getTimestampMillis');
const generateRandom = require('generateRandom');
const copyFromWindow = require('copyFromWindow');
const setInWindow = require('setInWindow');

let pageLocation = getUrl();

if (
  pageLocation &&
  pageLocation.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0
) {
  data.gtmOnSuccess();

  return;
}

const userAndCustomData = getUserAndCustomDataArray();
let requestType = determinateRequestType();

const normalizedServerUrl = normalizeServerUrl();

if (requestType === 'post') {
  const dataScriptVersion = 'v8';
  const dataTagScriptUrl =
    typeof data.data_tag_load_script_url !== 'undefined'
      ? data.data_tag_load_script_url.replace(
          '${data-script-version}',
          dataScriptVersion
        )
      : 'https://stapecdn.com/dtag/' + dataScriptVersion + '.js';
  injectScript(
    dataTagScriptUrl,
    sendPostRequest,
    data.gtmOnFailure,
    dataTagScriptUrl
  );
} else {
  sendGetRequest();
}

function sendPostRequest() {
  let eventData = {};

  eventData = addCommonDataForPostRequest(data, eventData);
  eventData = addRequiredDataForPostRequest(data, eventData);
  eventData = addGaRequiredData(data, eventData);

  callInWindow(
    'dataTagSendData',
    eventData,
    normalizedServerUrl.gtmServerDomain,
    normalizedServerUrl.requestPath +
      '?v=' +
      eventData.v +
      '&event=' +
      encodeUriComponent(eventData.event_name) +
      (data.richsstsse ? '&richsstsse' : ''),
    data.dataLayerEventName,
    data.dataLayerVariableName,
    data.waitForCookies,
    data.useFetchInsteadOfXHR
  );

  data.gtmOnSuccess();
}

function sendGetRequest() {
  sendPixel(
    addDataForGetRequest(data, buildEndpoint()),
    data.gtmOnSuccess,
    data.gtmOnFailure
  );
}

function normalizeServerUrl() {
  let gtmServerDomain = data.gtm_server_domain;
  let requestPath = data.request_path;

  // Add 'https://' if gtmServerDomain doesn't start with it
  if (gtmServerDomain.indexOf('http://') !== 0 && gtmServerDomain.indexOf('https://') !== 0) {
    gtmServerDomain = 'https://' + gtmServerDomain;
  }

  // Removes trailing slash from gtmServerDomain if it ends with it
  if (gtmServerDomain.charAt(gtmServerDomain.length - 1) === '/') {
    gtmServerDomain = gtmServerDomain.slice(0, -1);
  }

  // Adds slash to first position of requestPath if doesn't start with it
  if (requestPath.charAt(0) !== '/') {
    requestPath = '/' + requestPath;
  }

  return {
    gtmServerDomain: gtmServerDomain,
    requestPath: requestPath
  };
}

function buildEndpoint() {
  return normalizedServerUrl.gtmServerDomain + normalizedServerUrl.requestPath;
}

function addRequiredDataForPostRequest(data, eventData) {
  eventData.event_name = getEventName(data);
  eventData.v = makeNumber(data.protocol_version);

  let customData = getCustomData(data, true);

  for (let key in customData) {
    eventData[customData[key].name] = customData[key].value;
  }

  eventData = addTempClientId(eventData);

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
  url +=
    '?v=' +
    data.protocol_version +
    '&event=' +
    encodeUriComponent(getEventName(data));

  if (data.add_common) {
    eventData = addCommonData(data, eventData);
  }

  if (data.add_consent_state) {
    eventData = addConsentStateData(eventData);
  }

  if (data.add_common_cookie) {
    eventData = addCommonCookie(eventData);
  }

  let customData = getCustomData(data, false);

  if (customData.length) {
    for (let customDataKey in customData) {
      eventData[customData[customDataKey].name] =
        customData[customDataKey].value;
    }
  }

  eventData = addTempClientId(eventData);

  if (data.request_type === 'auto') {
    return (
      url + '&dtdc=' + encodeUriComponent(toBase64(JSON.stringify(eventData)))
    );
  }

  for (let eventDataKey in eventData) {
    url +=
      '&' +
      eventDataKey +
      '=' +
      (eventData[eventDataKey]
        ? encodeUriComponent(eventData[eventDataKey])
        : '');
  }

  return url;
}

function addCommonDataForPostRequest(data, eventData) {
  if (data.add_common || data.add_data_layer) {
    const dataTagData = callInWindow(
      'dataTagGetData',
      getContainerVersion()['containerId']
    );

    if (data.add_data_layer && dataTagData.dataModel) {
      for (let dataKey in dataTagData.dataModel) {
        eventData[dataKey] = dataTagData.dataModel[dataKey];
      }
    }

    if (data.add_common) {
      eventData = addCommonData(data, eventData);
      eventData.screen_resolution =
        dataTagData.screen.width + 'x' + dataTagData.screen.height;
      eventData.viewport_size =
        dataTagData.innerWidth + 'x' + dataTagData.innerHeight;
    }
  }
  if (data.add_consent_state) {
    eventData = addConsentStateData(eventData);
  }

  if (data.add_common_cookie) {
    eventData = addCommonCookie(eventData);
  }

  return eventData;
}

function addCommonData(data, eventData) {
  eventData.page_location = getUrl();
  eventData.page_hostname = getUrl('host');
  eventData.page_referrer = getReferrerUrl();
  eventData.page_title = readTitle();
  eventData.page_encoding = readCharacterSet();

  return eventData;
}

function addConsentStateData(eventData) {
  eventData.consent_state = {
    ad_storage: isConsentGranted('ad_storage'),
    ad_user_data: isConsentGranted('ad_user_data'),
    ad_personalization: isConsentGranted('ad_personalization'),
    analytics_storage: isConsentGranted('analytics_storage'),
    functionality_storage: isConsentGranted('functionality_storage'),
    personalization_storage: isConsentGranted('personalization_storage'),
    security_storage: isConsentGranted('security_storage'),
  };
  return eventData;
}

function addTempClientId(eventData) {
  const tempClientIdStorageKey = 'gtm_dataTagTempClientId';
  const tempClientId = copyFromWindow(tempClientIdStorageKey) || 
    'dcid.1.' +
    getTimestampMillis() +
    '.' +
    generateRandom(100000000, 999999999);
  
  eventData._dcid_temp = tempClientId;
  setInWindow(tempClientIdStorageKey, eventData._dcid_temp);

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
  let customData = userAndCustomData;

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
        dataValue = callInWindow(
          'dataTag256',
          dataValue.trim().toLowerCase(),
          'B64'
        );
      }

      if (dtagLoaded && dataTransformation === 'sha256hex') {
        dataValue = makeString(dataValue);
        dataValue = callInWindow(
          'dataTag256',
          dataValue.trim().toLowerCase(),
          'HEX'
        );
      }

      if (customData[dataKey].store && customData[dataKey].store !== 'none') {
        dataToStore.push({
          store: customData[dataKey].store,
          name: customData[dataKey].name,
          value: dataValue,
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
        if (dataToStoreCookie[attrName])
          dataToStoreCookieResult[attrName] = dataToStoreCookie[attrName];
      }
    }
  }

  if (localStorage) {
    let dataToStoreLocalStorage = localStorage.getItem('stape');

    if (dataToStoreLocalStorage) {
      dataToStoreLocalStorage = JSON.parse(dataToStoreLocalStorage);

      if (dataToStoreLocalStorage) {
        for (let attrName in dataToStoreLocalStorage) {
          if (dataToStoreLocalStorage[attrName])
            dataToStoreLocalStorageResult[attrName] =
              dataToStoreLocalStorage[attrName];
        }
      }
    }
  }

  for (let attrName in dataToStore) {
    if (dataToStore[attrName].value) {
      if (
        dataToStore[attrName].store === 'all' ||
        dataToStore[attrName].store === 'localStorage'
      ) {
        dataToStoreLocalStorageResult[dataToStore[attrName].name] =
          dataToStore[attrName].value;
      }

      if (
        dataToStore[attrName].store === 'all' ||
        dataToStore[attrName].store === 'cookies'
      ) {
        dataToStoreCookieResult[dataToStore[attrName].name] =
          dataToStore[attrName].value;
      }
    }
  }

  if (localStorage && getObjectLength(dataToStoreLocalStorageResult) !== 0) {
    localStorage.setItem(
      'stape',
      JSON.stringify(dataToStoreLocalStorageResult)
    );
  }

  if (getObjectLength(dataToStoreCookieResult) !== 0) {
    setCookie('stape', JSON.stringify(dataToStoreCookieResult), {
      secure: true,
      domain: 'auto',
      path: '/',
    });
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

  if (data.dataLayerEventPush) {
    return 'post';
  }

  if (data.richsstsse) {
    return 'post';
  }

  const isHashingEnabled = userAndCustomData.some(
    (item) =>
      item.transformation === 'md5' ||
      item.transformation === 'sha256base64' ||
      item.transformation === 'sha256hex'
  );

  if (isHashingEnabled) return 'post';

  const userAndCustomDataLength = makeNumber(
    JSON.stringify(userAndCustomData).length
  );
  return userAndCustomDataLength > 1500 ? 'post' : 'get';
}

function getUserAndCustomDataArray() {
  let userAndCustomDataArray = [];

  if (data.custom_data && data.custom_data.length) {
    userAndCustomDataArray = data.custom_data;
  }

  if (data.user_data && data.user_data.length) {
    for (let userDataKey in data.user_data) {
      userAndCustomDataArray.push(data.user_data[userDataKey]);
    }
  }
  return userAndCustomDataArray;
}

function addCommonCookie(eventData) {
  const cookieNames = [
    // FB cookies
    '_fbc',
    '_fbp',
    '_gtmeec',
    // TikTok cookies
    'ttclid',
    '_ttp',
    // Pinterest cookies
    '_epik',
    // Snapchat cookies
    '_scid',
    '_scclid',
    // Taboola cookies
    'taboola_cid',
    // Awin cookies
    'awin_awc',
    'awin_sn_awc',
    'awin_source',
    // Rakuten cookies
    'rakuten_site_id',
    'rakuten_time_entered',
    'rakuten_ran_mid',
    'rakuten_ran_eaid',
    'rakuten_ran_site_id',
    // Klaviyo cookies
    'stape_klaviyo_email',
    'stape_klaviyo_kx',
    'stape_klaviyo_viewed_items',
    // Outbrain cookies
    'outbrain_cid',
    // Webgains cookies
    'wg_cid',
    // Postscript cookies
    'ps_id',
    // Microsoft UET CAPI cookies
    'uet_msclkid', '_uetmsclkid',
    'uet_vid', '_uetvid'
  ];
  let commonCookie = null;

  for (var i = 0; i < cookieNames.length; i++) {
    const name = cookieNames[i];
    var cookie = getCookieValues(name)[0];
    if (cookie) {
      commonCookie = commonCookie || {};
      commonCookie[name] = cookie;
    }
  }
  if (commonCookie) {
    eventData.common_cookie = commonCookie;
  }
  return eventData;
}