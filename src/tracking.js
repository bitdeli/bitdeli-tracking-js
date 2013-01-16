/*!
  * Bitdeli JavaScript tracking library
  * Copyright (c) 2012 Bitdeli Inc
  * https://github.com/bitdeli/bitdeli-tracking-js
  * MIT license
  */
(function (context) {

// Dependencies
// ------------
var _       = require("underscore");

// Uses native JSON implementation if available
var JSON = $.JSON;


// Constants
// ---------
var LIB_VERSION         = "0.9.1",
    EVENTS_API          = "https://events.bitdeli.com/events",
    COOKIE_EXPIRY       = 365,
    BD_QUEUE            = "_bdq",
    CALLBACK_STORE      = "_cb",
    DOM_TRACKER_TIMEOUT = 300;


// Library initialization
// ----------------------
var Bitdeli = {};


// Main library object
Bitdeli.Library = function(queue, options) {
    this._version = LIB_VERSION;
    this[CALLBACK_STORE] = {};
    this.options = options || {};
    this.queue = new Bitdeli.Queue(queue, {
        execute: _.bind(this._execute, this)
    });
};

_.extend(Bitdeli.Library.prototype, {

    // Keep the standard async-array-push interface
    push: function() {
        var args = Array.prototype.slice.call(arguments);
        this.queue.executeAll(args);
    },

    setAccount: function(inputId, token) {
        if (!_.isString(inputId) || !_.isString(token)) return;
        this._inputId = inputId;
        this._token = token;
        this.cookie = new Bitdeli.Cookie({
            name: inputId
        });
    },

    identify: function(uid) {
        if (!_.isString(uid)) return;
        this.set({ $uid: uid });
    },

    set: function(props) {
        this.cookie.set(props);
    },

    setOnce: function(props) {
        this.cookie.setOnce(props);
    },

    unset: function(prop) {
        this.cookie.unset(prop);
    },

    track: function(eventName, props, callback) {
        if (!_.isString(eventName) || !eventName) return;
        new Bitdeli.Request({
            inputId: this._inputId,
            auth: this._token,
            uid: this.cookie.get("$uid"),
            event: _.extend({},
                this._getMetadata(),
                this.cookie.properties(),
                { $event_name: eventName },
                props
            ),
            callback: callback,
            callbackStore: this[CALLBACK_STORE]
        });
    },

    trackPageview: function(page, callback) {
        // First argument can be the callback
        if (_.isFunction(page)) {
            callback = page;
            page = void 0;
        }
        // If page is not defined use current URL
        if (_.isUndefined(page)) page = context.location.href;
        this.track("$pageview", { $page: page }, callback);
    },

    trackClick: function() {
        this._trackDOMEvent(Bitdeli.ClickTracker, arguments);
    },

    trackSubmit: function() {
        this._trackDOMEvent(Bitdeli.SubmitTracker, arguments);
    },

    _trackDOMEvent: function(DOMEventTracker, trackArgs) {
        var elements = Bitdeli.utils.getElements(trackArgs[0]);
        _.each(elements, function(el) {
            new DOMEventTracker({
                el: el,
                lib: this,
                eventName: trackArgs[1],
                props: trackArgs[2],
                callback: trackArgs[3]
            });
        }, this);
    },

    _execute: function(call) {
        // TODO: whitelist functions
        var method = this[call[0]];
        if (_.isFunction(method)) method.apply(this, call.slice(1));
    },

    _getMetadata: function() {
        return {
            $page_info: Bitdeli.utils.pageInfo(),
            $lib_ver: this._version
        };
    }

});


// Main call queue
Bitdeli.Queue = function(queue, options) {
    this.options = options || {};
    this.executeAll(queue);
};

_.extend(Bitdeli.Queue.prototype, {

    executeAll: function(queue) {
        var setAccount,
            configCalls = [],
            trackingCalls = [];

        _.each(queue, function(call) {
            if (!_.isArray(call)) return;
            var fnName = call[0];
            if (!_.isString(fnName)) return;
            if (fnName.indexOf('setAccount') != -1) {
                setAccount = call;
            } else if (fnName.indexOf('track') != -1) {
                trackingCalls.push(call);
            } else {
                configCalls.push(call);
            }
        }, this);

        if (setAccount) this.options.execute(setAccount);
        _.each(configCalls, this.options.execute);
        _.each(trackingCalls, this.options.execute);
    }

});


// Tracking cookie wrapper
Bitdeli.Cookie = function(options) {
    this.options = options || {};
    this.props = {};
    this.name = "bd_" + _.cookie.utils.escape(options.name);
    this.load();
    this.setOnce({
        $uid: this._generateUUID()
    });
};

_.extend(Bitdeli.Cookie.prototype, {

    _hiddenProps: ["$uid"],

    load: function() {
        var cookie = _.cookie.get(this.name);
        if (cookie) this.props = _.extend({}, JSON.parse(cookie));
    },

    save: function() {
        _.cookie.set(this.name, JSON.stringify(this.props), {
            expires: this.options.expires || COOKIE_EXPIRY,
            path: "/"
        });
    },

    properties: function() {
        return _.omit(this.props, this._hiddenProps);
    },

    get: function(prop) {
        return this.props[prop];
    },

    setOnce: function(props) {
        return this.set(props, { once: true });
    },

    set: function(props, opts) {
        opts = opts || {};
        if (!_.isObject(props)) return false;
        _[opts.once ? "defaults" : "extend"](this.props, props);
        this.save();
        return true;
    },

    unset: function(prop) {
        if (!_(this.props).has(prop)) return false;
        delete this.props[prop];
        this.save();
        return true;
    },

    _generateUUID: function() {
        return [
            (+new Date()).toString(16),
            _.UUID.v4()
        ].join("-");
    }

});


// Tracking request wrapper
Bitdeli.Request = function(options) {
    this.options = options || {};
    this.send();
};

_.extend(Bitdeli.Request.prototype, {

    send: function() {
        var xhr = new context.XMLHttpRequest();
        if ("withCredentials" in xhr) {
            // CORS supported
            this._get();
        } else {
            // CORS not supported, use JSONP via script tag insertion
            this._jsonpGet();
        }
    },

    _get: function(opts) {
        opts = _.extend({}, this.options, opts);
        var xhr = new context.XMLHttpRequest(),
            url = this._buildGetUrl(opts),
            callback = this._callback;
        xhr.open("GET", url, true);
        xhr.onreadystatechange = function(e) {
            if (xhr.readyState === 4) callback(xhr, opts);
        };
        xhr.send();
    },

    _callback: function(resp, opts) {
        var parse = function(string) {
            try {
                return JSON.parse(string);
            } catch (error) {
                return 1;
            }
        };
        var response;
        if (resp instanceof context.XMLHttpRequest) {
            if (resp.status === 200) {
                response = parse(resp.responseText);
            } else {
                response = 0;
            }
        } else if (_.isString(response)) {
            response = parse(response);
        } else {
            response = +!!resp; // Force 0 or 1
        }
        if (_.isFunction(opts.callback)) {
            opts.callback.call(context, response, opts.event);
        }
    },

    _jsonpGet: function(opts) {
        opts = _.extend({}, this.options, opts);
        opts.jsonp = true;
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.async = true;
        script.defer = true;
        script.src = this._buildGetUrl(opts);
        var firstScript = document.getElementsByTagName("script")[0];
        firstScript.parentNode.insertBefore(script, firstScript);
    },

    _buildGetUrl: function(opts) {
        opts = opts || {};
        var url = [EVENTS_API, opts.inputId].join("/"),
            params = {};
        if (opts.auth) params.auth = opts.auth;
        if (_.has(opts, "uid")) params.uid = opts.uid;
        if (opts.event) params.event = JSON.stringify(opts.event);
        if (opts.jsonp && _.isFunction(opts.callback)) {
            params.callback = this._storeCallback(opts);
        }
        params._ = new Date().getTime().toString();
        return url + "?" + this._serializeParams(params);
    },

    _base64Encode: function(data) {
        var encoded = context.btoa(data);
        // http://en.wikipedia.org/wiki/Base64#URL_applications
        return encoded.replace(/\+/g, "_").replace(/\//g, "-");
    },

    _serializeParams: function(params) {
        params = params || {};
        var encoded = _.map(params, function(val, key) {
            return [
                encodeURIComponent(key),
                this._base64Encode(val)
            ].join("=");
        }, this);
        return encoded.join("&");
    },

    _storeCallback: function(opts) {
        var cbStore = opts.callbackStore,
            randomToken = "" + Math.floor(Math.random() * 1e8),
            callback = this._callback;
        cbStore[randomToken] = function(response) {
            delete cbStore[randomToken];
            callback(response, opts);
        };
        return BD_QUEUE+"."+CALLBACK_STORE+'["'+randomToken+'"]';
    }

});


// Basic DOM tracking
// ------------------

// Base interface for all DOM event tracker classes
Bitdeli.DOMEventTracker = {

    domEvent: "click",

    initialize: function(opts) {
        _.bindAll(this, "_track", "_getTrackCallback");
        this.lib = opts.lib;
        if (!_.isElement(opts.el)) return;
        this.el = opts.el;
        this.el.addEventListener(this.domEvent, this._track, false);
    },

    _track: function(event) {
        this._defaultPrevented = this.preventDefault(event);
        if (this._defaultPrevented) {
            // Continue with default action if there's
            // no response from the server
            context.setTimeout(
                this._getTrackCallback(event, true),
                DOM_TRACKER_TIMEOUT
            );
        }
        this.lib.track(
            this.options.eventName,
            this._getProps(this.options),
            this._getTrackCallback(event)
        );
    },

    _getTrackCallback: function(event, timedOut) {
        timedOut = timedOut || false;
        var opts = this.options,
            that = this;
        return function(trackResponse, trackedEvent) {
            // Prevent running callback twice
            if (that._callbackFired) return;
            that._callbackFired = true;

            if (timedOut) {
                trackResponse = 0;
                trackedEvent = that._getProps(opts);
            }
            if (_.isFunction(opts.callback)) {
                var returnValue = opts.callback.call(that.el,
                    trackResponse, trackedEvent, event, timedOut
                );
                // User can the prevent default event action
                // by returning false from the callback
                if (returnValue === false) return;
            }
            if (that._defaultPrevented) that.defaultAction();
        };
    },

    _getProps: function(opts) {
        var props = opts.props;
        if (_.isFunction(opts.props)) {
            props = opts.props.call(this.el, this.el);
        }
        return _.isObject(props) ? _.clone(props) : {};
    },

    // Override in classes that implement this interface
    preventDefault: function(event) {
        event.preventDefault();
        return true;
    },

    defaultAction: function() {}

};


// Tracker for click events (e.g. outbound links)
Bitdeli.ClickTracker = function(options) {
    this.options = options || {};
    this.initialize.apply(this, arguments);
    if (this.el && _.isString(this.el.href)) {
        this.href = this.el.href;
    }
};

_.extend(Bitdeli.ClickTracker.prototype, Bitdeli.DOMEventTracker, {

    preventDefault: function(event) {
        // http://www.quirksmode.org/js/events_properties.html
        var opts = this.options,
            rightClick = event.button == 2 || event.which == 3,
            modifier = event.ctrlKey || event.metaKey,
            newTab = rightClick || modifier || this.el.target == "_blank";
        if (!newTab && this.href) {
            event.preventDefault();
            return true;
        } else {
            return false;
        }
    },

    defaultAction: function() {
        if (!_.isString(this.href)) return;
        var href = this.href;
        _.defer(function() {
            context.location = href;
        });
    }

});


// Tracker for submit events (e.g. forms)
Bitdeli.SubmitTracker = function(options) {
    this.options = options || {};
    this.initialize.apply(this, arguments);
};

_.extend(Bitdeli.SubmitTracker.prototype, Bitdeli.DOMEventTracker, {

    domEvent: "submit",

    defaultAction: function() {
        var el = this.el;
        _.defer(function() {
            el.submit();
        });
    }

});


// Helpers
// -------

Bitdeli.utils = {

    pageInfo: function() {
        return Bitdeli.utils.truncateData(
            Bitdeli.utils.stripEmpty({
                url: context.location.href,
                ua: context.navigator.userAgent,
                referrer: context.document.referrer
            }), 1023
        );
    },

    truncateData: function(obj, length) {
        length = length || 255;
        var result, truncate = Bitdeli.utils.truncateData;
        if (_.isObject(obj)) {
            result = {};
            _.each(obj, function(val, key) {
                result[key] = truncate(val, length);
            });
        } else if (_.isArray(obj)) {
            result = _.map(obj, function(val) {
                return truncate(val, length);
            });
        } else if (_.isString(obj)) {
            result = obj.slice(0, length);
        } else {
            result = obj;
        }
        return result;
    },

    stripEmpty: function(obj) {
        var result = {};
        _.each(obj, function(val, key) {
            if (_.isString(val) && val.length > 0) {
                result[key] = val;
            }
        });
        return result;
    },

    getElements: function(selector) {
        var results = [],
            getRecursive = Bitdeli.utils.getElements,
            doc = context.document;
        if (_.isArray(selector)) {
            _.each(selector, function(sel) {
                results.push.apply(results, getRecursive(sel));
            }, this);
        } else if (_.isString(selector) && selector.length) {
            var first = selector.charAt(0),
                name = selector.substring(1);
            if (first == ".") {
                results.push.apply(results, doc.getElementsByClassName(name));
            } else if (first == "#") {
                var el = doc.getElementById(name);
                if (el) results.push(el);
            }
        } else if (_.isElement(selector)) {
            results.push(selector);
        }
        return results;
    }

};


// Copyright (c) 2012 Florian H., https://github.com/js-coder
// https://github.com/js-coder/cookie.js
// MIT/X11 license
_.cookie = (function (document, undefined) {

    var cookie = function () {
        return cookie.get.apply(cookie, arguments);
    };

    cookie.utils = utils = {

        // Is the given value an array? Use ES5 Array.isArray if it's available.
        isArray: Array.isArray || function (value) {
            return Object.prototype.toString.call(value) === '[object Array]';
        },

        // Is the given value a plain object / an object whose constructor is `Object`?
        isPlainObject: function (value) {
            return !!value && Object.prototype.toString.call(value) === '[object Object]';
        },

        // Convert an array-like object to an array – for example `arguments`.
        toArray: function (value) {
            return Array.prototype.slice.call(value);
        },

        // Get the keys of an object. Use ES5 Object.keys if it's available.
        getKeys: Object.keys || function (obj) {
            var keys = [],
                 key = '';
            for (key in obj) {
                if (obj.hasOwnProperty(key)) keys.push(key);
            }
            return keys;
        },

        // Unlike JavaScript's built-in escape functions, this method
        // only escapes characters that are not allowed in cookies.
        escape: function (value) {
            return String(value).replace(/[,;"\\=\s%]/g, function (character) {
                return encodeURIComponent(character);
            });
        },

        // Return fallback if the value is not defined, otherwise return value.
        retrieve: function (value, fallback) {
            return value === null ? fallback : value;
        }

    };

    cookie.defaults = {};

    cookie.expiresMultiplier = 60 * 60 * 24;

    cookie.set = function (key, value, options) {

        if (utils.isPlainObject(key)) { // Then `key` contains an object with keys and values for cookies, `value` contains the options object.

            for (var k in key) { // TODO: `k` really sucks as a variable name, but I didn't come up with a better one yet.
                if (key.hasOwnProperty(k)) this.set(k, key[k], value);
            }

        } else {

            options = utils.isPlainObject(options) ? options : { expires: options };

            var expires = options.expires !== undefined ? options.expires : (this.defaults.expires || ''), // Empty string for session cookies.
                expiresType = typeof(expires);

            if (expiresType === 'string' && expires !== '') expires = new Date(expires);
            else if (expiresType === 'number') expires = new Date(+(new Date()) + 1000 * this.expiresMultiplier * expires); // This is needed because IE does not support the `max-age` cookie attribute.

            if (expires !== '' && 'toGMTString' in expires) expires = ';expires=' + expires.toGMTString();

            var path = options.path || this.defaults.path; // TODO: Too much code for a simple feature.
            path = path ? ';path=' + path : '';

            var domain = options.domain || this.defaults.domain;
            domain = domain ? ';domain=' + domain : '';

            var secure = options.secure || this.defaults.secure ? ';secure' : '';

            document.cookie = utils.escape(key) + '=' + utils.escape(value) + expires + path + domain + secure;

        }

        return this; // Return the `cookie` object to make chaining possible.

    };

    cookie.remove = function (keys) {

        keys = utils.isArray(keys) ? keys : utils.toArray(arguments);

        for (var i = 0, l = keys.length; i < l; i++) {
            this.set(keys[i], '', -1);
        }

        return this; // Return the `cookie` object to make chaining possible.
    };

    cookie.get = function (keys, fallback) {

        fallback = fallback || undefined;
        var cookies = this.all();

        if (utils.isArray(keys)) {

            var result = {};

            for (var i = 0, l = keys.length; i < l; i++) {
                var value = keys[i];
                result[value] = utils.retrieve(cookies[value], fallback);
            }

            return result;

        } else return utils.retrieve(cookies[keys], fallback);

    };

    cookie.all = function () {

        if (document.cookie === '') return {};

        var cookies = document.cookie.split('; '),
              result = {};

        for (var i = 0, l = cookies.length; i < l; i++) {
            var item = cookies[i].split('=');
            result[decodeURIComponent(item[0])] = decodeURIComponent(item[1]);
        }

        return result;

    };

    cookie.enabled = function () {

        if (navigator.cookieEnabled) return true;

        var ret = cookie.set('_', '_').get('_') === '_';
        cookie.remove('_');
        return ret;

    };

    return cookie;

})(document);


// UUID generation based on uuid.js
// https://github.com/broofa/node-uuid
// Copyright (c) 2010-2012 Robert Kieffer
// MIT License - http://opensource.org/licenses/mit-license.php
_.UUID = (function() {
    var _global = context;
    var _rng;

    if (!_rng && _global.crypto && crypto.getRandomValues) {
        var _rnds8 = new Uint8Array(16);
        _rng = function whatwgRNG() {
            crypto.getRandomValues(_rnds8);
            return _rnds8;
        };
    }

    if (!_rng) {
        var  _rnds = new Array(16);
        _rng = function() {
            for (var i = 0, r; i < 16; i++) {
                if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
                _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
            }
            return _rnds;
        };
    }

    // Buffer class to use
    var BufferClass = typeof(Buffer) == 'function' ? Buffer : Array;

    // Map for number -> hex string conversion
    var _byteToHex = [];
    for (var i = 0; i < 256; i++) {
        _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    }

    // **`unparse()` - Convert UUID byte array (ala parse()) into a string**
    function unparse(buf, offset) {
        var i = offset || 0, bth = _byteToHex;
        return  bth[buf[i++]] + bth[buf[i++]] +
                bth[buf[i++]] + bth[buf[i++]] + '-' +
                bth[buf[i++]] + bth[buf[i++]] + '-' +
                bth[buf[i++]] + bth[buf[i++]] + '-' +
                bth[buf[i++]] + bth[buf[i++]] + '-' +
                bth[buf[i++]] + bth[buf[i++]] +
                bth[buf[i++]] + bth[buf[i++]] +
                bth[buf[i++]] + bth[buf[i++]];
    }

    // **`v4()` - Generate random UUID**
    // See https://github.com/broofa/node-uuid for API details
    function v4(options, buf, offset) {
        // Deprecated - 'format' argument, as supported in v1.2
        var i = buf && offset || 0;

        if (typeof(options) == 'string') {
            buf = options == 'binary' ? new BufferClass(16) : null;
            options = null;
        }
        options = options || {};

        var rnds = options.random || (options.rng || _rng)();

        // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
        rnds[6] = (rnds[6] & 0x0f) | 0x40;
        rnds[8] = (rnds[8] & 0x3f) | 0x80;

        // Copy bytes to buffer, if provided
        if (buf) {
            for (var ii = 0; ii < 16; ii++) {
                buf[i + ii] = rnds[ii];
            }
        }

        return buf || unparse(rnds);
    }

    // Export public API
    return { v4: v4 };

})();


// Polyfills
// ---------

// Add a getElementsByClassName function if the browser doesn't have one
// Limitation: only works with one class name
// Copyright: Eike Send http://eike.se/nd
// License: MIT License
(function(window, document) {
    if (document.getElementsByClassName) return;
    document.getElementsByClassName = function(search) {
        var d = document, elements, pattern, i, results = [];
        if (d.querySelectorAll) { // IE8
            return d.querySelectorAll("." + search);
        }
        if (d.evaluate) { // IE6, IE7
            pattern = ".//*[contains(concat(' ', @class, ' '), ' " + search + " ')]";
            elements = d.evaluate(pattern, d, null, 0, null);
            while ((i = elements.iterateNext())) {
                results.push(i);
            }
        } else {
            elements = d.getElementsByTagName("*");
            pattern = new RegExp("(^|\\s)" + search + "(\\s|$)");
            for (i = 0; i < elements.length; i++) {
                if ( pattern.test(elements[i].className) ) {
                    results.push(elements[i]);
                }
            }
        }
        return results;
    };
})(context, context.document);


// addEventListener polyfill 1.0 / Eirik Backer / MIT Licence
// https://gist.github.com/2864711
(function(win, doc){
    if(win.addEventListener)return;     //No need to polyfill

    function docHijack(p){var old = doc[p];doc[p] = function(v){return addListen(old(v))}}
    function addEvent(on, fn, self){
        return (self = this).attachEvent('on' + on, function(e){
            var e = e || win.event;
            e.preventDefault  = e.preventDefault  || function(){e.returnValue = false}
            e.stopPropagation = e.stopPropagation || function(){e.cancelBubble = true}
            fn.call(self, e);
        });
    }
    function addListen(obj, i){
        if(i = obj.length)while(i--)obj[i].addEventListener = addEvent;
        else obj.addEventListener = addEvent;
        return obj;
    }

    addListen([doc, win]);
    if('Element' in win)win.Element.prototype.addEventListener = addEvent;          //IE8
    else{       //IE < 8
        doc.attachEvent('onreadystatechange', function(){addListen(doc.all)});      //Make sure we also init at domReady
        docHijack('getElementsByTagName');
        docHijack('getElementById');
        docHijack('createElement');
        addListen(doc.all);
    }
})(context, context.document);


// base64.js
// https://github.com/davidchambers/Base64.js
;(function (window) {

    var
        object = typeof window != 'undefined' ? window : exports,
        chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
        INVALID_CHARACTER_ERR = (function () {
            // fabricate a suitable error object
            try { document.createElement('$'); }
            catch (error) { return error; }}());

    // encoder
    // [https://gist.github.com/999166] by [https://github.com/nignag]
    object.btoa || (
    object.btoa = function (input) {
        for (
            // initialize result and counter
            var block, charCode, idx = 0, map = chars, output = '';
            // if the next input index does not exist:
            //   change the mapping table to "="
            //   check if d has no fractional digits
            input.charAt(idx | 0) || (map = '=', idx % 1);
            // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
            output += map.charAt(63 & block >> 8 - idx % 1 * 8)
        ) {
            charCode = input.charCodeAt(idx += 3/4);
            if (charCode > 0xFF) throw INVALID_CHARACTER_ERR;
            block = block << 8 | charCode;
        }
        return output;
    });

    // decoder
    // [https://gist.github.com/1020396] by [https://github.com/atk]
    object.atob || (
    object.atob = function (input) {
        input = input.replace(/=+$/, '')
        if (input.length % 4 == 1) throw INVALID_CHARACTER_ERR;
        for (
            // initialize result and counters
            var bc = 0, bs, buffer, idx = 0, output = '';
            // get next character
            buffer = input.charAt(idx++);
            // character found in table? initialize bit storage and add its ascii value;
            ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
                // and if not first of each 4 characters,
                // convert the first 8 bits to one ascii character
                bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
        ) {
            // try to find character in table (0-63, not found => -1)
            buffer = chars.indexOf(buffer);
        }
        return output;
    });

}(context));


// Bitdeli tracking library entry point
// ------------------------------------
$.domReady(function() {
    // Replace queue placeholder with library object
    context[BD_QUEUE] = new Bitdeli.Library(context[BD_QUEUE]);
});


})(this);
