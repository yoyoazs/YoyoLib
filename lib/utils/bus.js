/*var events = require('events');
var debug = require('debug')('ynode');
var util = require('util');

var Bus = function () {
    events.EventEmitter.call(this);
};

util.inherits(Bus, events.EventEmitter);

var bus = new Bus();

var collected = {};
bus.on('newListener', function (event) {
    debug('bus new listener: %s (%s)', event, bus.listeners(event).length);
    if (!collected[event]) {
        collected[event] = true;
        bus.on(event, function () {
            debug('bus emit: %s', event);
        });
    }
});

module.exports = bus;*/