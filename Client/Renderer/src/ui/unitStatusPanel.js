define(['./floatingPanel', 'renderer/src/ui/renderableProgressBar', 'text!../../content/templates/unitStatusPanel.html'], function (FloatingPanel, RenderableProgressBar, Template)
{
    'use strict';
    function UnitStatusPanel(localUsername)
    {
        this.localUsername = localUsername;
        FloatingPanel.call(this);

        this.element.innerHTML = Template;
        this.element.classList.add('unit-status-panel');
        this.turnIndicator = this.element.querySelector('.turn-indicator');
        this.hpBar = new RenderableProgressBar(this.element.querySelector('.hp-bar'));
        this.apBar = new RenderableProgressBar(this.element.querySelector('.ap-bar'));
    }

    UnitStatusPanel.prototype = Object.create(FloatingPanel.prototype);
    UnitStatusPanel.prototype.constructor = UnitStatusPanel;

    UnitStatusPanel.prototype.hide = function ()
    {
        this.apBar.previewProgress();
        FloatingPanel.prototype.hide.call(this);
    };

    UnitStatusPanel.prototype.open = function ()
    {
        FloatingPanel.prototype.open.apply(this, arguments);
        this.updateValues();

        if (this.target.username === this.localUsername)
            this.element.classList.add('local');
        else
            this.element.classList.remove('local');
    };

    UnitStatusPanel.prototype.previewAP = function (ap)
    {
        this.apBar.previewProgress(ap);
    };

    UnitStatusPanel.prototype.setOptions = function (options)
    {
        this.hpBar.element.style.visibility = options.showHP ? '' : 'hidden';
        this.apBar.element.style.visibility = options.showAP ? '' : 'hidden';
        this.turnIndicator.style.display = options.showTurnIndicator ? '' : 'none';
        this.updateMeasurement();
    };

    UnitStatusPanel.prototype.updateValues = function ()
    {
        if (this.target)
        {
            this.turnIndicator.firstElementChild.textContent = this.target.turnNumber;
            this.hpBar.setProgress(this.target.hp, this.target.maxHP);
            this.apBar.setProgress(this.target.ap, this.target.maxAP);
        }
    };

    return UnitStatusPanel;
});
