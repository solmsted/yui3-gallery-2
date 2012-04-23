/**
 * @module gallery-mutex
 */
(function (Y) {
    'use strict';
    
    var _string_exclusive = 'exclusive',
        _string_shared = 'shared',
        
        /**
         * Most people believe that Since JavaScript does not provide a
         * multi-threaded shared memory environment, JavaScript is completely
         * free from concurrency issues.  This is true at a low level;
         * JavaScript developers don't need to worry about race conditions
         * between multiple processes or threads writing to the same memory
         * location.  At a higher level, asynchronous operations still allow for
         * similar problems to occur.
         * 
         * Imagine a function that does the following:
         * <ol>
         *     <li>
         *         Check the value of a variable.
         *     </li>
         *     <li>
         *         If the value is undefined, make a request to a server, receive
         *         data, set  the value of the variable.
         *     </li>
         *     <li>
         *         Pass the variable to a callback function.
         *     </li>
         * </ol>
         * 
         * It seems common for web applications to lazy load data like this as
         * needed.  Now imagine that there are several separate modules within a
         * web application which all require this data.  It's possible for the
         * first module to call this function, the function sees that the value
         * is undefined, and sends a request to a server.  Then before the
         * request returns, the second module calls this function, the function
         * sees that the value is undefined and sends a request to a server.
         * Then before both of those requests return, the third module calls
         * this function, the function sees that the values is undefined and
         * sends a request to a server.  In this case, three requests are made
         * to a server for the same data.
         * 
         * It would be far better if the second and third calls to the function
         * just waited for the first request to complete.  Y.Mutex makes it
         * easier to accomplish this functionality.
         * 
         * Y.Mutex provides a concept of locking a resource.  Once an exclusive
         * resource lock is obtained, other parts of an application which
         * attempt to access the same resource, will have to wait until that
         * resource is unlocked.
         * 
         * The function above could be rewritten as follows:
         * <ol>
         *     <li>
         *         Obtain an exclusive lock for a variable.
         *     </li>
         *     <li>
         *         Check the value of a variable.
         *     </li>
         *     <li>
         *         If the value is undefined, make a request to a server,
         *         receive data, set the value of the variable.
         *     </li>
         *     <li>
         *         Unlock the variable.
         *     </li>
         *     <li>
         *         Pass the variable to a callback function.
         *     </li>
         * </ol>
         * 
         * This way, second or third or more calls to the function, before the
         * first request is complete, will always wait for the request to
         * complete instead of sending multiple unnecessary requests.
         * 
         * Just like locking in multi threaded applications, there are
         * disadvantages and dangers to locking.  There is a small amount of
         * overhead added to every resource access, even when the chances for
         * concurrency issues are very small.  Once a lock is obtained, it must
         * be unlocked; so error handling and time outs are important to ensure
         * that the entire application doesn't break when something goes wrong.
         * It is possible to cause a deadlock when locking multiple resources at
         * once.
         * 
         * One advantage Y.Mutex has in JavaScript over other multi threaded
         * applications, the locks are asynchronous.  The application is not
         * blocked while waiting to acquire a lock.  Even if a deadlock occurs,
         * other parts of the application are not affected.  Y.Mutex also
         * provides multiple ways to cancel a particular lock, so there are
         * extra possibilities to recover from locking errors.
         * 
         * Y.Mutex offers exclusive locks and shared locks.  When a resource is
         * locked by an exclusive lock, Y.Mutex guarantees that no other locks
         * will be granted for the resource until the resource is unlocked.
         * When a resource is locked by a shared lock, Y.Mutex allows the
         * resource to be locked by multiple other shared locks at the same
         * time.  When a resource is locked by multiple shared locks, an
         * exclusive lock can not be obtained until all of the shared locks have
         * been unlocked.  Shared locks are generally used when just reading
         * values.  Exclusive locks are generally used when reading and writing
         * values.
         * 
         * Y.Mutex provides a way to deal with asynchronous concurrency issues,
         * but it does not prevent them.  If code from part of an application
         * uses Y.Mutex to lock a resource, there is nothing stopping code from
         * another part of the application from ignoring the lock and accessing
         * the resource directly.
         * @class Mutex
         * @static
         */
        _Mutex = Y.namespace('Mutex'),
        
        _indexOf = Y.Array.indexOf,
        _isArray = Y.Lang.isArray,
        _later = Y.later,
        _soon = Y.soon;
        
    Y.mix(_Mutex, {
        /**
         * Obtains an exclusive lock on a resource.
         * @method exclusive
         * @param {String} resourceName The name of the resource to lock.
         * @param {Function} callbackFunction The function that gets called when
         * the lock is obtained.  It is guaranteed not to be called
         * synchronously.  It is guaranteed not to be called more than once.  It
         * is not guaranteed to ever be called.  The callback function is passed
         * one argument, the unlock function which must be called to release the
         * lock.
         * @param {Number} timeout Optional.  The Approximate time in
         * milliseconds to wait after the callback function has been called.
         * Once the timeout has expired, if the callback function hasn't yet
         * called the unlock function, the lock will be automatically released.
         * This does not halt, stop, or prevent anything that the callback
         * function might still be doing asynchronously; it just releases the
         * lock.  Using timeout is one way to reduce the possibility of
         * deadlocks, but it comes with the risk of allowing concurrent access
         * to the resource.
         * @return {Object} cancelObject An object with a cancel method.  When
         * the cancel method is called, if the callback function hasn't yet
         * called the unlock function, the lock will be automatically released.
         * This does not halt, stop, or prevent anything that the callback
         * function might still be doing asynchronously; it just releases the
         * lock.  Using the cancel method is one way to reduce the possibiliy of
         * deadlocks, but it comes with the risk of allowing concurrent access
         * to the resource.  The cancelObject also has a mode property.
         * @static
         */
        exclusive: function (resourceName, callbackFunction, timeout) {
            return _Mutex._queue(_string_exclusive, resourceName, callbackFunction, timeout);
        },
        /**
         * Obtains a shared lock on a resource.
         * @method exclusive
         * @param {String} resourceName The name of the resource to lock.
         * @param {Function} callbackFunction The function that gets called when
         * the lock is obtained.  It is guaranteed not to be called
         * synchronously.  It is guaranteed not to be called more than once.  It
         * is not guaranteed to ever be called.  The callback function is passed
         * one argument, the unlock function which must be called to release the
         * lock.
         * @param {Number} timeout Optional.  The Approximate time in
         * milliseconds to wait after the callback function has been called.
         * Once the timeout has expired, if the callback function hasn't yet
         * called the unlock function, the lock will be automatically released.
         * This does not halt, stop, or prevent anything that the callback
         * function might still be doing asynchronously; it just releases the
         * lock.  Using timeout is one way to reduce the possibility of
         * deadlocks, but it comes with the risk of allowing concurrent access
         * to the resource.
         * @return {Object} cancelObject An object with a cancel method.  When
         * the cancel method is called, if the callback function hasn't yet
         * called the unlock function, the lock will be automatically released.
         * This does not halt, stop, or prevent anything that the callback
         * function might still be doing asynchronously; it just releases the
         * lock.  Using the cancel method is one way to reduce the possibiliy of
         * deadlocks, but it comes with the risk of allowing concurrent access
         * to the resource.  The cancelObject also has a mode property.
         * @static
         */
        shared: function (resourceName, callbackFunction, timeout) {
            return _Mutex._queue(_string_shared, resourceName, callbackFunction, timeout);
        },
        /**
         * Immediately grants a lock on a resource.
         * @method _lock
         * @param {String} mode Either 'exclusive' or 'shared'.
         * @param {String} guid The lock's internal id.
         * @param {String} resourceName The name of the resource to lock.
         * @param {Function} callbackFunction The function that gets called when
         * the lock is obtained.  It is guaranteed not to be called
         * synchronously.  It is guaranteed not to be called more than once.  It
         * is not guaranteed to ever be called.  The callback function is passed
         * one argument, the unlock function which must be called to release the
         * lock.
         * @param {Number} timeout Optional.  The Approximate time in
         * milliseconds to wait after the callback function has been called.
         * Once the timeout has expired, if the callback function hasn't yet
         * called the unlock function, the lock will be automatically released.
         * This does not halt, stop, or prevent anything that the callback
         * function might still be doing asynchronously; it just releases the
         * lock.  Using timeout is one way to reduce the possibility of
         * deadlocks, but it comes with the risk of allowing concurrent access
         * to the resource.
         * @protected
         * @return {Object} timerObject An object that will asynchronously later
         * be given a timer property.
         * @static
         */
        _lock: function (mode, guid, resourceName, callbackFunction, timeout) {
            var lock = _Mutex._locks[resourceName],
                timerWrapper = {};
            
            if (mode === _string_exclusive) {
                lock.l = guid;
            } else if (mode === _string_shared) {
                (function (lockArray) {
                    if (!Y.Lang.isArray(lockArray)) {
                        lockArray = [];
                        lock.l = lockArray;
                    }
                    
                    lockArray.push(guid);
                }(lock.l));
            } else {
                return timerWrapper;
            }

            _soon(function () {
                var timer;
                
                if (timeout) {
                    timer = _later(timeout, _Mutex, _Mutex._unlock, [
                        guid,
                        mode,
                        resourceName
                    ]);
                    timerWrapper.timer = timer;
                }
                
                callbackFunction(function () {
                    _Mutex._unlock(guid, mode, resourceName, timer);
                });
            });
            
            return timerWrapper;
        },
        /**
         * An object containing the state of currently held and queued locks.
         * @property _locks
         * @protected
         * @static
         */
        _locks: {},
        /**
         * Wait in queue to obtain a lock on a resource.
         * @method _queue
         * @param {String} mode Either 'exclusive' or 'shared'.
         * @param {String} resourceName The name of the resource to lock.
         * @param {Function} callbackFunction The function that gets called when
         * the lock is obtained.  It is guaranteed not to be called
         * synchronously.  It is guaranteed not to be called more than once.  It
         * is not guaranteed to ever be called.  The callback function is passed
         * one argument, the unlock function which must be called to release the
         * lock.
         * @param {Number} timeout Optional.  The Approximate time in
         * milliseconds to wait after the callback function has been called.
         * Once the timeout has expired, if the callback function hasn't yet
         * called the unlock function, the lock will be automatically released.
         * This does not halt, stop, or prevent anything that the callback
         * function might still be doing asynchronously; it just releases the
         * lock.  Using timeout is one way to reduce the possibility of
         * deadlocks, but it comes with the risk of allowing concurrent access
         * to the resource.
         * @protected
         * @return {Object} cancelObject An object with a cancel method.  When
         * the cancel method is called, if the callback function hasn't yet
         * called the unlock function, the lock will be automatically released.
         * This does not halt, stop, or prevent anything that the callback
         * function might still be doing asynchronously; it just releases the
         * lock.  Using the cancel method is one way to reduce the possibiliy of
         * deadlocks, but it comes with the risk of allowing concurrent access
         * to the resource.  The cancelObject also has mode property.
         * @static
         */
        _queue: function (mode, resourceName, callbackFunction, timeout) {
            var _locks = _Mutex._locks,
                
                guid = Y.guid(mode),
                lock = _locks[resourceName],
                queue,
                queueDetails = [
                    mode,
                    guid,
                    resourceName,
                    callbackFunction,
                    timeout
                ],
                timerWrapper;

            if (!lock) {
                lock = {};
                _locks[resourceName] = lock;
            }

            if (lock.l && (mode === _string_exclusive || !_isArray(lock.l))) {
                queue = lock.q;

                if (!queue) {
                    queue = [];
                    lock.q = queue;
                }

                queue.push(queueDetails);
            } else {
                timerWrapper = _Mutex._lock.apply(_Mutex, queueDetails);
            }

            return {
                cancel: function () {
                    _Mutex._unlock(guid, mode, resourceName, timerWrapper && timerWrapper.timer);
                },
                mode: mode
            };
        },
        /**
         * Unlocks a currently held lock on a resource and processes the next
         * lock in queue as needed.
         * @method _unlock
         * @param {String} guid The lock's internal id.  If this is not the id
         * of a lock currently held on this resource, this method will do
         * nothing.
         * @param {String} mode Either 'exclusive' or 'shared'.
         * @param {String} resourceName The name of the locked resource.
         * @param {Object} timer Optional.  The lock's timout timer to cancel.
         * @protected
         * @static
         */
        _unlock: function (guid, mode, resourceName, timer) {
            var _locks = _Mutex._locks,
                
                lock = _locks[resourceName],
                locked = lock && lock.l,
                queue = lock && lock.q,
                queueDetails;

            if (timer) {
                timer.cancel();
            }

            if (!lock || mode === _string_exclusive && locked !== guid) {
                return;
            }
            
            if (mode === _string_shared && !(function (index) {
                if (index === -1) {
                    return false;
                }
                
                var after = locked.slice(index + 1);
                locked.length = index;
                locked.push.apply(locked, after);
                
                return !locked.length;
            }(_isArray(locked) ? _indexOf(locked, guid) : -1))) {
                return;
            }

            if (queue && queue.length) {
                do {
                    queueDetails = queue.shift();
                    _Mutex._lock.apply(_Mutex, queueDetails);
                } while (queueDetails[0] === _string_shared && queue[0] && queue[0][0] === _string_shared);
            } else {
                delete _locks[resourceName];
            }
        }
    });
}(Y));