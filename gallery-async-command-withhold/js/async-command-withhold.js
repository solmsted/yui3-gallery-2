/**
 * @module gallery-async-command-withhold
 */
(function (Y, moduleName) {
    'use strict';
    
    var _Plugin = Y.Plugin,
        
        _delay = Y.delay;

    /**
     * Asynchronous command withhold plugin.
     * @class AsyncCommandWithhold
     * @extends Y.Plugin.Base
     * @namespace Y.Plugin
     * @param {Object} config Configuration Object.
     */
    _Plugin.AsyncCommandWithhold = Y.Base.create(moduleName, _Plugin.Base, [], {
        initializer: function () {
            this.onHostEvent([
                'failure',
                'success'
            ], function (eventFacade) {
                eventFacade.preventDefault();
                
                var args = arguments,
                    target = eventFacade.target,
                    targetEvent = target.getEvent(eventFacade.type);
                
                _delay(targetEvent.defaultFn, this.get('withhold')).apply(targetEvent, args);
            }, this);
        }
    }, {
        ATTRS: {
            /**
             * Approximate delay in milliseconds to wait between the time the command function
             * reports completion and when the completed status is updated.
             * @attribute withhold
             * @default 0
             * @initonly
             * @type Number
             */
            withhold: {
                value: 0,
                writeOnce: 'initOnly'
            }
        },
        NS: 'withhold'
    });
}(Y, arguments[1]));