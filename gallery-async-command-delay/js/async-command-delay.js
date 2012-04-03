/**
 * @module gallery-async-command-delay
 */
(function (Y, moduleName) {
    'use strict';
    
    var _Do = Y.Do,
        _DoAlterReturn = _Do.AlterReturn,
        _DoPrevent = _Do.Prevent,
        _Plugin = Y.Plugin,
        
        _delay = Y.delay;

    /**
     * Asynchronous command delay plugin.
     * @class AsyncCommandDelay
     * @extends Plugin.Base
     * @namespace Plugin
     * @param {Object} config Configuration Object.
     */
    _Plugin.AsyncCommandDelay = Y.Base.create(moduleName, _Plugin.Base, [], {
        initializer: function () {
            var me = this,
            
                host = me.get('host'),
                run = host.run;
            
            me.afterHostMethod('run', function () {
                return new _DoAlterReturn('delayed', host);
            });
            
            me.beforeHostMethod('run', function () {
                _delay(run, me.get('delay')).call(host);
                return new _DoPrevent('delayed');
            });
        }
    }, {
        ATTRS: {
            /**
             * Approximate delay in milliseconds to wait between the time run is called
             * and when the command function is executed.
             * @attribute delay
             * @default 0
             * @initonly
             * @type Number
             */
            delay: {
                value: 0,
                writeOnce: 'initOnly'
            }
        },
        NS: 'delay'
    });
}(Y, arguments[1]));