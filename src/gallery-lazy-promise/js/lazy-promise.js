/**
@module gallery-lazy-promise
@author Steven Olmsted
*/
(function (Y) {
    var _Promise = Y.Promise,
    
        /**
        A LazyPromise acts just like a Promise with the exception that it won't be
        executed until its then method is called.
        @class LazyPromise
        @constructor
        @extends Promise
        @param {Function} fn A function where to insert the logic that resolves this
        promise.  Receives `fulfill` and `reject` functions as parameters.  This
        function is executed the first time the `then` method is called.
        */
        _Class = function (fn) {
            if (!(this instanceof _Class)) {
                return new _Class(fn);
            }

            this.constructor = _Promise;

            /**
            A temporary reference to fn.
            @property _fn
            @type Function
            @private
            */
            this._fn = fn;

            this._resolver = new _Promise.Resolver(this);
        };

    Y.LazyPromise = Y.extend(_Class, _Promise, {
        then: function (callback, errback) {
            var fn = this._fn,
                resolver = this._resolver;

            if (fn) {
                fn.call(this, function (value) {
                    resolver.fulfill(value);
                }, function (reason) {
                    resolver.reject(reason);
                });

                delete this._fn;
            }

            return resolver.then(callback, errback);
        }
    });
}(Y));