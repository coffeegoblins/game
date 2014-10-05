define(['renderer/src/effects/transitionEffect'], function (TransitionEffect)
{
    'use strict';

    function Camera()
    {
        this.viewportRect = {x: 0, y: 0, width: 0, height: 0};

        this.scale = 1;
        this.tileWidth = 96;
        this.tileHeight = this.tileWidth / 2;
        this.halfTileWidth = this.tileWidth / 2;
        this.halfTileHeight = this.tileHeight / 2;
    }

    Camera.prototype.handleResize = function (width, height)
    {
        var currentCenterX = this.viewportRect.x + this.viewportRect.width / 2;
        var currentCenterY = this.viewportRect.y + this.viewportRect.height / 2;

        this.viewportRect.width = width;
        this.viewportRect.height = height;

        this.viewportRect.x = Math.floor(currentCenterX - width / 2);
        this.viewportRect.y = Math.floor(currentCenterY - height / 2);

        if (this.targetUnit)
            this.moveToUnit(this.targetUnit, this.callback);
    };

    Camera.prototype.isInView = function (x, y, width, height)
    {
        return x < this.viewportRect.width && x + width > 0 && y < this.viewportRect.height && y + height > 0;
    };

    Camera.prototype.moveViewport = function (deltaX, deltaY)
    {
        this.viewportRect.x = Math.floor(this.viewportRect.x + deltaX);
        this.viewportRect.y = Math.floor(this.viewportRect.y + deltaY);
    };

    Camera.prototype.moveToUnit = function (unit, callback, duration)
    {
        var position = this.tileToScreen(unit.x, unit.y);
        var xPosition = Math.floor(position.x - this.viewportRect.width / 2);
        var yPosition = Math.floor(position.y - this.viewportRect.height / 2);

        this.targetUnit = unit;
        this.callback = callback;

        // Don't move if we're already close enough
        if (Math.abs(this.viewportRect.x - xPosition) < 10 && Math.abs(this.viewportRect.y - yPosition) < 10)
        {
            this.onMovedToUnit();
            return;
        }

        var transition = {
            id: 'moveToUnitX',
            source: this.viewportRect,
            property: 'x',
            duration: duration || 1,
            targetValue: xPosition,
            truncateValue: true
        };

        TransitionEffect.transitionFloat(transition);

        transition.id = 'moveToUnitY';
        transition.property = 'y';
        transition.targetValue = yPosition;
        transition.context = this;
        transition.completedMethod = this.onMovedToUnit;

        TransitionEffect.transitionFloat(transition);
    };

    Camera.prototype.onMovedToUnit = function ()
    {
        var unit = this.targetUnit;
        this.targetUnit = null;

        var callback = this.callback;
        if (callback)
        {
            this.callback = null;
            callback(unit);
        }
    };

    Camera.prototype.screenToTile = function (x, y)
    {
        return {
            x: Math.floor((x / this.halfTileWidth + y / this.halfTileHeight) / 2),
            y: Math.floor((y / this.halfTileHeight - x / this.halfTileWidth) / 2)
        };
    };

    Camera.prototype.tileToScreen = function (x, y)
    {
        return {
            x: (x - y) * this.halfTileWidth - this.halfTileWidth,
            y: (x + y) * this.halfTileHeight
        };
    };

    Camera.prototype.trackUnit = function (unit)
    {
        this.trackedUnit = unit;
    };

    Camera.prototype.update = function ()
    {
        if (this.trackedUnit)
            this.moveToUnit(this.trackedUnit, null, 0.5);

        this.viewportRect.right = this.viewportRect.x + this.viewportRect.width;
        this.viewportRect.bottom = this.viewportRect.y + this.viewportRect.height;
    };

    return Camera;
});
