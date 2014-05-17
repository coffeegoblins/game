define(function ()
{
    'use strict';

    var images = {};
    var globalIndex = 0;

    function onImageLoaded()
    {
        this.width = this.data.width;
        this.height = this.data.height;
        this.isLoaded = true;

        if (this.data.callback)
            this.data.callback(this);
    }

    function ImageCache() { }

    ImageCache.clear = function ()
    {
        images = {};
    };

    ImageCache.getImage = function (id)
    {
        return images[id];
    };

    ImageCache.isLoading = function ()
    {
        for (var i in images)
        {
            if (images.hasOwnProperty(i) && !images[i].isLoaded)
                return true;
        }

        return false;
    };

    ImageCache.loadImage = function (id, path, callback)
    {
        var image = images[id];
        if (!image)
        {
            image = {
                callback: callback,
                data: new Image(),
                isLoaded: false,
                path: path
            };

            image.globalIndex = globalIndex++;
            image.data.onload = onImageLoaded.bind(image);
            image.data.src = path;
            images[id] = image;
        }

        return image;
    };

    ImageCache.unloadImage = function (id)
    {
        delete images[id];
    };

    return ImageCache;
});
