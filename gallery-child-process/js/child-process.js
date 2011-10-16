/**
 * This is a convenience wrapper around child processes in Node.js.
 * @module gallery-child-process
 */

(function (Y) {
    'use strict';
    
    var _spawn = require('child_process').spawn,
        _write,
    
        _class;
        
    /**
     * @class ChildProcess
     * @constructor
     * @extends Base
     * @param {Object} config Configuration object.
     */
    _class = function (config) {
        _class.superclass.constructor.call(this, config);
    };
    
    _class.ATTRS = {
        /**
         * Array of command line arguments.  Refer to Node.js child_process.spawn documentation.
         * @attribute args
         * @default []
         * @initOnly
         * @type Array
         */
        args: {
            value: [],
            writeOnce: 'initOnly'
        },
        /**
         * The command to execute.  Refer to Node.js child_process.spawn documentation.
         * @attribute command
         * @initOnly
         * @type String
         */
        command: {
            writeOnce: 'initOnly'
        },
        /**
         * Additional options.  Refer to Node.js child_process.spawn documentation.
         * @attribute options
         * @default {}
         * @initOnly
         * @type Object
         */
        options: {
            value: {},
            writeOnce: 'initOnly'
        },
        /**
         * The PID of the child process.
         * @attribute pid
         * @readOnly
         * @type Number
         */
        pid: {
            readOnly: true
        },
        /**
         * This will be true when the stdin of the child process is writable and its kernel buffer is not full.
         * @attribute ready
         * @default false
         * @readOnly
         * @type Boolean
         */
        ready: {
            readOnly: true,
            value: false
        },
        /**
         * Encoding may be one of 'ascii', 'base64', or 'utf8'.  If left undefined, the stderr event will emit a Buffer instead of a string.
         * @attribute stderrEncoding
         * @initOnly
         * @type String
         */
        stderrEncoding: {
            writeOnce: 'initOnly'
        },
        /**
         * Encoding may be one of 'ascii', 'base64', or 'utf8'.  If left undefined, the stdout event will emit a Buffer instead of a string.
         * @attribute stdoutEncoding
         * @initOnly
         * @type String
         */
        stdoutEncoding: {
            writeOnce: 'initOnly'
        }
    };
    
    _class.NAME = 'ChildProcess';
    
    Y.extend(_class, Y.Base, {
        initializer: function () {
            /**
             * Fires when the stdin of the child process is writable again after having reported its kernel buffer was full.
             * @event drain
             * @preventable
             */
            this.publish('drain', {
                defaultFn: function () {
                    this._set('ready', true);
                }
            });
            
            /**
             * Fires when there is an error in any stream of the child process.
             * @event error
             * @param stderr Error reported from stderr.
             * @param stdin Error reported from stdin.
             * @param stdout Error reported from stdout.
             */
            this.publish('error');
            
            /**
             * Fires when the child process exits.
             * @event exit
             * @param {Number|null} code If the process terminated normally, code is the final exit code of the process, otherwise null.
             * @param {String|null} signal If the process terminated due to receipt of a signal, signal is the string name of the signal, otherwise null.
             * @preventable destroy
             */
            this.publish('exit', {
                defaultFn: function () {
                    this.destroy();
                },
                fireOnce: true
            });
            
            /**
             * Fired when stderr receives data.
             * @event stderr
             * @param {Buffer|String} data
             */
            this.publish('stderr');
            
            /**
             * Fired when stdout receives data.
             * @event stdout
             * @param {Buffer|String} data
             */
            this.publish('stdout');
            
            var childProcess = _spawn(this.get('command'), this.get('args'), this.get('options')),
                me = this,
                stderr = childProcess.stderr,
                stderrEncoding = this.get('stderrEncoing'),
                stdin = childProcess.stdin,
                stdout = childProcess.stdout,
                stdoutEncoding = this.get('stdoutEncoding');
                
            if (stderrEncoding) {
                stderr.setEncoding(stderrEncoding);
            }
            
            stderr.on('data', function (data) {
                me.fire('stderr', {
                    data: data
                });
            });
            
            stderr.on('error', function (exception) {
                me.fire('error', {
                    stderr: exception
                });
            });
            
            stdin.on('drain', function () {
                me.fire('drain');
            });
            
            stdin.on('error', function (exception) {
                me.fire('error', {
                    stdin: exception
                });
            });
            
            if (stdoutEncoding) {
                stdout.setEncoding(stdoutEncoding);
            }
            
            stdout.on('data', function (data) {
                me.fire('stdout', {
                    data: data
                });
            });
            
            stdout.on('error', function (exception) {
                me.fire('error', {
                    stdout: exception
                });
            });
            
            childProcess.on('exit', function (code, signal) {
                me.fire('exit', {
                    code: code,
                    signal: signal
                });
            });
            
            /**
             * @property _childProcess
             * @protected
             */
            this._childProcess = childProcess;
            
            /**
             * @property _stderr
             * @protected
             */
            this._stderr = stderr;
            
            /**
             * @property _stdin
             * @protected
             */
            this._stdin = stdin;
            
            /**
             * @property _stdout
             * @protected
             */
            this._stdout = stdout;
            
            this._set('pid', childProcess.pid);
            this._set('ready', true);
        },
        /**
         * Sends a signal to the child process.  Refer to Node.js child.kill documentation.  Note that while the method is called kill, the signal delivered to the child process may not actually kill it.  kill really just sends a signal to a process.
         * @method kill
         * @chainable
         * @param {String} signal (optional) Defaults to 'SIGTERM'.
         */
        kill: function (signal) {
            var childProcess = this._childProcess;
            
            if (childProcess) {
                childProcess.kill(signal || 'SIGTERM');
            }
            
            return this;
        },
        /**
         * Writes data to the stdin of the child process.  If the stdin of the child process has reported its kernel buffer is full, the write will be queued until the drain event.
         * @method write
         * @chainable
         * @param {Buffer|String} data The data to write.
         * @param {String} encoding (optional) The encoding to use when data is a String value.  May be one of 'ascii', 'base64', or 'utf8'.  If undefined, 'utf8' is assumed.
         */
        write: function (data, encoding) {
            if (this.get('ready')) {
                _write.call(this, data, encoding);
            } else {
                var eventHandle = this.on('readyChange', function (eventFacade) {
                    if (eventFacade.newVal) {
                        this.write(data, encoding);
                        eventHandle.detach();
                    }
                }, this);
            }
            
            return this;
        }
    });
    
    /**
     * @method _write
     * @param {Buffer|String} data
     * @param {String} encoding
     * @private
     */
    _write = function (data, encoding) {
        var stdin = this._stdin;
        
        if (!(stdin && stdin.writable && stdin.write(data, encoding))) {
            this._set('ready', false);
        }
    };
    
    Y.ChildProcess = _class;
}(Y));