YUI.add('module-tests', function (Y) {
    'use strict';

    var suite = new Y.Test.Suite('gallery-mutex');

    suite.add(new Y.Test.Case({
        name: 'Automated Tests',
        'test:001-apiExists': function () {
            Y.Assert.isObject(Y.Mutex, 'Y.Mutex should be an object.');

            Y.Assert.isFunction(Y.Mutex.exclusive, 'Y.Mutex.exclusive should be a function.');
            Y.Assert.isFunction(Y.Mutex.shared, 'Y.Mutex.shared should be a function.');
            Y.Assert.isFunction(Y.Mutex.upgradable, 'Y.Mutex.upgradable should be a function.');
        },
        'test:002-obtainExclusiveLock': function () {
            var count = 5,
                i = 0,
                lockEvents = [],
                test = this,

                lockFn = function (i) {
                    return function (unlock) {
                        lockEvents.push('obtainedExclusive' + i);

                        Y.soon(function () {
                            unlock();
                            lockEvents.push('unlockedExclusive' + i);

                            if (i + 1 === count) {
                                test.resume(function () {
                                    for (i = 0; i < count; i += 1) {
                                        Y.Assert.areSame('requestExclusive' + i, lockEvents[i], 'lock events should have happened in order.');
                                        Y.Assert.areSame('obtainedExclusive' + i, lockEvents[count + 2 * i], 'lock events should have happened in order.');
                                        Y.Assert.areSame('unlockedExclusive' + i, lockEvents[count + 2 * i + 1], 'lock events should have happened in order.');
                                    }
                                });
                            }
                        });
                    };
                };

            for (; i < count; i += 1) {
                lockEvents.push('requestExclusive' + i);
                Y.Mutex.exclusive('lock', lockFn(i));
            }

            test.wait(610);
        },
        'test:003-cancelExclusiveLock': function () {
            var cancelObject,
                cancelObjects = [],
                count = 5,
                i = 0,
                lockEvents = [],
                test = this,

                lockFn = function (i) {
                    return function (unlock) {
                        lockEvents.push('obtainedExclusive' + i);

                        if (i % 2) {
                            lockEvents.push('cancelExclusive' + i);
                            cancelObjects[i].cancel();
                        } else {
                            Y.soon(function () {
                                unlock();
                                lockEvents.push('unlockedExclusive' + i);

                                if (i + 1 === count) {
                                    test.resume(function () {
                                        for (i = 0; i < count; i += 1) {
                                            Y.Assert.areSame('requestExclusive' + i, lockEvents[i], 'lock events should have happened in order.');
                                            Y.Assert.areSame('obtainedExclusive' + i, lockEvents[count + 2 * i], 'lock events should have happened in order.');
                                            Y.Assert.areSame(i % 2 ? 'cancelExclusive' + i : 'unlockedExclusive' + i, lockEvents[count + 2 * i + 1], 'lock events should have happened in order.');
                                        }
                                    });
                                }
                            });
                        }
                    };
                };

            for (; i < count; i += 1) {
                lockEvents.push('requestExclusive' + i);
                cancelObject = Y.Mutex.exclusive('lock', lockFn(i));

                Y.Assert.isObject(cancelObject, 'cancelObject should be an object.');
                Y.Assert.isFunction(cancelObject.cancel, 'cancelObject.cancel should be a function.');
                Y.Assert.areSame('exclusive', cancelObject.mode, 'cancelObject.mode should be \'exclusive\'.');

                cancelObjects.push(cancelObject);
            }

            test.wait(610);
        },
        'test:004-timeoutExclusiveLock': function () {
            var count = 5, // should be an odd number
                i = 0,
                lockEvents = [],
                test = this,

                lockFn = function (i) {
                    return function (unlock) {
                        lockEvents.push('obtainedExclusive' + i);

                        Y.later(i % 2 ? 8 : 144, null, function () {
                            unlock();
                            lockEvents.push('unlockedExclusive' + i);

                            if (i + 1 === count) {
                                test.resume(function () {
                                    for (i = 0; i < count; i += 1) {
                                        Y.Assert.areSame('requestExclusive' + i, lockEvents[i], 'lock events should have happened in order.');
                                        Y.Assert.areSame('obtainedExclusive' + i, lockEvents[count + i + Math.floor(i / 2)], 'lock events should have happened in order.');
                                        Y.Assert.areSame('unlockedExclusive' + i, lockEvents[i % 2 ? count + i + Math.floor(i / 2) + 1 : 2 * count + i / 2 + Math.floor(count / 2)], 'lock events should have happened in order.');
                                    }
                                });
                            }
                        });
                    };
                };

            for (; i < count; i += 1) {
                lockEvents.push('requestExclusive' + i);
                Y.Mutex.exclusive('lock', lockFn(i), 21);
            }

            test.wait(610);
        },
        'test:005-obtainSharedLock': function () {
            var allObtained,
                count = 5,
                i = 0,
                lockEvents = [],
                obtainedLocks = [],
                test = this,

                lockFn = function (i) {
                    return function (unlock) {
                        lockEvents.push('obtainedShared');
                        obtainedLocks[i] = true;

                        allObtained = allObtained || Y.Array.some(obtainedLocks, function (obtainedLock) {
                            return obtainedLock;
                        });

                        Y.later(144, null, function () {
                            unlock();
                            lockEvents.push('unlockedShared');
                            obtainedLocks[i] = false;
                        });
                    };
                };

            for (; i < count; i += 1) {
                obtainedLocks[i] = false;
                lockEvents.push('requestShared' + i);
                Y.Mutex.shared('lock', lockFn(i));
            }

            lockEvents.push('requestExclusive0');
            Y.Mutex.exclusive('lock', function (unlock) {
                lockEvents.push('obtainedExclusive0');

                Y.soon(function () {
                    unlock();
                    lockEvents.push('unlockedExclusive0');

                    test.resume(function () {
                        Y.Assert.isTrue(allObtained, 'all shared locks should have been obtained at the same time.');

                        for (i = 0; i < count; i += 1) {
                            Y.Assert.areSame('requestShared' + i, lockEvents[i], 'lock events should have happened in order.');
                            Y.Assert.areSame('obtainedShared', lockEvents[count + i + 1], 'lock events should have happened in order.');
                            Y.Assert.areSame('unlockedShared', lockEvents[2 * count + i + 1], 'lock events should have happened in order.');
                        }

                        Y.Assert.areSame('requestExclusive0', lockEvents[count], 'lock events should have happened in order.');
                        Y.Assert.areSame('obtainedExclusive0', lockEvents[3 * count + 1], 'lock events should have happened in order.');
                        Y.Assert.areSame('unlockedExclusive0', lockEvents[3 * count + 2], 'lock events should have happened in order.');
                    });
                });
            });

            test.wait(610);
        },
        'test:006-cancelSharedLock': function () {
            var allObtained,
                cancelObject,
                cancelObjects = [],
                count = 5,
                i = 0,
                lockEvents = [],
                obtainedLocks = [],
                test = this,

                lockFn = function (i) {
                    return function (unlock) {
                        lockEvents.push('obtainedShared');
                        obtainedLocks[i] = true;

                        allObtained = allObtained || Y.Array.some(obtainedLocks, function (obtainedLock) {
                            return obtainedLock;
                        });

                        Y.later(144, null, function () {
                            if (i % 2) {
                                lockEvents.push('cancelShared');
                                cancelObjects[i].cancel();
                            } else {
                                unlock();
                                lockEvents.push('unlockedShared');
                            }

                            obtainedLocks[i] = false;
                        });
                    };
                };

            for (; i < count; i += 1) {
                obtainedLocks[i] = false;
                lockEvents.push('requestShared' + i);
                cancelObject = Y.Mutex.shared('lock', lockFn(i));

                Y.Assert.isObject(cancelObject, 'cancelObject should be an object.');
                Y.Assert.isFunction(cancelObject.cancel, 'cancelObject.cancel should be a function.');
                Y.Assert.areSame('shared', cancelObject.mode, 'cancelObject.mode should be \'shared\'.');

                cancelObjects.push(cancelObject);
            }

            lockEvents.push('requestExclusive0');
            Y.Mutex.exclusive('lock', function (unlock) {
                lockEvents.push('obtainedExclusive0');

                Y.soon(function () {
                    unlock();
                    lockEvents.push('unlockedExclusive0');

                    test.resume(function () {
                        Y.Assert.isTrue(allObtained, 'all shared locks should have been obtained at the same time.');

                        for (i = 0; i < count; i += 1) {
                            Y.Assert.areSame('requestShared' + i, lockEvents[i], 'lock events should have happened in order.');
                            Y.Assert.areSame('obtainedShared', lockEvents[count + i + 1], 'lock events should have happened in order.');
                            Y.Assert.areSame(i % 2 ? 'cancelShared' : 'unlockedShared', lockEvents[2 * count + i + 1], 'lock events should have happened in order.');
                        }

                        Y.Assert.areSame('requestExclusive0', lockEvents[count], 'lock events should have happened in order.');
                        Y.Assert.areSame('obtainedExclusive0', lockEvents[3 * count + 1], 'lock events should have happened in order.');
                        Y.Assert.areSame('unlockedExclusive0', lockEvents[3 * count + 2], 'lock events should have happened in order.');
                    });
                });
            });

            test.wait(610);
        },
        'test:007-timeoutSharedLock': function () {
            var count = 5,
                i = 0,
                lockEvents = [],
                test = this,

                lockFn = function (unlock) {
                    lockEvents.push('obtainedShared');
                    // This lockFn doesn't call unlock because it's testing the
                    // timeout feature.  Under ordinary circumstances the unlock
                    // function should always be called.
                };

            for (; i < count; i += 1) {
                lockEvents.push('requestShared' + i);
                Y.Mutex.shared('lock', lockFn, 144);
            }

            lockEvents.push('requestExclusive0');
            Y.Mutex.exclusive('lock', function (unlock) {
                lockEvents.push('obtainedExclusive0');

                Y.soon(function () {
                    unlock();
                    lockEvents.push('unlockedExclusive0');

                    test.resume(function () {
                        for (i = 0; i < count; i += 1) {
                            Y.Assert.areSame('requestShared' + i, lockEvents[i], 'lock events should have happened in order.');
                            Y.Assert.areSame('obtainedShared', lockEvents[count + i + 1], 'lock events should have happened in order.');
                        }

                        Y.Assert.areSame('requestExclusive0', lockEvents[count], 'lock events should have happened in order.');
                        Y.Assert.areSame('obtainedExclusive0', lockEvents[2 * count + 1], 'lock events should have happened in order.');
                        Y.Assert.areSame('unlockedExclusive0', lockEvents[2 * count + 2], 'lock events should have happened in order.');
                    });
                });
            });

            test.wait(610);
        },
        'test:008-obtainSharedLockAfterExclusiveLock': function () {
            var allObtained,
                count = 5,
                i = 0,
                lockEvents = [],
                obtainedLocks = [],
                test = this,

                lockFn = function (i) {
                    return function (unlock) {
                        lockEvents.push('obtainedShared' + i);
                        obtainedLocks[i] = true;

                        allObtained = allObtained || Y.Array.some(obtainedLocks, function (obtainedLock) {
                            return obtainedLock;
                        });

                        Y.later(144, null, function () {
                            unlock();
                            lockEvents.push('unlockedShared' + i);
                            obtainedLocks[i] = false;
                        });
                    };
                };

            lockEvents.push('requestExclusive0');
            Y.Mutex.exclusive('lock', function (unlock) {
                lockEvents.push('obtainedExclusive0');

                Y.soon(function () {
                    unlock();
                    lockEvents.push('unlockedExclusive0');

                    Y.soon(function () {
                        lockEvents.push('requestExclusive1');
                        Y.Mutex.exclusive('lock', function (unlock) {
                            lockEvents.push('obtainedExclusive1');

                            Y.soon(function () {
                                unlock();
                                lockEvents.push('unlockedExclusive1');

                                test.resume(function () {
                                    Y.Assert.areSame('requestExclusive0', lockEvents[0], 'lock events should have happened in order.');
                                    Y.Assert.areSame('obtainedExclusive0', lockEvents[count + 1], 'lock events should have happened in order.');
                                    Y.Assert.areSame('unlockedExclusive0', lockEvents[count + 2], 'lock events should have happened in order.');

                                    Y.Assert.isTrue(allObtained, 'all shared locks should have been obtained at the same time.');

                                    for (i = 0; i < count; i += 1) {
                                        Y.Assert.areSame('requestShared' + i, lockEvents[i + 1], 'lock events should have happened in order.');
                                        Y.Assert.areSame('obtainedShared' + i, lockEvents[count + i + 3], 'lock events should have happened in order.');
                                        Y.Assert.areSame('unlockedShared' + i, lockEvents[2 * count + i + 4], 'lock events should have happened in order.');
                                    }

                                    Y.Assert.areSame('requestExclusive1', lockEvents[2 * count + 3], 'lock events should have happened in order.');
                                    Y.Assert.areSame('obtainedExclusive1', lockEvents[3 * count + 4], 'lock events should have happened in order.');
                                    Y.Assert.areSame('unlockedExclusive1', lockEvents[3 * count + 5], 'lock events should have happened in order.');
                                });
                            });
                        });
                    });
                });
            });

            for (; i < count; i += 1) {
                obtainedLocks[i] = false;
                lockEvents.push('requestShared' + i);
                Y.Mutex.shared('lock', lockFn(i));
            }

            test.wait(610);
        },
        'test:009-obtainUpgadableLock': function () {
            var count = 5,
                i = 0,
                lockEvents = [],
                test = this,

                lockFn = function (i) {
                    return function (unlock) {
                        lockEvents.push('obtainedUpgradable' + i);

                        Y.soon(function () {
                            unlock();
                            lockEvents.push('unlockedUpgradable' + i);

                            if (i + 1 === count) {
                                test.resume(function () {
                                    for (i = 0; i < count; i += 1) {
                                        Y.Assert.areSame('requestUpgradable' + i, lockEvents[i], 'lock events should have happened in order.');
                                        Y.Assert.areSame('obtainedUpgradable' + i, lockEvents[count + 2 * i], 'lock events should have happened in order.');
                                        Y.Assert.areSame('unlockedUpgradable' + i, lockEvents[count + 2 * i + 1], 'lock events should have happened in order.');
                                    }
                                });
                            }
                        });
                    };
                };

            for (; i < count; i += 1) {
                lockEvents.push('requestUpgradable' + i);
                Y.Mutex.upgradable('lock', lockFn(i));
            }

            test.wait(610);
        },
        'test:010-cancelUpgradableLock': function () {
            var cancelObject,
                cancelObjects = [],
                count = 5,
                i = 0,
                lockEvents = [],
                test = this,

                lockFn = function (i) {
                    return function (unlock) {
                        lockEvents.push('obtainedUpgradable' + i);

                        if (i % 2) {
                            lockEvents.push('cancelUpgradable' + i);
                            cancelObjects[i].cancel();
                        } else {
                            Y.soon(function () {
                                unlock();
                                lockEvents.push('unlockedUpgradable' + i);

                                if (i + 1 === count) {
                                    test.resume(function () {
                                        for (i = 0; i < count; i += 1) {
                                            Y.Assert.areSame('requestUpgradable' + i, lockEvents[i], 'lock events should have happened in order.');
                                            Y.Assert.areSame('obtainedUpgradable' + i, lockEvents[count + 2 * i], 'lock events should have happened in order.');
                                            Y.Assert.areSame(i % 2 ? 'cancelUpgradable' + i : 'unlockedUpgradable' + i, lockEvents[count + 2 * i + 1], 'lock events should have happened in order.');
                                        }
                                    });
                                }
                            });
                        }
                    };
                };

            for (; i < count; i += 1) {
                lockEvents.push('requestUpgradable' + i);
                cancelObject = Y.Mutex.upgradable('lock', lockFn(i));

                Y.Assert.isObject(cancelObject, 'cancelObject should be an object.');
                Y.Assert.isFunction(cancelObject.cancel, 'cancelObject.cancel should be a function.');
                Y.Assert.areSame('upgradable', cancelObject.mode, 'cancelObject.mode should be \'upgradable\'.');

                cancelObjects.push(cancelObject);
            }

            test.wait(610);
        },
        'test:011-timeoutUpgradableLock': function () {
            var count = 5, // should be an odd number
                i = 0,
                lockEvents = [],
                test = this,

                lockFn = function (i) {
                    return function (unlock) {
                        lockEvents.push('obtainedUpgradable' + i);

                        Y.later(i % 2 ? 8 : 144, null, function () {
                            unlock();
                            lockEvents.push('unlockedUpgradable' + i);

                            if (i + 1 === count) {
                                test.resume(function () {
                                    for (i = 0; i < count; i += 1) {
                                        Y.Assert.areSame('requestUpgradable' + i, lockEvents[i], 'lock events should have happened in order.');
                                        Y.Assert.areSame('obtainedUpgradable' + i, lockEvents[count + i + Math.floor(i / 2)], 'lock events should have happened in order.');
                                        Y.Assert.areSame('unlockedUpgradable' + i, lockEvents[i % 2 ? count + i + Math.floor(i / 2) + 1 : 2 * count + i / 2 + Math.floor(count / 2)], 'lock events should have happened in order.');
                                    }
                                });
                            }
                        });
                    };
                };

            for (; i < count; i += 1) {
                lockEvents.push('requestUpgradable' + i);
                Y.Mutex.upgradable('lock', lockFn(i), 21);
            }

            test.wait(610);
        },
        'test:012-upgradeUpgadableLock': function () {
            var lockEvents = [],
                test = this;

            lockEvents.push('requestUpgradable0');
            Y.Mutex.upgradable('lock', function (unlock, exclusive) {
                lockEvents.push('obtainUpgradable0');

                Y.later(144, null, function () {
                    lockEvents.push('requestExclusiveUpgradable0');
                    exclusive(function () {
                        lockEvents.push('obtainExclusiveUpgradable0');

                        lockEvents.push('requestShared0');
                        Y.Mutex.shared('lock', function (unlock) {
                            lockEvents.push('obtainShared0');

                            lockEvents.push('requestExclusive0');
                            Y.Mutex.exclusive('lock', function (unlock) {
                                lockEvents.push('obtainExclusive0');

                                Y.soon(function () {
                                    unlock();
                                    lockEvents.push('unlockedExclusive0');

                                    test.resume(function () {
                                        Y.ArrayAssert.itemsAreSame([
                                            'requestUpgradable0',
                                            'obtainUpgradable0',
                                            'requestExclusiveUpgradable0',
                                            'obtainExclusiveUpgradable0',
                                            'requestShared0',
                                            'unlockedUpgradable0',
                                            'obtainShared0',
                                            'requestExclusive0',
                                            'unlockedShared0',
                                            'obtainExclusive0',
                                            'unlockedExclusive0'
                                        ], lockEvents, 'lock events should have happened in order.');
                                    });
                                });
                            });

                            Y.later(144, null, function () {
                                unlock();
                                lockEvents.push('unlockedShared0');
                            });
                        });

                        Y.later(144, null, function () {
                            unlock();
                            lockEvents.push('unlockedUpgradable0');
                        });
                    });
                });
            });

            test.wait(610);
        },
        'test:013-shareUpgradableLock': function () {
            var allObtained,
                count = 5,
                i = 0,
                lockEvents = [],
                obtainedLocks = [],
                test = this,

                lockFn = function (i) {
                    return function (unlock) {
                        lockEvents.push('obtainedShared');
                        obtainedLocks[i] = true;

                        allObtained = allObtained || Y.Array.some(obtainedLocks, function (obtainedLock) {
                            return obtainedLock;
                        });

                        Y.later(144, null, function () {
                            unlock();
                            lockEvents.push('unlockedShared');
                            obtainedLocks[i] = false;
                        });
                    };
                };

            obtainedLocks[count] = false;
            lockEvents.push('requestUpgradable0');
            Y.Mutex.upgradable('lock', function (unlock) {
                lockEvents.push('obtainedUpgradable0');
                obtainedLocks[count] = true;

                allObtained = allObtained || Y.Array.some(obtainedLocks, function (obtainedLock) {
                    return obtainedLock;
                });

                Y.later(144, null, function () {
                    unlock();
                    lockEvents.push('unlockedUpgradable0');
                    obtainedLocks[count] = false;
                });
            });

            Y.later(21, null, function () {
                for (; i < count; i += 1) {
                    obtainedLocks[i] = false;
                    lockEvents.push('requestShared' + i);
                    Y.Mutex.shared('lock', lockFn(i));
                }

                lockEvents.push('requestExclusive0');
                Y.Mutex.exclusive('lock', function (unlock) {
                    lockEvents.push('obtainedExclusive0');

                    Y.soon(function () {
                        unlock();
                        lockEvents.push('unlockedExclusive0');

                        test.resume(function () {
                            Y.Assert.isTrue(allObtained, 'all shared locks should have been obtained at the same time.');

                            Y.Assert.areSame('requestUpgradable0', lockEvents[0], 'lock events should have happened in order.');
                            Y.Assert.areSame('obtainedUpgradable0', lockEvents[1], 'lock events should have happened in order.');
                            Y.Assert.areSame('unlockedUpgradable0', lockEvents[2 * count + 3], 'lock events should have happened in order.');

                            for (i = 0; i < count; i += 1) {
                                Y.Assert.areSame('requestShared' + i, lockEvents[i + 2], 'lock events should have happened in order.');
                                Y.Assert.areSame('obtainedShared', lockEvents[count + i + 3], 'lock events should have happened in order.');
                                Y.Assert.areSame('unlockedShared', lockEvents[2 * count + i + 4], 'lock events should have happened in order.');
                            }

                            Y.Assert.areSame('requestExclusive0', lockEvents[count + 2], 'lock events should have happened in order.');
                            Y.Assert.areSame('obtainedExclusive0', lockEvents[3 * count + 4], 'lock events should have happened in order.');
                            Y.Assert.areSame('unlockedExclusive0', lockEvents[3 * count + 5], 'lock events should have happened in order.');
                        });
                    });
                });
            });

            test.wait(610);
        },
        'test:014-upgradeDowngradeShareUpgradableLock': function () {
            var count = 5,
                i = 0,
                lockEvents = [],
                test = this,

                lockFn = function (unlock) {
                    lockEvents.push('obtainedShared');

                    Y.later(89, null, function () {
                        unlock();
                        lockEvents.push('unlockedShared');
                    });
                };

            lockEvents.push('requestUpgradable0');
            Y.Mutex.upgradable('lock', function (unlock, exclusive) {
                lockEvents.push('obtainedUpgradable0');

                Y.later(89, null, function () {
                    lockEvents.push('requestExclusiveUpgradable0');
                    exclusive(function (shared) {
                        lockEvents.push('obtainedExclusiveUpgradable0');

                        for (var i = 0; i < count; i += 1) {
                            lockEvents.push('requestShared' + (count + i));
                            Y.Mutex.shared('lock', lockFn);
                        }

                        Y.later(89, null, function () {
                            lockEvents.push('requestSharedUpgradable0');
                            shared(function () {
                                lockEvents.push('obtainedSharedUpgradable0');

                                Y.later(89, null, function () {
                                    unlock();
                                    lockEvents.push('unlockedUpgradable0');

                                    lockEvents.push('requestExclusive0');
                                    Y.Mutex.exclusive('lock', function (unlock) {
                                        lockEvents.push('obtainedExclusive0');

                                        Y.soon(function () {
                                            unlock();
                                            lockEvents.push('unlockedExclusive0');

                                            test.resume(function () {
                                                Y.Assert.areSame('requestUpgradable0', lockEvents[0], 'lock events should have happened in order.');
                                                Y.Assert.areSame('obtainedUpgradable0', lockEvents[1], 'lock events should have happened in order.');
                                                Y.Assert.areSame('requestExclusiveUpgradable0', lockEvents[2 * count + 2], 'lock events should have happened in order.');
                                                Y.Assert.areSame('obtainedExclusiveUpgradable0', lockEvents[3 * count + 3], 'lock events should have happened in order.');
                                                Y.Assert.areSame('requestSharedUpgradable0', lockEvents[4 * count + 4], 'lock events should have happened in order.');
                                                Y.Assert.areSame('obtainedSharedUpgradable0', lockEvents[5 * count + 5], 'lock events should have happened in order.');
                                                Y.Assert.areSame('unlockedUpgradable0', lockEvents[6 * count + 6], 'lock events should have happened in order.');

                                                for (i = 0; i < count; i += 1) {
                                                    Y.Assert.areSame('requestShared' + i, lockEvents[i + 2], 'lock events should have happened in order.');
                                                    Y.Assert.areSame('obtainedShared', lockEvents[count + i + 2], 'lock events should have happened in order.');
                                                    Y.Assert.areSame('unlockedShared', lockEvents[2 * count + i + 3], 'lock events should have happened in order.');

                                                    Y.Assert.areSame('requestShared' + (count + i), lockEvents[3 * count + i + 4], 'lock events should have happened in order.');
                                                    Y.Assert.areSame('obtainedShared', lockEvents[4 * count + i + 5], 'lock events should have happened in order.');
                                                    Y.Assert.areSame('unlockedShared', lockEvents[5 * count + i + 6], 'lock events should have happened in order.');
                                                }

                                                Y.Assert.areSame('requestExclusive0', lockEvents[6 * count + 7], 'lock events should have happened in order.');
                                                Y.Assert.areSame('obtainedExclusive0', lockEvents[6 * count + 8], 'lock events should have happened in order.');
                                                Y.Assert.areSame('unlockedExclusive0', lockEvents[6 * count + 9], 'lock events should have happened in order.');
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });

            Y.later(21, null, function () {
                for (; i < count; i += 1) {
                    lockEvents.push('requestShared' + i);
                    Y.Mutex.shared('lock', lockFn);
                }
            });

            test.wait(610);
        }
    }));

    Y.Test.Runner.add(suite);
}, '', {
    requires: [
        'gallery-mutex',
        'test'
    ]
});