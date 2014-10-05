define(['./events', './utility'], function (Events, Utility)
{
    'use strict';

    var defaults = {
        hp: 100,
        ap: 100,
        maxHP: 100,
        maxAP: 100,
        maxMoveableHeight: 2,
        canClimbObjects: true,
        state: 'idle'
    };

    function Soldier(properties)
    {
        Utility.merge(this, defaults, properties);

        this.direction = {
            x: 1,
            y: 1
        };
        //this.setDirection(1, 0);
    }

    Soldier.prototype.damage = function (amount)
    {
        this.hp -= amount;
        if (this.hp <= 0)
        {
            this.setState('death');
            this.isTargeted = false;
            this.trigger('death', this);
        }
    };
    //
    //    // TODO Replace with server logic
    //    Soldier.prototype.setDirection = function (x, y)
    //    {
    //        if (Math.abs(x) > 1 || Math.abs(y) > 1)
    //        {
    //            // Normalize the direction
    //            var length = Math.sqrt(x * x + y * y);
    //            x = Math.round(x / length);
    //            y = Math.round(y / length);
    //        }
    //
    //        this.worldDirection.x = x;
    //        this.worldDirection.y = y;
    //
    //        var previousDirection = this.direction;
    //        this.direction = directions[y + 1][x + 1];
    //
    //        if (this.direction !== previousDirection)
    //            this.trigger('directionChange');
    //    };

    Soldier.prototype.setState = function (state)
    {
        if (this.state !== state)
        {
            this.state = state;
            this.trigger('stateChange');
        }
    };

    Events.register(Soldier.prototype);
    return Soldier;
});
