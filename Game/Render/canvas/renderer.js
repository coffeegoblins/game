define(['core/scheduler', 'maps/map', 'Render/canvas/renderableMap'], function (Scheduler, Map, RenderableMap)
{
    'use strict';

    function Renderer()
    {
        this.canvas = null;
        this.context = null;
        this.viewportRect = {x: 0, y: 0, width: 0, height: 0};

        this.map = null;
        this.renderables = [];

        window.addEventListener('resize', handleResize.bind(this));
        Scheduler.schedule({context: this, method: update, priority: Scheduler.priority.render});
    }

    function handleResize()
    {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        this.viewportRect.width = this.canvas.clientWidth;
        this.viewportRect.height = this.canvas.clientHeight;
    }

    function update(e, deltaTime)
    {
        this.context.clearRect(0, 0, this.viewportRect.width, this.viewportRect.height);

        if (this.map)
        { // TODO: It may be nice to combine this in with the other renderables, but it will have to render first
            this.map.render(this.context, this.viewportRect);
        }

        for (var i = 0; i < this.renderables.length; i++)
        {
            this.renderables[i].render(this.context, this.viewportRect);
        }
    }

    Renderer.prototype.addRenderable = function (renderable)
    {
        if (renderable instanceof Map)
        {
            this.map = new RenderableMap(renderable);
        }
    };

    Renderer.prototype.setCanvas = function (canvas)
    {
        this.canvas = canvas;
        this.context = canvas.getContext('2d'); // TODO: If this doesn't work, tell the user their browser sucks and exit gracefully

        handleResize.call(this);
    };

    return new Renderer();
});