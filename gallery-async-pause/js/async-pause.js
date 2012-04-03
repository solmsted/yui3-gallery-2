/**
 * @module gallery-async-pause
 */
(function (Y, moduleName) {
    'use strict';
    
    var _DoPrevent = Y.Do.Prevent,
        _Plugin = Y.Plugin;

    /**
     * Asynchronous command runner pause plugin.
     * @class AsyncPause
     * @extends Plugin.Base
     * @namespace Plugin
     * @param {Object} config Configuration Object.
     */
    _Plugin.AsyncPause = Y.Base.create(moduleName, _Plugin.Base, [], {
        initializer: function () {
            var me = this;
                
            if (me.get('host').get('mode') === 'queue') {
                me.beforeHostMethod('_runQueue', function () {
                    if (me.get('paused')) {
                        me._set('_args', arguments);
                        return new _DoPrevent('paused');
                    }

                    return null;
                });
            }
        },
        /**
         * Pause the run.  Does not stop a command that is currently running, the run will pause
         * before the next command runs.
         * @method pause
         * @chainable
         */
        pause: function () {
            return this._set('paused', true);
        },
        /**
         * Resumes a paused run.  If a command is currently running, the paused state may not be updated
         * immediately.  Resume does nothing if the run is not paused or not started yet or already complete.
         * @method resume
         * @chainable
         */
        resume: function () {
            var argsChangeListener,
                completeListener,
                me = this,
                
                args = me.get('_args'),
                host = me.get('host'),
                runQueue = host._runQueue,
                
                resume = function (args) {
                    me._setAttrs({
                        paused: false,
                        _args: null,
                        _resumed: false
                    });
                    runQueue.apply(host, args);
                };
            
            if (!me.get('paused') || me.get('_resumed')) {
                return me;
            }
            
            if (!host.get('started') || host.get('completed')) {
                me._set('paused', false);
                return me;
            }

            if (args) {
                resume(args);
                return me;
            }
            
            me._set('resumed', true);
            
            argsChangeListener = me.once('_argsChange', function (eventFacade) {
                completeListener.detach();
                resume(eventFacade.newVal);
            });
            
            completeListener = host.on('complete', function () {
                argsChangeListener.detach();
            });
            
            return me;
        }
    }, {
        ATTRS: {
            /**
             * Boolean value indicating the paused status of the run.
             * @attribute paused
             * @default false
             * @readonly
             * @type Boolean
             */
            paused: {
                readonly: true,
                value: false
            },
            /**
             * Paused _runQueue arguments.
             * @attribute _args
             * @protected
             * @readonly
             * @type Array
             */
            _args: {
                readOnly: true,
                value: null
            },
            /**
             * Boolean value indicating the resumed status of the run.
             * @attribute _resumed
             * @protected
             * @readonly
             * @type Array
             */
            _resumed: {
                readOnly: true,
                value: false
            }
        },
        NS: 'pause'
    });
}(Y, arguments[1]));