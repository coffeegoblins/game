define(function ()
{
    'use strict';

    /**
     * @constructor
     */
    function Soldier()
    {
        this.name = null;
        this.tileX = 0;
        this.tileY = 0;
        this.hp = 100;
        this.maxHP = 100;
        this.ap = 42;
        this.maxAP = 42;
        this.maxMoveableHeight = 2;
        this.canClimbObjects = true;
    }

    return Soldier;
});