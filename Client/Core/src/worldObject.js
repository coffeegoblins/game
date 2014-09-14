define(['./utility'], function (Utility)
{
    'use strict';

    function WorldObject(properties)
    {
        Utility.merge(this, properties);

        if (this.size === 'large')
        {
            this.sizeX = 2;

            this.sizeY = 2;
        }
        else
        {
            this.sizeX = 1;
            this.sizeY = 1;
        }
    }

    return WorldObject;
});
