define(function ()
{
    'use strict';

    function DefaultObject() { }

    DefaultObject.prototype.initialize = function (x, y)
    {
        this.position = {x: Math.floor(x / 64), y: Math.floor(y / 64)};
        this.rect = new Rectangle(this.position.x * 64, this.position.y * 64, 64, 64);
    };

    DefaultObject.prototype.draw = function (viewport)
    {
        viewport.renderer.drawRectangle(viewport, this.rect);
        viewport.context.strokeStyle = '#cdcdcd';
        viewport.context.stroke();
    };

    DefaultObject.prototype.getPropertyConfig = function ()
    {
        return {exclude: {'rect': true, 'typeName': true}};
    };

    DefaultObject.prototype.onPropertyChanged = function (property, propertyValue)
    {
        if (property.key === 'position')
        {
            this.rect.setPosition(this.position.x * 64, this.position.y * 64);
        }
    };

    DefaultObject.prototype.setPosition = function (x, y)
    {
        this.position.x = Math.floor(x / 64);
        this.position.y = Math.floor(y / 64);
        this.rect.setPosition(this.position.x * 64, this.position.y * 64);
    };


    DefaultObject.prototype.deserialize = function (data)
    {
        this.initialize(data.x * 64, data.y * 64);

        delete data.x;
        delete data.y;

        Utility.merge(this, data);
    };

    DefaultObject.prototype.serialize = function ()
    {
        var obj = Utility.merge({}, this);
        obj.x = obj.position.x;
        obj.y = obj.position.y;

        delete obj.position;
        delete obj.rect;
        return obj;
    };


    function Soldier()
    {
        DefaultObject.apply(this, arguments);
    }

    Soldier.prototype = Object.create(DefaultObject.prototype);
    Soldier.prototype.constructor = Soldier;

    return {
        object: DefaultObject,
        soldier: Soldier
    };
});