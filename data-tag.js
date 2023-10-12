// polyfill for String.startsWith()
if (!String.prototype.startsWith) {
    Object.defineProperty(String.prototype, 'startsWith', {
        value: function(search, rawPos) {
            var pos = rawPos > 0 ? rawPos|0 : 0;
            return this.substring(pos, pos + search.length) === search;
        }
    });
}

function dataTagParseResponse(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return {
            'body': str,
        };
    }
}

function dataTagSendData(data, gtmServerDomain, requestPath, dataLayerEventName, dataLayerVariableName, waitForCookies, useFetchInsteadOfXHR) {
    dataLayerEventName = dataLayerEventName || false;
    dataLayerVariableName = dataLayerVariableName || false;
    waitForCookies = waitForCookies || false;

    var replaceVariable = function(a, b) {
            return a.replace(/\$\{([^\}]+)\}/g, function(c, d) {
                return b[d] || c
            })
        },
        sendPixel = function(url) {
            var img = new Image(1, 1);
            if (url.startsWith(((gtmServerDomain.charAt(gtmServerDomain.length - 1) === '/') ? gtmServerDomain.slice(0, -1) : gtmServerDomain) + '/_set_cookie')) {
                setCookieRunningCount++;
                img.onload = img.onerror = function() {
                    img.onload = img.onerror = null;
                    setCookieRunningCount--;
                    if ( (xhr.readyState === 4) // server container must be finished to be sure no more cookies will be received
                      && dataLayerEventName && dataLayerVariableName // data tag configured to push event
                      && waitForCookies // data tag configured to wait for cookies
                      && (setCookieRunningCount === 0) // all cookies already set
                    ) {
                        pushToDataLayer();
                    }
                };
            }
            img.src = url
        },
        sendBeacon = function(url) {
            var sendBeaconResult;
            try {
                sendBeaconResult = navigator.sendBeacon && navigator.sendBeacon(url)
            } catch (e) {}
            sendBeaconResult || sendPixel(url)
        },
        fallbackIterator = function(a) {
            var b = 0;
            return function() {
                return b < a.length ? {
                    done: !1,
                    value: a[b++]
                } : {
                    done: !0
                }
            }
        },
        pushToDataLayer = function() {
            window[dataLayerVariableName] = window[dataLayerVariableName] || [];
            eventDataLayerData.event = dataLayerEventName;
            window[dataLayerVariableName].push(eventDataLayerData);
        },
        stringifiedData = JSON.stringify(data),
        response = "",
        loaded = 0,
        replacements = {transport_url: gtmServerDomain},
        eventDataLayerData = {},
        setCookieRunningCount = 0,
        processResponseDataEvent = function(event) {
          if (event) {
            var sendPixelArr = event.send_pixel || [],
              i;
            if (Array.isArray(sendPixelArr))
              for (i = 0; i < sendPixelArr.length; i++) sendPixel(sendPixelArr[i]);

            var sendBeaconArr = event.send_beacon || [];
            if (Array.isArray(sendBeaconArr))
              for (i = 0; i < sendBeaconArr.length; i++) sendBeacon(sendBeaconArr[i])

            if (typeof event.response === 'object') {
              var status = event.response.status_code || 0,
                body = event.response.body || {},
                parsedBody = dataTagParseResponse(body);

              // merge parsedBody into eventDataLayerData instead of assignment
              // (just in case multiple responses will be supported by gtm in the future)
              for (var key in parsedBody) {
                if (parsedBody.hasOwnProperty(key)) {
                  eventDataLayerData[key] = parsedBody[key];
                }
              }
              eventDataLayerData.status = status;
            }
          }
        };

    if(useFetchInsteadOfXHR) {
      fetch(gtmServerDomain + requestPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        credentials: 'include',
        keepalive: true,
        body: stringifiedData,
      })
        .then(function (response) {
          response.text().then(function (responseText) {
            if(responseText && responseText.startsWith("event: message\ndata: ")) {
              responseText
                .split("\n\n")
                .filter(function(eventString) {
                  return eventString;  // Filter out empty strings
                })
                .forEach(function(eventString) {
                  try {
                    const event =  JSON.parse(eventString.replace('event: message\ndata: ', ''));
                    processResponseDataEvent(event);
                  } catch (error) {
                    console.error('Error processing response data:', error);
                  }
                });
            }
            if (dataLayerEventName && dataLayerVariableName) { // data tag configured to push event
              if (!responseText || !responseText.startsWith("event: message\ndata: ")) { // old protocol
                eventDataLayerData = dataTagParseResponse(responseText);
                eventDataLayerData.status = response.status;
                pushToDataLayer();
              } else if (
                !waitForCookies // data tag configured to push event instantly
                || (setCookieRunningCount === 0) // no cookies received or all cookies already set
              ) {
                pushToDataLayer();
              }
            }
          });
        })
        .catch(function (error) {
          console.error(error);
        });
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', gtmServerDomain + requestPath);
      xhr.setRequestHeader('Content-type', 'text/plain');
      xhr.withCredentials = true;

      xhr.onprogress = function(progress) {
        if ((xhr.status === 200) && xhr.responseText.startsWith("event: message\ndata: ")) {
          response += xhr.responseText.substring(loaded);
          loaded = progress.loaded;

          for (var replacedResponse = replaceVariable(response, replacements), nextSeparationPos = replacedResponse.indexOf("\n\n"); - 1 !== nextSeparationPos;) {
            var parsedData;
            a: {
              var iterableLines;
              var lines = replacedResponse.substring(0, nextSeparationPos).split("\n"),
                linesIterator = "undefined" != typeof Symbol && Symbol.iterator && lines[Symbol.iterator];
              if (linesIterator) iterableLines = linesIterator.call(lines);
              else if ("number" == typeof lines.length) iterableLines = {
                next: fallbackIterator(lines)
              };
              else throw Error(String(lines) + " is not an iterable or ArrayLike");
              var eventNameLine = iterableLines.next().value,
                eventDataLine = iterableLines.next().value;
              if (eventNameLine.startsWith("event: message") && eventDataLine.startsWith("data: ")) try {
                parsedData = JSON.parse(eventDataLine.substring(eventDataLine.indexOf(":") + 1));
                break a
              } catch (e) {}
              parsedData =
                void 0
            }
            processResponseDataEvent(parsedData);
            replacedResponse = replacedResponse.substring(nextSeparationPos + 2);
            nextSeparationPos = replacedResponse.indexOf("\n\n")
          }
        }
      };
      xhr.onload = function () {
        if (xhr.status.toString()[0] !== '2') {
          console.error(xhr.status + '> ' + xhr.statusText);
        }

        if (dataLayerEventName && dataLayerVariableName) { // data tag configured to push event
          if (!xhr.responseText.startsWith("event: message\ndata: ")) { // old protocol
            eventDataLayerData = dataTagParseResponse(xhr.responseText);
            eventDataLayerData.status = xhr.status;
            pushToDataLayer();
          } else if (
            !waitForCookies // data tag configured to push event instantly
            || (setCookieRunningCount === 0) // no cookies received or all cookies already set
          ) {
            pushToDataLayer();
          }
        }
      };
      xhr.send(stringifiedData);
    }
}

function dataTagGetData(containerId) {
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
        dataModel: window.google_tag_manager[containerId].dataLayer.get({
            split: function() { return []; }
        }),
    };

    return window.dataTagData;
}

function dataTagMD5(inputString) {
    var hc="0123456789abcdef";
    function rh(n) {var j,s="";for(j=0;j<=3;j++) s+=hc.charAt((n>>(j*8+4))&0x0F)+hc.charAt((n>>(j*8))&0x0F);return s;}
    function ad(x,y) {var l=(x&0xFFFF)+(y&0xFFFF);var m=(x>>16)+(y>>16)+(l>>16);return (m<<16)|(l&0xFFFF);}
    function rl(n,c)            {return (n<<c)|(n>>>(32-c));}
    function cm(q,a,b,x,s,t)    {return ad(rl(ad(ad(a,q),ad(x,t)),s),b);}
    function ff(a,b,c,d,x,s,t)  {return cm((b&c)|((~b)&d),a,b,x,s,t);}
    function gg(a,b,c,d,x,s,t)  {return cm((b&d)|(c&(~d)),a,b,x,s,t);}
    function hh(a,b,c,d,x,s,t)  {return cm(b^c^d,a,b,x,s,t);}
    function ii(a,b,c,d,x,s,t)  {return cm(c^(b|(~d)),a,b,x,s,t);}
    function sb(x) {
        var i;var nblk=((x.length+8)>>6)+1;var blks=new Array(nblk*16);for(i=0;i<nblk*16;i++) blks[i]=0;
        for(i=0;i<x.length;i++) blks[i>>2]|=x.charCodeAt(i)<<((i%4)*8);
        blks[i>>2]|=0x80<<((i%4)*8);blks[nblk*16-2]=x.length*8;return blks;
    }
    var i,x=sb(inputString),a=1732584193,b=-271733879,c=-1732584194,d=271733878,olda,oldb,oldc,oldd;
    for(i=0;i<x.length;i+=16) {olda=a;oldb=b;oldc=c;oldd=d;
        a=ff(a,b,c,d,x[i+ 0], 7, -680876936);d=ff(d,a,b,c,x[i+ 1],12, -389564586);c=ff(c,d,a,b,x[i+ 2],17,  606105819);
        b=ff(b,c,d,a,x[i+ 3],22,-1044525330);a=ff(a,b,c,d,x[i+ 4], 7, -176418897);d=ff(d,a,b,c,x[i+ 5],12, 1200080426);
        c=ff(c,d,a,b,x[i+ 6],17,-1473231341);b=ff(b,c,d,a,x[i+ 7],22,  -45705983);a=ff(a,b,c,d,x[i+ 8], 7, 1770035416);
        d=ff(d,a,b,c,x[i+ 9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,     -42063);b=ff(b,c,d,a,x[i+11],22,-1990404162);
        a=ff(a,b,c,d,x[i+12], 7, 1804603682);d=ff(d,a,b,c,x[i+13],12,  -40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);
        b=ff(b,c,d,a,x[i+15],22, 1236535329);a=gg(a,b,c,d,x[i+ 1], 5, -165796510);d=gg(d,a,b,c,x[i+ 6], 9,-1069501632);
        c=gg(c,d,a,b,x[i+11],14,  643717713);b=gg(b,c,d,a,x[i+ 0],20, -373897302);a=gg(a,b,c,d,x[i+ 5], 5, -701558691);
        d=gg(d,a,b,c,x[i+10], 9,   38016083);c=gg(c,d,a,b,x[i+15],14, -660478335);b=gg(b,c,d,a,x[i+ 4],20, -405537848);
        a=gg(a,b,c,d,x[i+ 9], 5,  568446438);d=gg(d,a,b,c,x[i+14], 9,-1019803690);c=gg(c,d,a,b,x[i+ 3],14, -187363961);
        b=gg(b,c,d,a,x[i+ 8],20, 1163531501);a=gg(a,b,c,d,x[i+13], 5,-1444681467);d=gg(d,a,b,c,x[i+ 2], 9,  -51403784);
        c=gg(c,d,a,b,x[i+ 7],14, 1735328473);b=gg(b,c,d,a,x[i+12],20,-1926607734);a=hh(a,b,c,d,x[i+ 5], 4,    -378558);
        d=hh(d,a,b,c,x[i+ 8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16, 1839030562);b=hh(b,c,d,a,x[i+14],23,  -35309556);
        a=hh(a,b,c,d,x[i+ 1], 4,-1530992060);d=hh(d,a,b,c,x[i+ 4],11, 1272893353);c=hh(c,d,a,b,x[i+ 7],16, -155497632);
        b=hh(b,c,d,a,x[i+10],23,-1094730640);a=hh(a,b,c,d,x[i+13], 4,  681279174);d=hh(d,a,b,c,x[i+ 0],11, -358537222);
        c=hh(c,d,a,b,x[i+ 3],16, -722521979);b=hh(b,c,d,a,x[i+ 6],23,   76029189);a=hh(a,b,c,d,x[i+ 9], 4, -640364487);
        d=hh(d,a,b,c,x[i+12],11, -421815835);c=hh(c,d,a,b,x[i+15],16,  530742520);b=hh(b,c,d,a,x[i+ 2],23, -995338651);
        a=ii(a,b,c,d,x[i+ 0], 6, -198630844);d=ii(d,a,b,c,x[i+ 7],10, 1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);
        b=ii(b,c,d,a,x[i+ 5],21,  -57434055);a=ii(a,b,c,d,x[i+12], 6, 1700485571);d=ii(d,a,b,c,x[i+ 3],10,-1894986606);
        c=ii(c,d,a,b,x[i+10],15,   -1051523);b=ii(b,c,d,a,x[i+ 1],21,-2054922799);a=ii(a,b,c,d,x[i+ 8], 6, 1873313359);
        d=ii(d,a,b,c,x[i+15],10,  -30611744);c=ii(c,d,a,b,x[i+ 6],15,-1560198380);b=ii(b,c,d,a,x[i+13],21, 1309151649);
        a=ii(a,b,c,d,x[i+ 4], 6, -145523070);d=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+ 2],15,  718787259);
        b=ii(b,c,d,a,x[i+ 9],21, -343485551);a=ad(a,olda);b=ad(b,oldb);c=ad(c,oldc);d=ad(d,oldd);
    }
    return rh(a)+rh(b)+rh(c)+rh(d);
}

!function(t,r){"object"==typeof exports&&"undefined"!=typeof module?module.exports=r():"function"==typeof define&&define.amd?define(r):(t="undefined"!=typeof globalThis?globalThis:t||self).dataTagJsSHA=r()}(this,(function(){"use strict";var t=function(r,n){return(t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,r){t.__proto__=r}||function(t,r){for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(t[n]=r[n])})(r,n)};var r="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";function n(t,r,n,i){var e,o,u,s=r||[0],f=(n=n||0)>>>3,h=-1===i?3:0;for(e=0;e<t.length;e+=1)o=(u=e+f)>>>2,s.length<=o&&s.push(0),s[o]|=t[e]<<8*(h+i*(u%4));return{value:s,binLen:8*t.length+n}}function i(t,i,e){switch(i){case"UTF8":case"UTF16BE":case"UTF16LE":break;default:throw new Error("encoding must be UTF8, UTF16BE, or UTF16LE")}switch(t){case"HEX":return function(t,r,n){return function(t,r,n,i){var e,o,u,s;if(0!=t.length%2)throw new Error("String of HEX type must be in byte increments");var f=r||[0],h=(n=n||0)>>>3,a=-1===i?3:0;for(e=0;e<t.length;e+=2){if(o=parseInt(t.substr(e,2),16),isNaN(o))throw new Error("String of HEX type contains invalid characters");for(u=(s=(e>>>1)+h)>>>2;f.length<=u;)f.push(0);f[u]|=o<<8*(a+i*(s%4))}return{value:f,binLen:4*t.length+n}}(t,r,n,e)};case"TEXT":return function(t,r,n){return function(t,r,n,i,e){var o,u,s,f,h,a,c,w,v=0,E=n||[0],A=(i=i||0)>>>3;if("UTF8"===r)for(c=-1===e?3:0,s=0;s<t.length;s+=1)for(u=[],128>(o=t.charCodeAt(s))?u.push(o):2048>o?(u.push(192|o>>>6),u.push(128|63&o)):55296>o||57344<=o?u.push(224|o>>>12,128|o>>>6&63,128|63&o):(s+=1,o=65536+((1023&o)<<10|1023&t.charCodeAt(s)),u.push(240|o>>>18,128|o>>>12&63,128|o>>>6&63,128|63&o)),f=0;f<u.length;f+=1){for(h=(a=v+A)>>>2;E.length<=h;)E.push(0);E[h]|=u[f]<<8*(c+e*(a%4)),v+=1}else for(c=-1===e?2:0,w="UTF16LE"===r&&1!==e||"UTF16LE"!==r&&1===e,s=0;s<t.length;s+=1){for(o=t.charCodeAt(s),!0===w&&(o=(f=255&o)<<8|o>>>8),h=(a=v+A)>>>2;E.length<=h;)E.push(0);E[h]|=o<<8*(c+e*(a%4)),v+=2}return{value:E,binLen:8*v+i}}(t,i,r,n,e)};case"B64":return function(t,n,i){return function(t,n,i,e){var o,u,s,f,h,a,c=0,w=n||[0],v=(i=i||0)>>>3,E=-1===e?3:0,A=t.indexOf("=");if(-1===t.search(/^[a-zA-Z0-9=+/]+$/))throw new Error("Invalid character in base-64 string");if(t=t.replace(/=/g,""),-1!==A&&A<t.length)throw new Error("Invalid '=' found in base-64 string");for(o=0;o<t.length;o+=4){for(f=t.substr(o,4),s=0,u=0;u<f.length;u+=1)s|=r.indexOf(f.charAt(u))<<18-6*u;for(u=0;u<f.length-1;u+=1){for(h=(a=c+v)>>>2;w.length<=h;)w.push(0);w[h]|=(s>>>16-8*u&255)<<8*(E+e*(a%4)),c+=1}}return{value:w,binLen:8*c+i}}(t,n,i,e)};case"BYTES":return function(t,r,n){return function(t,r,n,i){var e,o,u,s,f=r||[0],h=(n=n||0)>>>3,a=-1===i?3:0;for(o=0;o<t.length;o+=1)e=t.charCodeAt(o),u=(s=o+h)>>>2,f.length<=u&&f.push(0),f[u]|=e<<8*(a+i*(s%4));return{value:f,binLen:8*t.length+n}}(t,r,n,e)};case"ARRAYBUFFER":try{new ArrayBuffer(0)}catch(t){throw new Error("ARRAYBUFFER not supported by this environment")}return function(t,r,i){return function(t,r,i,e){return n(new Uint8Array(t),r,i,e)}(t,r,i,e)};case"UINT8ARRAY":try{new Uint8Array(0)}catch(t){throw new Error("UINT8ARRAY not supported by this environment")}return function(t,r,i){return n(t,r,i,e)};default:throw new Error("format must be HEX, TEXT, B64, BYTES, ARRAYBUFFER, or UINT8ARRAY")}}function e(t,n,i,e){switch(t){case"HEX":return function(t){return function(t,r,n,i){var e,o,u="",s=r/8,f=-1===n?3:0;for(e=0;e<s;e+=1)o=t[e>>>2]>>>8*(f+n*(e%4)),u+="0123456789abcdef".charAt(o>>>4&15)+"0123456789abcdef".charAt(15&o);return i.outputUpper?u.toUpperCase():u}(t,n,i,e)};case"B64":return function(t){return function(t,n,i,e){var o,u,s,f,h,a="",c=n/8,w=-1===i?3:0;for(o=0;o<c;o+=3)for(f=o+1<c?t[o+1>>>2]:0,h=o+2<c?t[o+2>>>2]:0,s=(t[o>>>2]>>>8*(w+i*(o%4))&255)<<16|(f>>>8*(w+i*((o+1)%4))&255)<<8|h>>>8*(w+i*((o+2)%4))&255,u=0;u<4;u+=1)a+=8*o+6*u<=n?r.charAt(s>>>6*(3-u)&63):e.b64Pad;return a}(t,n,i,e)};case"BYTES":return function(t){return function(t,r,n){var i,e,o="",u=r/8,s=-1===n?3:0;for(i=0;i<u;i+=1)e=t[i>>>2]>>>8*(s+n*(i%4))&255,o+=String.fromCharCode(e);return o}(t,n,i)};case"ARRAYBUFFER":try{new ArrayBuffer(0)}catch(t){throw new Error("ARRAYBUFFER not supported by this environment")}return function(t){return function(t,r,n){var i,e=r/8,o=new ArrayBuffer(e),u=new Uint8Array(o),s=-1===n?3:0;for(i=0;i<e;i+=1)u[i]=t[i>>>2]>>>8*(s+n*(i%4))&255;return o}(t,n,i)};case"UINT8ARRAY":try{new Uint8Array(0)}catch(t){throw new Error("UINT8ARRAY not supported by this environment")}return function(t){return function(t,r,n){var i,e=r/8,o=-1===n?3:0,u=new Uint8Array(e);for(i=0;i<e;i+=1)u[i]=t[i>>>2]>>>8*(o+n*(i%4))&255;return u}(t,n,i)};default:throw new Error("format must be HEX, B64, BYTES, ARRAYBUFFER, or UINT8ARRAY")}}var o=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],u=[3238371032,914150663,812702999,4144912697,4290775857,1750603025,1694076839,3204075428],s=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];function f(t){var r={outputUpper:!1,b64Pad:"=",outputLen:-1},n=t||{},i="Output length must be a multiple of 8";if(r.outputUpper=n.outputUpper||!1,n.b64Pad&&(r.b64Pad=n.b64Pad),n.outputLen){if(n.outputLen%8!=0)throw new Error(i);r.outputLen=n.outputLen}else if(n.shakeLen){if(n.shakeLen%8!=0)throw new Error(i);r.outputLen=n.shakeLen}if("boolean"!=typeof r.outputUpper)throw new Error("Invalid outputUpper formatting option");if("string"!=typeof r.b64Pad)throw new Error("Invalid b64Pad formatting option");return r}function h(t,r){return t>>>r|t<<32-r}function a(t,r){return t>>>r}function c(t,r,n){return t&r^~t&n}function w(t,r,n){return t&r^t&n^r&n}function v(t){return h(t,2)^h(t,13)^h(t,22)}function E(t,r){var n=(65535&t)+(65535&r);return(65535&(t>>>16)+(r>>>16)+(n>>>16))<<16|65535&n}function A(t,r,n,i){var e=(65535&t)+(65535&r)+(65535&n)+(65535&i);return(65535&(t>>>16)+(r>>>16)+(n>>>16)+(i>>>16)+(e>>>16))<<16|65535&e}function p(t,r,n,i,e){var o=(65535&t)+(65535&r)+(65535&n)+(65535&i)+(65535&e);return(65535&(t>>>16)+(r>>>16)+(n>>>16)+(i>>>16)+(e>>>16)+(o>>>16))<<16|65535&o}function d(t){return h(t,7)^h(t,18)^a(t,3)}function l(t){return h(t,6)^h(t,11)^h(t,25)}function R(t){return"SHA-224"==t?u.slice():s.slice()}function y(t,r){var n,i,e,u,s,f,R,y,U,b,T,m,F=[];for(n=r[0],i=r[1],e=r[2],u=r[3],s=r[4],f=r[5],R=r[6],y=r[7],T=0;T<64;T+=1)F[T]=T<16?t[T]:A(h(m=F[T-2],17)^h(m,19)^a(m,10),F[T-7],d(F[T-15]),F[T-16]),U=p(y,l(s),c(s,f,R),o[T],F[T]),b=E(v(n),w(n,i,e)),y=R,R=f,f=s,s=E(u,U),u=e,e=i,i=n,n=E(U,b);return r[0]=E(n,r[0]),r[1]=E(i,r[1]),r[2]=E(e,r[2]),r[3]=E(u,r[3]),r[4]=E(s,r[4]),r[5]=E(f,r[5]),r[6]=E(R,r[6]),r[7]=E(y,r[7]),r}return function(r){function n(t,n,e){var o=this;if("SHA-224"!==t&&"SHA-256"!==t)throw new Error("Chosen SHA variant is not supported");var u=e||{};return(o=r.call(this,t,n,e)||this).t=o.i,o.o=!0,o.u=-1,o.s=i(o.h,o.v,o.u),o.A=y,o.p=function(t){return t.slice()},o.l=R,o.R=function(r,n,i,e){return function(t,r,n,i,e){for(var o,u=15+(r+65>>>9<<4),s=r+n;t.length<=u;)t.push(0);for(t[r>>>5]|=128<<24-r%32,t[u]=4294967295&s,t[u-1]=s/4294967296|0,o=0;o<t.length;o+=16)i=y(t.slice(o,o+16),i);return"SHA-224"===e?[i[0],i[1],i[2],i[3],i[4],i[5],i[6]]:i}(r,n,i,e,t)},o.U=R(t),o.T=512,o.m="SHA-224"===t?224:256,o.F=!1,u.hmacKey&&o.B(function(t,r,n,e){var o=t+" must include a value and format";if(!r){if(!e)throw new Error(o);return e}if(void 0===r.value||!r.format)throw new Error(o);return i(r.format,r.encoding||"UTF8",n)(r.value)}("hmacKey",u.hmacKey,o.u)),o}return function(r,n){function i(){this.constructor=r}t(r,n),r.prototype=null===n?Object.create(n):(i.prototype=n.prototype,new i)}(n,r),n}(function(){function t(t,r,n){var i=n||{};if(this.h=r,this.v=i.encoding||"UTF8",this.numRounds=i.numRounds||1,isNaN(this.numRounds)||this.numRounds!==parseInt(this.numRounds,10)||1>this.numRounds)throw new Error("numRounds must a integer >= 1");this.g=t,this.Y=[],this.H=0,this.S=!1,this.I=0,this.C=!1,this.L=[],this.N=[]}return t.prototype.update=function(t){var r,n=0,i=this.T>>>5,e=this.s(t,this.Y,this.H),o=e.binLen,u=e.value,s=o>>>5;for(r=0;r<s;r+=i)n+this.T<=o&&(this.U=this.A(u.slice(r,r+i),this.U),n+=this.T);this.I+=n,this.Y=u.slice(n>>>5),this.H=o%this.T,this.S=!0},t.prototype.getHash=function(t,r){var n,i,o=this.m,u=f(r);if(this.F){if(-1===u.outputLen)throw new Error("Output length must be specified in options");o=u.outputLen}var s=e(t,o,this.u,u);if(this.C&&this.t)return s(this.t(u));for(i=this.R(this.Y.slice(),this.H,this.I,this.p(this.U),o),n=1;n<this.numRounds;n+=1)this.F&&o%32!=0&&(i[i.length-1]&=16777215>>>24-o%32),i=this.R(i,o,0,this.l(this.g),o);return s(i)},t.prototype.setHMACKey=function(t,r,n){if(!this.o)throw new Error("Variant does not support HMAC");if(this.S)throw new Error("Cannot set MAC key after calling update");var e=i(r,(n||{}).encoding||"UTF8",this.u);this.B(e(t))},t.prototype.B=function(t){var r,n=this.T>>>3,i=n/4-1;if(1!==this.numRounds)throw new Error("Cannot set numRounds with MAC");if(this.C)throw new Error("MAC key already set");for(n<t.binLen/8&&(t.value=this.R(t.value,t.binLen,0,this.l(this.g),this.m));t.value.length<=i;)t.value.push(0);for(r=0;r<=i;r+=1)this.L[r]=909522486^t.value[r],this.N[r]=1549556828^t.value[r];this.U=this.A(this.L,this.U),this.I=this.T,this.C=!0},t.prototype.getHMAC=function(t,r){var n=f(r);return e(t,this.m,this.u,n)(this.i())},t.prototype.i=function(){var t;if(!this.C)throw new Error("Cannot call getHMAC without first setting MAC key");var r=this.R(this.Y.slice(),this.H,this.I,this.p(this.U),this.m);return t=this.A(this.N,this.l(this.g)),t=this.R(r,this.m,this.T,t,this.m)},t}())}));

function dataTag256(inputString, type) {
    var sha256 = new dataTagJsSHA('SHA-256', 'TEXT');
    sha256.update(inputString);

    return sha256.getHash(type);
}
