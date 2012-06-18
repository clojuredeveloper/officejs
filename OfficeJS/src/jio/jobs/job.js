var job = function(spec, my) {
    var that = {};
    spec = spec || {};
    my = my || {};
    // Attributes //
    var priv = {};
    priv.id        = my.jobIdHandler.nextId();
    priv.command   = spec.command;
    priv.storage   = spec.storage;
    priv.status    = initialStatus();
    priv.date      = new Date();
    log ('new job spec: ' + JSON.stringify (spec) + ', priv: ' +
         JSON.stringify (priv));

    // Initialize //
    if (!priv.storage){
        throw invalidJobException({job:that,message:'No storage set'});
    }
    if (!priv.command){
        throw invalidJobException({job:that,message:'No command set'});
    }
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

    that.getDate = function() {
        return priv.date;
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
        log ('job waitForJob(job): ' + JSON.stringify (job.serialized()));
        if (priv.status.getLabel() !== 'wait') {
            priv.status = waitStatus({},my);
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
        log ('job waitForTime(ms): ' + ms);
        if (priv.status.getLabel() !== 'wait') {
            priv.status = waitStatus({},my);
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

    that.eliminated = function () {
        priv.command.setMaxRetry(-1);
        log ('job eliminated(): '+JSON.stringify (that.serialized()));
        priv.command.fail({status:0,statusText:'Stoped',
                           message:'This job has been stoped by another one.'});
    };

    that.notAccepted = function () {
        log ('job notAccepted(): '+JSON.stringify (that.serialized()));
        priv.command.setMaxRetry(-1);
        priv.command.onEndDo (function () {
            priv.status = failStatus();
            my.jobManager.terminateJob (that);
        });
        priv.command.fail ({status:0,statusText:'Not Accepted',
                            message:'This job is already running.'});
    };

    /**
     * Updates the date of the job with the another one.
     * @method update
     * @param  {object} job The other job.
     */
    that.update = function(job) {
        log ('job update(job): ' + JSON.stringify (job.serialized()));
        priv.command.setMaxRetry(-1);
        priv.command.onEndDo(function (status) {
            console.log ('job update on end' + status.getLabel());
        });
        priv.command.fail({status:0,statusText:'Replaced',
                           message:'Job has been replaced by another one.'});
        priv.date = job.getDate();
        priv.command = job.getCommand();
        priv.status = job.getStatus();
    };

    that.execute = function() {
        log ('job execute(): ' + JSON.stringify (that.serialized()));
        if (priv.max_retry !== 0 && priv.tried >= priv.max_retry) {
            throw tooMuchTriesJobException(
                {job:that,message:'The job was invoked too much time.'});
        }
        if (!that.isReady()) {
            throw jobNotReadyException({message:'Can not execute this job.'});
        }
        priv.status = onGoingStatus();
        priv.command.onRetryDo (function() {
            log ('command.retry job:' + JSON.stringify (that.serialized()));
            var ms = priv.command.getTried();
            ms = ms*ms*200;
            if (ms>10000){
                ms = 10000;
            }
            that.waitForTime(ms);
        });
        priv.command.onEndDo (function(status) {
            priv.status = status;
            log ('command.end job:' + JSON.stringify (that.serialized()));
            my.jobManager.terminateJob (that);
        });
        priv.command.execute (priv.storage);
    };

    return that;
};
