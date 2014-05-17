define(['./lib/socket.io'], function (io)
{
    'use strict';

    function ConnectionUtility()
    {

    }

    ConnectionUtility.prototype.connect = function (callback)
    {
        this.socket = io.connect('http://127.0.0.1:1988');

        this.socket.on('connect', function ()
        {
            callback(null, this.socket);
        }.bind(this));

        this.socket.on('error', function (error)
        {
            callback('Unable to connect to the server.');
        });

        this.socket.on('connect_error', function ()
        {
            callback('Unable to connect to the server.');
        });

        this.socket.on('connect_failed', function ()
        {
            callback('Unable to connect to the server.');
        });
    };

    ConnectionUtility.prototype.disconnect = function ()
    {
        if (this.socket)
        {
            this.socket.disconnect();
        }
    };

    return new ConnectionUtility();
});
