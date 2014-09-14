define(['./player'], function (Player)
{
    'use strict';
    function RemotePlayer()
    {
        Player.apply(this, arguments);
    }

    RemotePlayer.prototype = Object.create(Player.prototype);
    RemotePlayer.prototype.constructor = RemotePlayer;

    RemotePlayer.prototype.performTurn = function (unit)
    {

    };

    RemotePlayer.prototype.endTurn = function ()
    {

    };

    RemotePlayer.prototype.onAttackComplete = function ()
    {
    };

    RemotePlayer.prototype.onMoveComplete = function ()
    {
    };

    return RemotePlayer;
});
