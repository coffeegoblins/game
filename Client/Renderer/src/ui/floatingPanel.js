define(['core/src/events', 'renderer/src/renderer', 'core/src/scheduler'], function (Events, Renderer, Scheduler)
{
    'use strict';

    function FloatingPanel()
    {
        this.element = document.createElement('div');
        this.element.className = 'floating-panel';
        this.element.style.opacity = 0;

        this.updateEventData = {
            context: this,
            method: this.updatePosition
        };
        this.element.addEventListener('webkitTransitionEnd', this.onTransitionEnd.bind(this));
        this.element.addEventListener('transitionend', this.onTransitionEnd.bind(this));
    }

    FloatingPanel.prototype.close = function ()
    {
        this.isClosing = true;
        this.hide();
    };

    FloatingPanel.prototype.hide = function ()
    {
        this.element.style.opacity = 0;
        this.element.classList.remove('isVisible');
        this.onTransitionEnd();
    };

    FloatingPanel.prototype.onTransitionEnd = function ()
    {
        if (this.isClosing)
        {
            this.isClosing = false;
            Scheduler.unschedule(this.updateEventData);
            document.body.removeChild(this.element);
        }
        else if (this.element.style.opacity == 0)
        {
            this.isVisible = false;
        }
    };

    FloatingPanel.prototype.open = function (target)
    {
        document.body.appendChild(this.element);

        this.target = target;
        this.isClosing = false;

        this.updateMeasurement();
        this.updatePosition();
        this.show();

        Scheduler.schedule(this.updateEventData);
    };

    FloatingPanel.prototype.show = function ()
    {
        this.isVisible = true;
        this.element.style.opacity = 1;
        this.element.classList.add('isVisible');
    };

    FloatingPanel.prototype.updateMeasurement = function ()
    {
        this.halfWidth = this.element.offsetWidth / 2;
        this.halfHeight = this.element.offsetHeight / 2;
    };

    FloatingPanel.prototype.updatePosition = function ()
    {
        if (!this.target)
            return;

        var camera = Renderer.camera;
        var targetCenter = camera.tileToScreen(this.target.tileX, this.target.tileY);
        targetCenter.x -= camera.viewportRect.x - camera.halfTileWidth;
        targetCenter.y -= camera.viewportRect.y - camera.halfTileHeight;

        this.element.style.left = (targetCenter.x - this.halfWidth) + 'px';
        this.element.style.top = (targetCenter.y - this.halfHeight) + 'px';
    };

    Events.register(FloatingPanel.prototype);
    return FloatingPanel;
});
