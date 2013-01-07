/*!
  * Bitdeli JavaScript tracking library
  * Copyright (c) 2012 Bitdeli Inc
  * https://github.com/bitdeli/bitdeli-tracking-js
  * MIT license
  */
(function (context) {

// Dependencies
// ------------
var _       = require("underscore"),
    reqwest = require("reqwest");

// Uses native JSON implementation if available
var JSON = $.JSON;


// Constants
// ---------
var EVENTS_API = "https://events.bitdeli.com/events";


// Library initialization
// ----------------------
var Bitdeli = {};

// Get async call queue (defined in tracking snippet)
var _bdq = context._bdq || [];

// Set library version
_bdq.__LV = "0.0.1";


// Main call queue
Bitdeli.Queue = function(queue, options) {
    this.options = options || {};
    this.initialize.apply(this, arguments);
};

_.extend(Bitdeli.Queue.prototype, {

    initialize: function(queue, options) {
        // Execute initial calls
        this._executeAll(queue);
    },

    // Keep the standard async-array-push interface
    push: function() {
        var args = Array.prototype.slice.call(arguments);
        this._executeAll(args);
    },

    _executeAll: function(queue) {
        var configCalls = [],
            trackingCalls = [];

        _.each(queue, function(call) {
            if (!_.isArray(call)) return;
            var fnName = call[0];
            if (!_.isString(fnName)) return;
            if (fnName.indexOf('track') != -1) {
                trackingCalls.push(call);
            } else {
                configCalls.push(call);
            }
        }, this);

        _.each(configCalls, this._execute, this);
        _.each(trackingCalls, this._execute, this);
    },

    _execute: function(call) {
        // TODO: whitelist functions
        this[call[0]].apply(this, call.slice(1));
    },

    _setInput: function(inputId) {
        this._inputId = inputId;
    },

    _setToken: function(token) {
        this._token = token;
    },

    _identify: function(uid) {
        this._uid = uid;
    },

    _trackEvent: function(props, opts) {
        opts = opts || {};
        var params = {
            url: [EVENTS_API, this._inputId].join("/"),
            method: "post",
            type: "json",
            contentType: "application/json",
            data: JSON.stringify({
                auth: this._token,
                uid: this._uid,
                event: props
            })
        };
        // TODO: parse JSON response for callback functions
        if (_.isFunction(opts.success)) params.success = opts.success;
        if (_.isFunction(opts.error)) params.error = opts.error;
        reqwest(params);
    }

});


// Library entry point
// -------------------
$.domReady(function() {
    // Replace queue placeholder with real Queue object
    window._bdq = new Bitdeli.Queue(window._bdq);
});


})(this);
