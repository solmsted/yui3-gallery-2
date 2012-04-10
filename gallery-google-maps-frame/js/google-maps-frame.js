/**
 * @module gallery-google-maps-frame
 */
(function (Y, moduleName) {
    'use strict';

    var _Base = Y.Base,
        _Frame = Y.Frame;
        
    /**
     * @class GoogleMapsFrame
     * @constructor
     * @extends Base
     * @param {Object} config
     */
    Y.GoogleMapsFrame = _Base.create(moduleName, _Base, [], {
        initializer: function () {
            var me = this;
            
            /**
             * Fired when Google Maps Loader fails.
             * @event failure
             */
            me.publish('failure');
            
            /**
             * Fired when Google Maps Loader succeeds.
             * @event load
             * @fireOnce
             */
            me.publish('load', {
                fireOnce: true
            });
            
            /**
             * Fired when Google Maps Loader times out.
             * @event timeout
             */
            me.publish('timeout');

            var frame = new _Frame({
                content: '<div id="map"></div>',
                extracss: 'body, html, #map {height: 100%; width: 100%;}'
            });

            frame.on('ready', function () {
                var iY = frame.getInstance();

                iY.config.win.YUI = YUI;
                iY.use('gallery-google-maps-loader', 'node', function (iY) {
                    var googleMapsLoader = new iY.GoogleMapsLoader();

                    googleMapsLoader.on('failure', function () {
                        me.fire('failure');
                    });
                    
                    googleMapsLoader.on('success', function () {
                        me.google = iY.config.win.google;
                        me._set('loaded', true);
                        me.fire('load');
                    });
                    
                    googleMapsLoader.on('timeout', function () {
                        me.fire('timeout');
                    });
                    
                    googleMapsLoader.load(me.get('parameters'));

                    me._set('domNode', iY.Node.getDOMNode(iY.one('#map')));
                    me._set('frame', frame);
                });
            });

            frame.render(me.get('container'));
        }
    }, {
        ATTRS: {
            /**
             * A selector string or node object which will contain the iframe.
             * @attribute container
             * @initOnly
             * @type Node|String
             */
            container: {
                value: null,
                writeOnce: 'initOnly'
            },
            /**
             * Reference to an empty div created inside the iframe. (This is not
             * an instance of Node.)
             * @attribute domNode
             * @readOnly
             */
            domNode: {
                readOnly: true,
                value: null
            },
            /**
             * The Y.Frame instance that created the iframe.
             * @attribute frame
             * @readOnly
             */
            frame: {
                readOnly: true,
                value: null
            },
            /**
             * @attribute loaded
             * @default false
             * @readOnly
             * @type Boolean
             */
            loaded: {
                readOnly: true,
                value: false
            },
            /**
             * An optional parameters object passed to GoogleMapsLoader. (see
             * gallery-google-maps-loader for information)
             * @attribute parameters
             * @initOnly
             * @type Object
             */
            parameters: {
                value: null,
                writeOnce: 'initOnly'
            }
        }
    });
}(Y, arguments[1]));