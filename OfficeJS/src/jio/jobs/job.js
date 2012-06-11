var job = function(spec, my) {
    var that = {};
    spec = spec || {};
    my = my || {};
    // Attributes //
    var priv = {};
    priv.id        = jobIdHandler.nextId();
    priv.command   = spec.command;
    priv.storage   = spec.storage;
    priv.status    = initialStatus();
    priv.tried     = 0;
    priv.max_retry = 0;
    priv.date      = new Date();

    // Initialize //
    (function() {
        if (!priv.storage){
            throw invalidJobException({job:that,message:'No storage set'});
        }
        if (!priv.command){
            throw invalidJobException({job:that,message:'No command set'});
        }
    }());
    // Methods //
    /**
     * Returns the job command.
     * @method getCommand
     * @return {object} The job command.
     */
    that.getCommand = function() {
        return priv.command;
    };

    that.getStatus = function() {
        return priv.status;
    };

    that.getId = function() {
        return priv.id;
    };

    that.getStorage = function() {
        return priv.storage;
    };

    /**
     * Checks if the job is ready.
     * @method isReady
     * @return {boolean} true if ready, else false.
     */
    that.isReady = function() {
        if (priv.tried === 0) {
            return priv.status.canStart();
        } else {
            return priv.status.canRestart();
        }
    };

    /**
     * Returns a serialized version of this job.
     * @method serialized
     * @return {object} The serialized job.
     */
    that.serialized = function() {
        return {id:priv.id,
                date:priv.date.getTime(),
                tried:priv.tried,
                max_retry:priv.max_retry,
                status:priv.status.serialized(),
                command:priv.command.serialized(),
                storage:priv.storage.serialized()};
    };

    /**
     * Tells the job to wait for another one.
     * @method waitForJob
     * @param  {object} job The job to wait for.
     */
    that.waitForJob = function(job) {
        if (priv.status.getLabel() !== 'wait') {
            priv.status = waitStatus();
        }
        priv.status.waitForJob(job);
    };

    /**
     * Tells the job to do not wait for a job.
     * @method dontWaitForJob
     * @param  {object} job The other job.
     */
    that.dontWaitFor = function(job) {
        if (priv.status.getLabel() === 'wait') {
            priv.status.dontWaitForJob(job);
        }
    };

    /**
     * Tells the job to wait for a while.
     * @method waitForTime
     * @param  {number} ms Time to wait in millisecond.
     */
    that.waitForTime = function(ms) {
        if (priv.status.getLabel() !== 'wait') {
            priv.status = waitStatus();
        }
        priv.status.waitForTime(ms);
    };

    /**
     * Tells the job to do not wait for a while anymore.
     * @method stopWaitForTime
     */
    that.stopWaitForTime = function() {
        if (priv.status.getLabel() === 'wait') {
            priv.status.stopWaitForTime();
        }
    };

    /**
     * Updates the date of the job with the another one.
     * @method update
     * @param  {object} job The other job.
     */
    that.update = function(job) {
        priv.date = job.getDate();
    };

    that.execute = function() {
        if (priv.max_retry !== 0 && priv.tried >= priv.max_retry) {
            throw tooMuchTriesJobException(
                {job:that,message:'The job was invoked too much time.'});
        }
        if (!that.isReady()) {
            throw jobNotReadyException({message:'Can not execute this job.'});
        }
        priv.status = onGoingStatus();
        priv.tried ++;
        priv.command.onEndDo (function() {
            jobManager.terminateJob (that);
        });
        priv.command.execute (priv.storage);
    };

    return that;
};
