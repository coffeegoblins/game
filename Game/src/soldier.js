define(['./utility'], function (Utility)
{
    'use strict';

    var defaults = {
        hp: 100,
        maxHP: 100,
        ap: 42,
        maxAP: 42,
        maxMoveableHeight: 2,
        canClimbObjects: true,
        attackRange: 3,
        attackPower: 25,
        attackCost: 25
    };

    function Soldier(properties)
    {
        Utility.merge(this, defaults, properties);
    }

    return Soldier;
});