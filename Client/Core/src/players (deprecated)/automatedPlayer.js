define(['./player'], function (Player)
{
    'use strict';
    function AutomatedPlayer()
    {
        Player.apply(this, arguments);
    }

    AutomatedPlayer.prototype = Object.create(Player.prototype);
    AutomatedPlayer.prototype.constructor = AutomatedPlayer;

    AutomatedPlayer.prototype.performTurn = function (unit)
    {
        Player.prototype.performTurn.call(this, unit);

        this.endTurn();
    };

    AutomatedPlayer.prototype.endTurn = function ()
    {
        Player.prototype.endTurn.call(this);
    };

    AutomatedPlayer.prototype.onAttackComplete = function ()
    {
    };

    AutomatedPlayer.prototype.onMoveComplete = function ()
    {
    };

    return AutomatedPlayer;
});