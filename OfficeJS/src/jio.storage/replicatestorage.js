var newReplicateStorage = function ( spec, my ) {
    var that = Jio.storage( spec, my, 'handler' ), priv = {};

    priv.return_value_array = [];
    priv.storagelist = spec.storagelist || [];
    priv.nb_storage = priv.storagelist.length;

    var super_serialized = that.serialized;
    that.serialized = function () {
        var o = super_serialized();
        o.storagelist = priv.storagelist;
        return o;
    };

    that.validateState = function () {
        if (priv.storagelist.length === 0) {
            return 'Need at least one parameter: "storagelist" '+
                'containing at least one storage.';
        }
        return '';
    };

    priv.isTheLast = function () {
        return (priv.return_value_array.length === priv.nb_storage);
    };

    priv.doJob = function (command,errormessage) {
        var done = false, error_array = [], i,
        onResponseDo = function (result) {
            priv.return_value_array.push(result);
        },
        onFailDo = function (result) {
            if (!done) {
                error_array.push(result);
                if (priv.isTheLast()) {
                    that.fail (
                        {status:207,
                         statusText:'Multi-Status',
                         message:errormessage,
                         array:error_array});
                }
            }
        },
        onDoneDo = function (result) {
            if (!done) {
                done = true;
                that.done (result);
            }
        };
        command.setMaxRetry (1);
        for (i = 0; i < priv.nb_storage; i+= 1) {
            var newcommand = command.clone();
            var newstorage = that.newStorage(priv.storagelist[i]);
            newcommand.onResponseDo (onResponseDo);
            newcommand.onFailDo (onFailDo);
            newcommand.onDoneDo (onDoneDo);
            that.addJob (newstorage, newcommand);
        }
    };

    /**
     * Save a document in several storages.
     * @method saveDocument
     */
    that.saveDocument = function (command) {
        priv.doJob (
            command.clone(),
            'All save "'+ command.getPath() +'" requests have failed.');
    };

    /**
     * Load a document from several storages, and send the first retreived
     * document.
     * @method loadDocument
     */
    that.loadDocument = function (command) {
        priv.doJob (
            command.clone(),
            'All load "'+ command.getPath() +'" requests have failed.');
    };

    /**
     * Get a document list from several storages, and returns the first
     * retreived document list.
     * @method getDocumentList
     */
    that.getDocumentList = function (command) {
        priv.doJob (
            command.clone(),
            'All get document list requests have failed.');
    };

    /**
     * Remove a document from several storages.
     * @method removeDocument
     */
    that.removeDocument = function (command) {
        priv.doJob (
            command.clone(),
            'All remove "' + command.getPath() + '" requests have failed.');
    };

    return that;
};
Jio.addStorageType('replicate', newReplicateStorage);
