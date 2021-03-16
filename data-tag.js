function dataTagSendData(data, endpoint, gtmServerPreviewHeader) {
    var xhr = new XMLHttpRequest();
    var stringifiedData = JSON.stringify(data);

    xhr.open('POST', endpoint);
    xhr.setRequestHeader('Content-type', 'application/json');
    if (gtmServerPreviewHeader) {
        xhr.setRequestHeader('x-gtm-server-preview', gtmServerPreviewHeader);
    }
    xhr.send(stringifiedData);

    xhr.onload = function () {
        if (xhr.status.toString()[0] !== '2') {
            console.error(xhr.status + '> ' + xhr.statusText);
        } else if (dataTagStorageAvailable()) {
            var jsonResponse = JSON.parse(xhr.responseText);

            localStorage.setItem('dtclid', jsonResponse.client_id);
        }
    };
}

function dataTagGetData() {
    window.dataTagData = {
        document: {
            characterSet: window.document.characterSet,
        },
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        screen: {
            width: window.screen.width,
            height: window.screen.height,
        },
    };

    return window.dataTagData;
}

function dataTagStorageAvailable() {
    try {
        var storage = window['localStorage'],
            x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    }
    catch(e) {
        return e instanceof DOMException && (
            // everything except Firefox
            e.code === 22 ||
            // Firefox
            e.code === 1014 ||
            // test name field too, because code might not be present
            // everything except Firefox
            e.name === 'QuotaExceededError' ||
            // Firefox
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
            // acknowledge QuotaExceededError only if there's something already stored
            storage && storage.length !== 0;
    }
}
