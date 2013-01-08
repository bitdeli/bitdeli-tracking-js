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
var EVENTS_API      = "https://events.bitdeli.com/events",
    COOKIE_EXPIRY   = 365;


// Library initialization
// ----------------------
var Bitdeli = {};

// Get async call queue (defined in tracking snippet)
var _bdq = context._bdq || [];

// Set library version
_bdq.__LV = "0.0.1";


// Main library object
Bitdeli.Library = function(queue, options) {
    _.bindAll(this, "_execute");
    this.options = options || {};
    this.queue = new Bitdeli.Queue(queue, {
        execute: this._execute
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

    trackEvent: function(props, callback) {
        new Bitdeli.Request({
            inputId: this._inputId,
            auth: this._token,
            uid: this.cookie.get("$uid"),
            event: _.extend(this.cookie.properties(), props),
            callback: callback
        });
    },

    _execute: function(call) {
        // TODO: whitelist functions
        var method = this[call[0]];
        if (_.isFunction(method)) method.apply(this, call.slice(1));
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
            this._post();
        } else {
            // CORS not supported
            // TODO: create GET request via script tag
        }
    },

    _post: function(opts) {
        opts = _.extend({}, this.options, opts);
        var xhr = new XMLHttpRequest(),
            url = [EVENTS_API, opts.inputId].join("/");
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function(e) {
            if (xhr.readyState === 4) {
                var response = 0;
                if (xhr.status === 200) {
                    try {
                        response = JSON.parse(xhr.responseText);
                    } catch (error) {
                        response = 1;
                    }
                }
                if (_.isFunction(opts.callback)) {
                    opts.callback(response, opts.event);
                }
            }
        };
        xhr.send(JSON.stringify({
            auth: opts.auth,
            uid: opts.uid,
            event: opts.event
        }));
    }

});


// Helpers
// -------

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


// Bitdeli tracking library entry point
// ------------------------------------
$.domReady(function() {
    // Replace queue placeholder with library object
    context._bdq = new Bitdeli.Library(context._bdq);
});


})(this);
