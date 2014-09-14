define(['text!./battleConfigurationMenu.html', 'core/src/events', 'core/src/levelLoader', 'renderer/src/renderer', 'menu/menuNavigator', 'core/src/imageCache'],
       function (Template, Events, LevelLoader, Renderer, MenuNavigator, ImageCache)
{
    'use strict';

    function BattleConfigurationMenu(socket)
    {
        this.levels = {
            level1: {minUnits: 4, maxUnits: 4},
            level2: {minUnits: 4, maxUnits: 4},
            level3: {minUnits: 4, maxUnits: 4},
            level4: {minUnits: 4, maxUnits: 4}
        };

        var battleConfig = window.localStorage.getItem('battleConfig');
        this.config = battleConfig ? JSON.parse(battleConfig) : {};
        this.socket = socket;
    }

    BattleConfigurationMenu.prototype.show = function (parentElement, levelName)
    {
        this.parentElement = parentElement;

        MenuNavigator.insertTemplate(this.parentElement, Template);

        this.levelPreviewImage = this.parentElement.querySelector('#level-preview');

        this.element = this.parentElement.querySelector('.battle-config');
        this.addButton = this.parentElement.querySelector('[data-button="add"]');
        this.removeButton = this.parentElement.querySelector('[data-button="remove"]');
        this.confirmButton = this.parentElement.querySelector('[data-button="confirm"]');

        this.addButton.addEventListener('click', this.onAddUnit.bind(this, 1), false);
        this.confirmButton.addEventListener('click', this.onConfirm.bind(this), false);
        this.removeButton.addEventListener('click', this.onAddUnit.bind(this, -1), false);

        this.turnSlider = this.parentElement.querySelector('#turn-slider');
        this.unitSlider = this.parentElement.querySelector('#unit-slider');
        this.levelSelect = this.parentElement.querySelector('#level-select');

        this.turnSlider.addEventListener('input', this.onTurnCountChanged.bind(this), false);
        this.turnSlider.addEventListener('change', this.onTurnCountChanged.bind(this), false);
        this.unitSlider.addEventListener('input', this.onUnitCountChanged.bind(this), false);
        this.unitSlider.addEventListener('change', this.onUnitCountChanged.bind(this), false);
        this.levelSelect.addEventListener('change', this.onLevelChanged.bind(this), false);

        this.parentElement.querySelector('.tab-header').on('click', '.tab-header-content', this.onTabClick.bind(this));
        this.parentElement.querySelector('[data-button="cancel"').addEventListener('click', this.onCancel.bind(this), false);

        this.onTurnCountChanged();
        this.populateLevelSelect(levelName);

        this.selectTab(this.parentElement.querySelector('.tab[data-unit="shield"]'));
        return this;
    };


    BattleConfigurationMenu.prototype.onAddUnit = function (amount, e)
    {
        if (e.target.classList.contains('disabled'))
            return;

        var levelConfig = this.config[this.levelName];
        var unitTypeCount = levelConfig.units[this.selectedUnit.type] + amount;
        levelConfig.units[this.selectedUnit.type] = unitTypeCount;
        levelConfig.unitCount += amount;

        if (levelConfig.unitCount >= this.level.maxUnits)
            this.addButton.classList.add('disabled');
        else
            this.addButton.classList.remove('disabled');

        if (unitTypeCount === 0)
            this.removeButton.classList.add('disabled');
        else
            this.removeButton.classList.remove('disabled');

        this.confirmButton.disabled = (levelConfig.unitCount < this.level.minUnits);
        this.selectedUnit.tab.querySelector('.unit-count').textContent = unitTypeCount || '';
    };

    BattleConfigurationMenu.prototype.onCancel = function ()
    {
        window.localStorage.setItem('battleConfig', JSON.stringify(this.config));
        this.trigger('cancel');
    };

    BattleConfigurationMenu.prototype.onConfirm = function ()
    {
        window.localStorage.setItem('battleConfig', JSON.stringify(this.config));
        this.trigger('confirm', {levelName: this.levelName, units: this.config[this.levelName].units});
    };

    BattleConfigurationMenu.prototype.onLevelChanged = function ()
    {
        ImageCache.unbindImage(this.levelName, this.levelPreviewImage);

        this.levelName = this.levelSelect.value;
        this.level = this.levels[this.levelName];

        if (!this.config[this.levelName])
        {
            this.config[this.levelName] = {
                units: {shield: 0, warrior: 0, archer: 0, rogue: 0},
                unitCount: 0
            };
        }

        this.unitSlider.min = this.level.minUnits;
        this.unitSlider.max = this.level.maxUnits;
        this.unitSlider.disabled = (this.level.minUnits === this.level.maxUnits);
        this.onUnitCountChanged();

        var levelConfig = this.config[this.levelName];
        for (var unitName in levelConfig.units)
        {
            var unitCountElement = this.element.querySelector('.tab[data-unit="' + unitName + '"] .unit-count');
            unitCountElement.textContent = levelConfig.units[unitName] || '';
        }

        this.confirmButton.disabled = (levelConfig.unitCount < this.level.minUnits);
        if (levelConfig.unitCount >= this.level.maxUnits)
            this.addButton.classList.add('disabled');
        else
            this.addButton.classList.remove('disabled');

        if (this.selectedUnit)
        {
            if (levelConfig[this.selectedUnit.type] === 0)
                this.removeButton.classList.add('disabled');
            else
                this.removeButton.classList.remove('disabled');
        }

        ImageCache.bindImage(this.levelName, this.levelPreviewImage);
    };

    BattleConfigurationMenu.prototype.onTabClick = function (e)
    {
        var tabElement = MenuNavigator.findParentElement(e.target, '.tab');
        if (!tabElement.classList.contains('selected'))
            this.selectTab(tabElement);
    };

    BattleConfigurationMenu.prototype.onTurnCountChanged = function ()
    {
        var turnCount = this.turnSlider.value;
        if (turnCount === this.turnSlider.max)
            turnCount = '\u221e';

        this.turnSlider.nextSibling.textContent = turnCount;
    };

    BattleConfigurationMenu.prototype.onUnitCountChanged = function ()
    {
        this.unitSlider.nextSibling.textContent = this.unitSlider.value;
    };

    BattleConfigurationMenu.prototype.populateLevelSelect = function (levelName)
    {
        var levels = Object.keys(this.levels);
        levels.sort();

        for (var i = 0; i < levels.length; i++)
        {
            var option = document.createElement('option');
            option.text = levels[i];
            this.levelSelect.add(option);
        }

        if (levelName)
        {
            this.levelSelect.value = levelName;
            this.levelSelect.disabled = true;
        }

        this.onLevelChanged();
    };

    BattleConfigurationMenu.prototype.selectTab = function (tabElement)
    {
        if (this.selectedUnit)
        {
            this.selectedUnit.tab.classList.remove('selected');
            this.selectedUnit.content.classList.remove('selected');
        }

        var unitType = tabElement.getAttribute('data-unit');
        var contentElement = this.element.querySelector('.tab-content[data-unit="' + unitType + '"]');

        tabElement.classList.add('selected');
        contentElement.classList.add('selected');
        this.selectedUnit = {tab: tabElement, content: contentElement, type: unitType};

        if (this.config[this.levelName].units[unitType] === 0)
            this.removeButton.classList.add('disabled');
        else
            this.removeButton.classList.remove('disabled');
    };

    Events.register(BattleConfigurationMenu.prototype);
    return BattleConfigurationMenu;
});
