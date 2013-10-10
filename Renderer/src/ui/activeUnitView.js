define(['renderer', 'text!Renderer/content/activeUnitView.html', 'Renderer/src/ui/renderableProgressBar', 'Game/src/scheduler', 'Renderer/src/effects/transitionEffect', 'text!Renderer/content/activeUnitView.html'],
    function (Renderer, Template, RenderableProgressBar, Scheduler, TransitionEffect)
    {
        'use strict';
        function ActiveUnitView()
        {
            this.element = document.createElement('div');
            this.element.id = "activeUnitView";
            this.element.innerHTML = Template;
            this.element.style.opacity = 0;

            this.previewImage = this.element.querySelector('img');
            this.hpBar = new RenderableProgressBar(this.element.querySelector('#activeUnitHP'));
            this.apBar = new RenderableProgressBar(this.element.querySelector('#activeUnitAP'));

            document.body.appendChild(this.element);
        }

        ActiveUnitView.prototype.onBeginTurn = function (activeUnit)
        {
            // TODO Find a better way to get the active unit preview image
            for (var i = 0; i < Renderer.renderables.length; ++i)
            {
                if (activeUnit === Renderer.renderables[i].unit)
                {
                    this.previewImage.src = Renderer.renderables[i].previewImage;
                    break;
                }
            }

            this.hpBar.transitionProgress('hpBar', activeUnit.hp, activeUnit.maxHP, 1);
            this.apBar.transitionProgress('apBar', activeUnit.ap, activeUnit.maxAP, 1);

            TransitionEffect.transitionFloat('activeUnitViewOpacity', this.element.style, 'opacity', null, 1, 0.5, this, function ()
            {
                this.element.style.opacity = 1;
            });
        };

        ActiveUnitView.prototype.onEndTurn = function ()
        {
            this.apBar.stopBlink();

            TransitionEffect.transitionFloat('activeUnitViewOpacity', this.element.style, 'opacity', null, 0, 0.5, this, function ()
            {
                this.element.style.opacity = 0;
            });
        };

        ActiveUnitView.prototype.previewAP = function (ap)
        {
            if (ap === 0)
            {
                this.apBar.stopBlink();
                return;
            }

            this.apBar.blinkPortion(ap);
        };

        ActiveUnitView.prototype.setAP = function (ap, maxAP)
        {
            this.apBar.setProgress('apBar', ap, maxAP);
        };

        return ActiveUnitView;
    });
