(function (Y) {
    'use strict';
    
    var _defaultMode = parseInt(755, 8),
        _fs = require('fs'),
        _linkStatusCache = {},
        _path = require('path'),
        _process = process,
        _statusCache = {},
        _util = require('util'),
        
        _Async = Y.Async,
        _Fs = Y.namespace('Fs'),
        _Mutex = Y.Mutex,
        
        _exclusive = _Mutex.exclusive,
        _map = Y.Array.map,
        _noop = function () {},
        _shared = _Mutex.shared,
        _upgradable = _Mutex.upgradable;
        
    Y.mix(_Fs, {
        baseName: _path.basename,
        clearStatusCache: function (path) {
            path = _Fs.resolvePath(path);
            
            delete _linkStatusCache[path];
            delete _statusCache[path];
        },
        copy: function (fromPath, toPath, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            fromPath = _Fs.resolvePath(fromPath);
            toPath = _Fs.resolvePath(toPath);
            
            _shared(fromPath, function (unlock) {
                _Fs.getType(fromPath, function (error, type) {
                    if (error) {
                        unlock();
                        callbackFunction(error);
                        return;
                    }
                    
                    switch (type) {
                        case 'directory':
                            _Fs.createDirectory(toPath, function (error) {
                                if (error) {
                                    unlock();
                                    callbackFunction(error);
                                    return;
                                }
                                
                                _Fs.listDirectory(fromPath, function (error, fileNames) {
                                    unlock();
                                    
                                    if (error) {
                                        callbackFunction(error);
                                        return;
                                    }
                                    
                                    _Async.runAll(_map(fileNames, function (fileName) {
                                        return function (success) {
                                            _Fs.copy(_Fs.resolvePath(fromPath, fileName), _Fs.resolvePath(toPath, fileName), function (error) {
                                                if (error) {
                                                    success.fail(error);
                                                } else {
                                                    success();
                                                }
                                            });
                                        };
                                    })).on('complete', function (eventFacade) {
                                        callbackFunction(eventFacade.error);
                                    });
                                });
                            });
                            return;
                        case 'file':
                            _Async.runAll(function (success) {
                                _Fs.createReadableStream(fromPath, {}, function (error, readableStream) {
                                    if (error) {
                                        success.fail(error);
                                    } else {
                                        success(readableStream);
                                    }
                                });
                            }, function (success) {
                                _Fs.createWritableStream(toPath, {}, function (error, readableStream) {
                                    if (error) {
                                        success.fail(error);
                                    } else {
                                        success(readableStream);
                                    }
                                });
                            }).on('complete', function (eventFacade) {
                                if (eventFacade.failed) {
                                    unlock();
                                    callbackFunction(eventFacade.error);
                                    return;
                                }
                                
                                var value = eventFacade.value,
                                    toFileStream = value[1];
                                    
                                toFileStream.once('open', function () {
                                    _util.pump(value[0], toFileStream, function (error) {
                                        unlock();
                                        callbackFunction(error);
                                    });
                                });
                            });
                            return;
                        case 'symbolic link':
                            _Fs.getPathFromLink(fromPath, function (error, resolvedPath) {
                                unlock();
                                
                                if (error) {
                                    callbackFunction(error);
                                    return;
                                }
                                
                                _Fs.createSymbolicLink(_Fs.resolvePath(_Fs.directoryName(fromPath), resolvedPath), toPath, function (error) {
                                    callbackFunction(error);
                                });
                            });
                            return;
                    }
                    
                    callbackFunction('Copy hasn\'t been implemented for ' + type + '.');
                });
            });
        },
        createDirectory: function (path, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            path = _Fs.resolvePath(path);
            
            var _exclusive,
                _unlock;
            
            _Async.runQueue(function (success) {
                _upgradable(path, function (unlock, exclusive) {
                    _exclusive = exclusive;
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.exists(path, function (exists) {
                    if (exists) {
                        success.fail();
                    } else {
                        _exclusive(success);
                    }
                });
            }, function (success) {
                var parentPath = _Fs.directoryName(path);
                
                _Fs.exists(parentPath, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        _Fs.createDirectory(parentPath, function (error) {
                            if (error) {
                                success.fail(error);
                            } else {
                                success();
                            }
                        });
                    }
                });
            }, function (success) {
                _fs.mkdir(path, _Fs.getDefaultMode(), function (error) {
                    if (error) {
                        success.fail(error);
                    } else {
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                callbackFunction(eventFacade.error);
            });
        },
        createFile: function (path, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            path = _Fs.resolvePath(path);
            
            var _exclusive,
                _unlock;
            
            _Async.runQueue(function (success) {
                _upgradable(path, function (unlock, exclusive) {
                    _exclusive = exclusive,
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.exists(path, function (exists) {
                    if (exists) {
                        success.fail();
                    } else {
                        _exclusive(success);
                    }
                });
            }, function (success) {
                var parentPath = _Fs.directoryName(path);
                
                _Fs.exists(parentPath, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        _Fs.createDirectory(parentPath, function (error) {
                            if (error) {
                                success.fail(error);
                            } else {
                                success();
                            }
                        });
                    }
                });
            }, function (success) {
                _fs.writeFile(path, '', function (error) {
                    if (error) {
                        success.fail(error);
                    } else {
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                callbackFunction(eventFacade.error);
            });
        },
        createReadableStream: function (path, options, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            var _unlock;
            
            _Async.runQueue(function (success) {
                _shared(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.exists(path, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        success.fail('Doesn\'t exist.');
                    }
                });
            }).on('complete', function (eventFacade) {
                if (eventFacade.failed) {
                    _unlock();
                    callbackFunction(eventFacade.error);
                } else {
                    var readStream = _fs.createReadStream(path, options);
                    readStream.once('close', _unlock);
                    callbackFunction(null, readStream);
                }
            });
        },
        createSymbolicLink: function (linkTo, path, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            linkTo = _Fs.resolvePath(linkTo);
            path = _Fs.resolvePath(path);
            
            var type,
                unlock0,
                unlock1;
            
            _Async.runQueue(function (success) {
                _shared(linkTo, function (unlock) {
                    unlock0 = unlock;
                    success();
                });
            }, function (success) {
                _Fs.exists(linkTo, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        success.fail(linkTo + ' doesn\'t exist.');
                    }
                });
            }, function (success) {
                _Fs.isDirectory(linkTo, function (error, isDirectory) {
                    if (error) {
                        success.fail(error);
                    } else {
                        type = isDirectory ? 'dir' : 'file';
                        success();
                    }
                });
            }, function (success) {
                _exclusive(path, function (unlock) {
                    unlock1 = unlock;
                    success();
                });
            }, function (success) {
                var parentPath = _Fs.directoryName(path);
                
                _Fs.exists(parentPath, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        _Fs.createDirectory(parentPath, function (error) {
                            if (error) {
                                success.fail(error);
                            } else {
                                success();
                            }
                        });
                    }
                });
            }, function (success) {
                _fs.symlink(linkTo, path, type, function (error) {
                    if (error) {
                        success.fail(error);
                    } else {
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                unlock0();
                unlock1();
                
                callbackFunction(eventFacade.error);
            });
        },
        createWritableStream: function (path, options, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            var _unlock;
            
            _Async.runQueue(function (success) {
                _exclusive(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                var parentPath = _Fs.directoryName(path);
                
                _Fs.exists(parentPath, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        _Fs.createDirectory(parentPath, function (error) {
                            if (error) {
                                success.fail(error);
                            } else {
                                success();
                            }
                        });
                    }
                });
            }).on('complete', function (eventFacade) {
                if (eventFacade.failed) {
                    _unlock();
                    callbackFunction(eventFacade.error);
                } else {
                    var writeStream = _fs.createWriteStream(path, options);
                    writeStream.once('close', _unlock);
                    callbackFunction(writeStream);
                }
            });
        },
        'delete': function (path, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            path = _Fs.resolvePath(path);
            
            var _exclusive,
                _unlock;
            
            _Async.runQueue(function (success) {
                _upgradable(path, function (unlock, exclusive) {
                    _exclusive = exclusive;
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                var fail = success.fail;
                
                _Fs.isDirectory(path, function (error, isDirectory) {
                    if (error) {
                        fail(error);
                        return;
                    }
                    
                    if (isDirectory) {
                        _Fs.listDirectory(path, function (error, fileNames) {
                            if (error) {
                                fail(error);
                                return;
                            }
                            
                            _Async.runAll(_map(fileNames, function (fileName) {
                                return function (success) {
                                    _Fs['delete'](_Fs.resolvePath(path, fileName), function (error) {
                                        if (error) {
                                            success.fail(error);
                                        } else {
                                            success();
                                        }
                                    });
                                };
                            })).on('complete', function (eventFacade) {
                                if (eventFacade.failed) {
                                    fail(eventFacade.error);
                                    return;
                                }
                                
                                _exclusive(function () {
                                    _fs.rmdir(path, function (error) {
                                        if (error) {
                                            fail(error);
                                        } else {
                                            success();
                                        }
                                    });
                                });
                            });
                        });
                    } else {
                        _Fs.exists(path, function (exists) {
                            if (exists) {
                                _exclusive(function () {
                                    _fs.unlink(path, function (error) {
                                        if (error) {
                                            fail(error);
                                        } else {
                                            success();
                                        }
                                    });
                                });
                            } else {
                                success();
                            }
                        });
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                
                callbackFunction(eventFacade.error);
            });
        },
        directoryName: _path.dirname,
        exists: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _path.exists(path, function (exists) {
                    unlock();
                    callbackFunction(exists);
                });
            });
        },
        extension: _path.extname,
        find: function (searchPath, fileName, callbackFunction) {
            searchPath = _Fs.resolvePath(searchPath);
            
            var _found = [];
                
            _shared(searchPath, function (unlock) {
                _Fs.isDirectory(searchPath, function (error, isDirectory) {
                    if (error) {
                        unlock();
                        callbackFunction(error);
                        return;
                    }
                    
                    if (!isDirectory) {
                        unlock();
                        
                        if (fileName === _Fs.baseName(searchPath)) {
                            _found.push(searchPath);
                        }
                        
                        callbackFunction(null, _found);
                        return;
                    }
                    
                    _Fs.listDirectory(searchPath, function (error, searchFileNames) {
                        if (error) {
                            unlock();
                            callbackFunction(error);
                            return;
                        }
                        
                        _Async.runAll(_map(searchFileNames, function (searchFileName) {
                            return function (success) {
                                _Fs.find(searchPath + '/' + searchFileName, fileName, function (error, found) {
                                    if (error) {
                                        success.fail(error);
                                    } else {
                                        _found.push.apply(_found, found);
                                        success();
                                    }
                                });
                            };
                        })).on('complete', function (eventFacade) {
                            unlock();
                            
                            if (eventFacade.failed) {
                                callbackFunction(eventFacade.error);
                            } else {
                                callbackFunction(null, _found);
                            }
                        });
                    });
                });
            });
        },
        getAccessTime: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Fs._getStatus(path, function (error, status) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                    } else {
                        callbackFunction(null, status.atime);
                    }
                });
            });
        },
        getChangeTime: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Fs._getStatus(path, function (error, status) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                    } else {
                        callbackFunction(null, status.ctime);
                    }
                });
            });
        },
        getContent: function (path, encoding, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _fs.readFile(path, encoding, function (error, content) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                    } else {
                        callbackFunction(null, content);
                    }
                });
            });
        },
        getDefaultMode: function () {
            return _defaultMode;
        },
        getGroupId: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Fs._getStatus(path, function (error, status) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                    } else {
                        callbackFunction(null, status.gid);
                    }
                });
            });
        },
        getInodeNumber: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Fs._getStatus(path, function (error, status) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                    } else {
                        callbackFunction(null, status.ino);
                    }
                });
            });
        },
        getMode: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Fs._getStatus(path, function (error, status) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                    } else {
                        callbackFunction(null, status.mode);
                    }
                });
            });
        },
        getModificationTime: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Fs._getStatus(path, function (error, status) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                    } else {
                        callbackFunction(null, status.mtime);
                    }
                });
            });
        },
        getOwnerId: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Fs._getStatus(path, function (error, status) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                    } else {
                        callbackFunction(null, status.uid);
                    }
                });
            });
        },
        getPathFromLink: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _fs.readlink(path, function (error, resolvedPath) {
                    unlock();
                    callbackFunction(error, resolvedPath);
                });
            });
        },
        getSize: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Fs._getStatus(path, function (error, status) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                    } else {
                        callbackFunction(null, status.size);
                    }
                });
            });
        },
        getType: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Async.runAll(function (success) {
                    _Fs.isBlockDevice(path, function (error, isBlockDevice) {
                        if (error) {
                            success.fail(error);
                        } else {
                            success(isBlockDevice);
                        }
                    });
                }, function (success) {
                    _Fs.isCharacterDevice(path, function (error, isCharacterDevice) {
                        if (error) {
                            success.fail(error);
                        } else {
                            success(isCharacterDevice);
                        }
                    });
                }, function (success) {
                    _Fs.isDirectory(path, function (error, isDirectory) {
                        if (error) {
                            success.fail(error);
                        } else {
                            success(isDirectory);
                        }
                    });
                }, function (success) {
                    _Fs.isFile(path, function (error, isFile) {
                        if (error) {
                            success.fail(error);
                        } else {
                            success(isFile);
                        }
                    });
                }, function (success) {
                    _Fs.isNamedPipe(path, function (error, isNamedPipe) {
                        if (error) {
                            success.fail(error);
                        } else {
                            success(isNamedPipe);
                        }
                    });
                }, function (success) {
                    _Fs.isSocket(path, function (error, isSocket) {
                        if (error) {
                            success.fail(error);
                        } else {
                            success(isSocket);
                        }
                    });
                }, function (success) {
                    _Fs.isSymbolicLink(path, function (error, isSymbolicLink) {
                        if (error) {
                            success.fail(error);
                        } else {
                            success(isSymbolicLink);
                        }
                    });
                }).on('complete', function (eventFacade) {
                    unlock();

                    if (eventFacade.failed) {
                        callbackFunction(eventFacade.error);
                        return;
                    }

                    var type = eventFacade.value;

                    if (type[0]) {
                        type = 'block device';
                    } else if (type[1]) {
                        type = 'character device';
                    } else if (type[2]) {
                        type = 'directory';
                    } else if (type[3]) {
                        type = 'file';
                    } else if (type[4]) {
                        type = 'named pipe';
                    } else if (type[5]) {
                        type = 'socket';
                    } else if (type[6]) {
                        type = 'symbolic link';
                    } else {
                        type = 'unknown';
                    }

                    callbackFunction(null, type);
                });
            });
        },
        isBlockDevice: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            var _status,
                _unlock;
            
            _Async.runQueue(function (success) {
                _shared(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.exists(path, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        success.fail();
                    }
                });
            }, function (success) {
                _Fs._getStatus(path, function (error, status) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _status = status;
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                
                if (eventFacade.failed) {
                    callbackFunction(eventFacade.error, false);
                } else {
                    callbackFunction(null, _status.isBlockDevice());
                }
            });
        },
        isCharacterDevice: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            var _status,
                _unlock;
            
            _Async.runQueue(function (success) {
                _shared(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.exists(path, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        success.fail();
                    }
                });
            }, function (success) {
                _Fs._getStatus(path, function (error, status) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _status = status;
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                
                if (eventFacade.failed) {
                    callbackFunction(eventFacade.error, false);
                } else {
                    callbackFunction(null, _status.isCharacterDevice());
                }
            });
        },
        isDirectory: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            var _status,
                _unlock;
            
            _Async.runQueue(function (success) {
                _shared(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.exists(path, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        success.fail();
                    }
                });
            }, function (success) {
                _Fs._getStatus(path, function (error, status) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _status = status;
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                
                if (eventFacade.failed) {
                    callbackFunction(eventFacade.error, false);
                } else {
                    callbackFunction(null, _status.isDirectory());
                }
            });
        },
        isExecutable: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Fs._getStatus(path, function (error, status) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                        return;
                    }
                    
                    var index,
                        mode = status.mode.toString(8).substr(-3);
                    
                    if (_process.getuid() === status.uid) {
                        index = 0;
                    } else if (_process.getgid() === status.gid) {
                        index = 1;
                    } else {
                        index = 2;
                    }
                    
                    callbackFunction(null, +(mode.charAt(index)) % 2);
                });
            });
        },
        isFile: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            var _status,
                _unlock;
            
            _Async.runQueue(function (success) {
                _shared(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.exists(path, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        success.fail();
                    }
                });
            }, function (success) {
                _Fs._getStatus(path, function (error, status) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _status = status;
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                
                if (eventFacade.failed) {
                    callbackFunction(eventFacade.error, false);
                } else {
                    callbackFunction(null, _status.isFile());
                }
            });
        },
        isNamedPipe: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            var _status,
                _unlock;
            
            _Async.runQueue(function (success) {
                _shared(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.exists(path, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        success.fail();
                    }
                });
            }, function (success) {
                _Fs._getStatus(path, function (error, status) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _status = status;
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                
                if (eventFacade.failed) {
                    callbackFunction(eventFacade.error, false);
                } else {
                    callbackFunction(null, _status.isFIFO());
                }
            });
        },
        isReadable: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Fs._getStatus(path, function (error, status) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                        return;
                    }
                    
                    var index,
                        mode = status.mode.toString(8).substr(-3);
                    
                    if (_process.getuid() === status.uid) {
                        index = 0;
                    } else if (_process.getgid() === status.gid) {
                        index = 1;
                    } else {
                        index = 2;
                    }
                    
                    callbackFunction(null, +(mode.charAt(index)) >= 4);
                });
            });
        },
        isSocket: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            var _status,
                _unlock;
            
            _Async.runQueue(function (success) {
                _shared(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.exists(path, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        success.fail();
                    }
                });
            }, function (success) {
                _Fs._getStatus(path, function (error, status) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _status = status;
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                
                if (eventFacade.failed) {
                    callbackFunction(eventFacade.error, false);
                } else {
                    callbackFunction(null, _status.isSocket());
                }
            });
        },
        isSymbolicLink: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            var _linkStatus,
                _unlock;
            
            _Async.runQueue(function (success) {
                _shared(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.exists(path, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        success.fail();
                    }
                });
            }, function (success) {
                _Fs._getLinkStatus(path, function (error, linkStatus) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _linkStatus = linkStatus;
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                
                if (eventFacade.failed) {
                    callbackFunction(eventFacade.error, false);
                } else {
                    callbackFunction(null, _linkStatus.isSymbolicLink());
                }
            });
        },
        isWritable: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _Fs._getStatus(path, function (error, status) {
                    unlock();
                    
                    if (error) {
                        callbackFunction(error);
                        return;
                    }
                    
                    var index,
                        mode = status.mode.toString(8).substr(-3),
                        value;
                    
                    if (_process.getuid() === status.uid) {
                        index = 0;
                    } else if (_process.getgid() === status.gid) {
                        index = 1;
                    } else {
                        index = 2;
                    }
                    
                    value = +(mode.charAt(index));
                    
                    callbackFunction(null, value === 2 || value === 3 || value === 6 || value === 7);
                });
            });
        },
        joinPath: _path.join,
        listDirectory: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            _shared(path, function (unlock) {
                _fs.readdir(path, function (error, fileNames) {
                    unlock();
                    callbackFunction(error, fileNames);
                });
            });
        },
        move: function (fromPath, toPath, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            fromPath = _Fs.resolvePath(fromPath);
            toPath = _Fs.resolvePath(toPath);
            
            _Fs.copy(fromPath, toPath, function (error) {
                if (error) {
                    callbackFunction(error);
                    return;
                }
                
                _Fs['delete'](fromPath, callbackFunction);
            });
        },
        normalizePath: _path.normalize,
        relativePath: _path.relative,
        rename: function (fromPath, toPath, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            fromPath = _Fs.resolvePath(fromPath);
            toPath = _Fs.resolvePath(toPath);
            
            _Async.runAll(function (success) {
                _exclusive(fromPath, success);
            }, function (success) {
                _exclusive(toPath, success);
            }).on('complete', function (eventFacade) {
                _fs.rename(fromPath, toPath, function (error) {
                    var unlocks = eventFacade.value;
                    unlocks[0]();
                    unlocks[1]();
                    
                    callbackFunction(error);
                });
            });
        },
        resolvePath: _path.resolve,
        setAccessTime: function (path, accessTime, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            path = _Fs.resolvePath(path);
            
            var _exclusive,
                _modificationTime,
                _unlock;
            
            _Async.runQueue(function (success) {
                _upgradable(path, function (unlock, exclusive) {
                    _exclusive = exclusive;
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.getModificationTime(path, function (error, modificationTime) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _modificationTime = modificationTime;
                        success();
                    }
                });
            }, function (success) {
                _exclusive(success);
            }, function (success) {
                _fs.utimes(path, accessTime, _modificationTime, function (error) {
                    if (error) {
                        success.fail(error);
                    } else {
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                callbackFunction(eventFacade.error);
            });
        },
        setContent: function (path, content, encoding, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            path = _Fs.resolvePath(path);
            
            var _unlock;
            
            _Async.runQueue(function (success) {
                _exclusive(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                var parentPath = _Fs.directoryName(path);
                
                _Fs.exists(parentPath, function (exists) {
                    if (exists) {
                        success();
                    } else {
                        _Fs.createDirectory(parentPath, function (error) {
                            if (error) {
                                success.fail(error);
                            } else {
                                success();
                            }
                        });
                    }
                });
            }, function (success) {
                _fs.writeFile(path, content, encoding, function (error) {
                    if (error) {
                        success.fail(error);
                    } else {
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                callbackFunction(eventFacade.error);
            });
        },
        setDefaultMode: function (defaultMode) {
            _defaultMode = defaultMode;
        },
        setGroupId: function (path, groupId, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            path = _Fs.resolvePath(path);
            
            var _exclusive,
                _ownerId,
                _unlock;
            
            _Async.runQueue(function (success) {
                _upgradable(path, function (unlock, exclusive) {
                    _exclusive = exclusive;
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.getOwnerId(path, function (error, ownerId) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _ownerId = ownerId;
                        success();
                    }
                });
            }, function (success) {
                _exclusive(success);
            }, function (success) {
                _fs.chown(path, _ownerId, groupId, function (error) {
                    if (error) {
                        success.fail(error);
                    } else {
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                callbackFunction(eventFacade.error);
            });
        },
        setMode: function (path, mode, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            path = _Fs.resolvePath(path);
            
            var _unlock;
            
            _Async.runQueue(function (success) {
                _exclusive(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _fs.chmod(path, mode, function (error) {
                    if (error) {
                        success.fail(error);
                    } else {
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                callbackFunction(eventFacade.error);
            });
        },
        setModificationTime: function (path, modificationTime, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            path = _Fs.resolvePath(path);
            
            var _accessTime,
                _exclusive,
                _unlock;
            
            _Async.runQueue(function (success) {
                _upgradable(path, function (unlock, exclusive) {
                    _exclusive = exclusive;
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.getAccessTime(path, function (error, accessTime) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _accessTime = accessTime;
                        success();
                    }
                });
            }, function (success) {
                _exclusive(success);
            }, function (success) {
                _fs.utimes(path, _accessTime, modificationTime, function (error) {
                    if (error) {
                        success.fail(error);
                    } else {
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                callbackFunction(eventFacade.error);
            });
        },
        setOwnerId: function (path, ownerId, callbackFunction) {
            callbackFunction = callbackFunction || _noop;
            path = _Fs.resolvePath(path);
            
            var _exclusive,
                _groupId,
                _unlock;
            
            _Async.runQueue(function (success) {
                _upgradable(path, function (unlock, exclusive) {
                    _exclusive = exclusive;
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _Fs.getGroupId(path, function (error, groupId) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _groupId = groupId;
                        success();
                    }
                });
            }, function (success) {
                _exclusive(success);
            }, function (success) {
                _fs.chown(path, ownerId, _groupId, function (error) {
                    if (error) {
                        success.fail(error);
                    } else {
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                callbackFunction(eventFacade.error);
            });
        },
        _getLinkStatus: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            var _linkStatus,
                _unlock;
            
            _Async.runQueue(function (success) {
                _shared(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _linkStatus = _linkStatusCache[path];
                
                if (_linkStatus) {
                    success();
                    return;
                }
                
                _fs.lstat(path, function (error, linkStatus) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _linkStatus = linkStatus;
                        _linkStatusCache[path] = _linkStatus;
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                
                if (eventFacade.failed) {
                    callbackFunction(eventFacade.error);
                } else {
                    callbackFunction(null, _linkStatus);
                }
            });
        },
        _getStatus: function (path, callbackFunction) {
            path = _Fs.resolvePath(path);
            
            var _status,
                _unlock;
            
            _Async.runQueue(function (success) {
                _shared(path, function (unlock) {
                    _unlock = unlock;
                    success();
                });
            }, function (success) {
                _status = _statusCache[path];
                
                if (_status) {
                    success();
                    return;
                }
                
                _fs.stat(path, function (error, status) {
                    if (error) {
                        success.fail(error);
                    } else {
                        _status = status;
                        _statusCache[path] = _status;
                        success();
                    }
                });
            }).on('complete', function (eventFacade) {
                _unlock();
                
                if (eventFacade.failed) {
                    callbackFunction(eventFacade.error);
                } else {
                    callbackFunction(null, _status);
                }
            });
        }
    });
}(Y));