define(function ()
{
    'use strict';

    /**
     * @constructor
     */
    function TurnManager()
    {
        this.unitList = [];
        this.activeUnit = null;
        this.registeredBeginTurnEvents = [];
        this.registeredEndTurnEvents = [];

        this.endTurnPercentageCost = 0.75;
    }

    TurnManager.prototype.registerBeginTurnEvent = function (id, method, context)
    {
        this.registeredBeginTurnEvents.push({context: context, method: method});
    };

    TurnManager.prototype.registerEndTurnEvent = function (id, method, context)
    {
        this.registeredEndTurnEvents.push({context: context, method: method});
    };

    TurnManager.prototype.beginTurn = function()
    {
        this.activeUnit = this.unitList[0];

        for (var i = 0; i < this.registeredBeginTurnEvents.length; ++i)
        {
            var registeredEvent = this.registeredBeginTurnEvents[i];
            if (registeredEvent)
            {
                registeredEvent.method.call(registeredEvent.context, this.activeUnit);
            }
        }
    };

    TurnManager.prototype.incrementAP = function()
    {
        var nextUnit = this.unitList[0];
        var apIncrement = nextUnit.maxAP - nextUnit.ap;

        // Ensure the next in queue is ready to go
        nextUnit.ap = nextUnit.maxAP;

        // Increment the same amount for all other units
        for (var i = 1; i < this.unitList.length; ++i)
        {
            var unit = this.unitList[i];
            var missingAP = unit.maxAP - unit.ap;

            // Min() with missing AP to ensure we never go over max AP
            unit.ap += Math.min(apIncrement, missingAP);
        }
    };

    TurnManager.prototype.endTurn = function ()
    {
        // Remove the soldier from the front
        var currentUnit = this.unitList.shift();

        // Pay the end turn penalty
        currentUnit.ap *= this.endTurnPercentageCost;

        this.incrementAP();

        // Place in queue at appropriate spot
        for (var placementIndex = this.unitList.length - 1; placementIndex >= 0; --placementIndex)
        {
            var comparisonUnit = this.unitList[placementIndex];

            var currentUnitTurnsToMove = currentUnit.maxAP - currentUnit.ap;
            var comparisonUnitTurnsToMove = comparisonUnit.maxAP - comparisonUnit.ap;

            if (currentUnitTurnsToMove >= comparisonUnitTurnsToMove)
            {
                this.unitList.splice(placementIndex + 1, 0, currentUnit);
                break;
            }
        }

        this.activeUnit = null;

        for (var i = 0; i < this.registeredEndTurnEvents.length; ++i)
        {
            var registeredEvent = this.registeredEndTurnEvents[i];
            if (registeredEvent)
            {
                registeredEvent.method.call(registeredEvent.context, currentUnit, placementIndex + 1);
            }
        }
    };

    return new TurnManager();
});