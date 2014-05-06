define(['text!../../content/soldierData.json', '../events', '../options', '../pathManager', 'renderer/src/renderer', '../scheduler', '../soundManager', 'renderer/src/ui/unitStatusPanel', '../utility'],
    function (SoldierData, Events, Options, PathManager, Renderer, Scheduler, SoundManager, UnitStatusPanel, Utility)
    {
        'use strict';
        var soldierData = JSON.parse(SoldierData);

        function getOption(key, isSelection)
        {
            return Options[key] === 'always' || (isSelection && Options[key] === 'selected');
        }


        function Player(map, units)
        {
            this.map = map;
            this.units = units || [];

            for (var i = 0; i < this.units.length; i++)
            {
                var unit = this.units[i];
                unit.player = this;
                unit.on('death', this.onSoldierDeath.bind(this));
                this.openUnitStatusPanel(unit);
            }
        }

        Player.prototype.endTurn = function ()
        {
            this.closeUnitStatusPanel(this.unit);
            this.trigger('endTurn', this);
            this.unit = null;
        };

        Player.prototype.calculateCrossNodes = function (selectedNode, availableNodes)
        {
            var crossNodes = [];
            var x = selectedNode.x;
            var y = selectedNode.y;

            for (var i = 0; i < availableNodes.length; ++i)
            {
                var node = availableNodes[i];
                if (node.tile.unit !== this.unit &&
                    (node.x === x && Math.abs(node.y - y) === 1) ||
                    (node.y === y && Math.abs(node.x - x) === 1))
                {
                    crossNodes.push(node);
                }
            }

            return crossNodes;
        };

        Player.prototype.closeUnitStatusPanel = function (unit, force)
        {
            if (unit && unit.statusPanel)
            {
                if (!force)
                {
                    var options = this.getUnitStatusPanelOptions(unit);
                    if (options)
                    {
                        unit.statusPanel.setOptions(options);
                        return;
                    }
                }

                unit.statusPanel.close();
                unit.statusPanel = null;
            }
        };

        Player.prototype.getAttack = function (unit, name)
        {
            var attackDefinition = soldierData[unit.type].attacks[name];
            var attack = Utility.merge({name: name}, attackDefinition);
            attack.isDisabled = (attack.cost > unit.ap);

            if (!attack.range)
                attack.range = 1;

            return attackDefinition;
        };

        Player.prototype.getAttacks = function (unit)
        {
            var attacks = [];
            var attackDefinitions = soldierData[unit.type].attacks;

            for (var attackName in attackDefinitions)
                attacks.push(this.getAttack(unit, attackName));

            return attacks;
        };

        Player.prototype.getAttackTiles = function (unit, attack)
        {
            return PathManager.calculateAvailableTiles(this.map, Utility.merge({
                x: unit.tileX,
                y: unit.tileY,
                excludePlayer: this,
                ignoreUnits: true,
                maxClimbableHeight: unit.maxMoveableHeight,
                maxDistance: attack.range
            }, attack));
        };

        Player.prototype.getMoveTiles = function (unit)
        {
            var maxDistance = unit.ap / soldierData[unit.type].moveCost;

            return PathManager.calculateAvailableTiles(this.map, {
                x: unit.tileX,
                y: unit.tileY,
                maxDistance: maxDistance,
                maxClimbableHeight: unit.maxMoveableHeight
            });
        };

        Player.prototype.getUnitStatusPanelOptions = function (unit, isSelection)
        {
            var options = {};
            options.showTurnIndicator = getOption('showTurnIndicator', isSelection);

            if (unit.player.isLocal)
            {
                options.showHP = getOption('showTeamHP', isSelection);
                options.showAP = getOption('showTeamAP', isSelection);
            }
            else
            {
                options.showHP = getOption('showEnemyHP', isSelection);
                options.showAP = getOption('showEnemyAP', isSelection);
            }

            if (options.showHP || options.showAP || options.showTurnIndicator)
                return options;
        };

        Player.prototype.moveUnit = function (tiles, cost)
        {
            this.unit.setState('run');
            Renderer.camera.trackUnit(this.unit);

            if (this.unit.statusPanel)
                this.unit.statusPanel.apBar.disableTransitions();

            var startTile = this.map.getTile(this.unit.tileX, this.unit.tileY);
            startTile.unit = null;

            var startAp = this.unit.ap;
            var endAp = startAp - cost;
            var totalTime = cost / 35;

            var path = tiles.slice();
            path.unshift({x: this.unit.tileX, y: this.unit.tileY});

            var progressTime = 0;
            var progressPercentage = 0;

            for (var i = 1; i < path.length; i++)
            {
                var node = path[i];
                node.startPercentage = progressPercentage;
                node.endPercentage = node.distance / cost;
                node.percentageShare = node.endPercentage - node.startPercentage;
                progressPercentage = node.endPercentage;
            }

            var currentNode = path.shift();
            var nextNode = path.shift();

            Scheduler.schedule({
                context: this,
                endTime: totalTime,
                method: function (e, deltaTime)
                {
                    progressTime += deltaTime;
                    var progressPercentage = progressTime / totalTime;
                    while (progressPercentage > nextNode.endPercentage)
                    {
                        currentNode = nextNode;
                        nextNode = path.shift();
                    }

                    var deltaX = nextNode.x - currentNode.x;
                    var deltaY = nextNode.y - currentNode.y;
                    this.unit.setDirection(deltaX, deltaY);

                    var nodeProgressPercentage = (progressPercentage - nextNode.startPercentage) / nextNode.percentageShare;
                    this.unit.tileX = currentNode.x + (deltaX * nodeProgressPercentage);
                    this.unit.tileY = currentNode.y + (deltaY * nodeProgressPercentage);

                    this.unit.ap = startAp + (endAp - startAp) * progressPercentage;
                    if (this.unit.statusPanel)
                    {
                        this.unit.statusPanel.updateValues();
                    }
                },
                completedMethod: function ()
                {
                    this.unit.tileX = nextNode.x;
                    this.unit.tileY = nextNode.y;
                    nextNode.tile.unit = this.unit;

                    this.unit.ap = endAp;
                    this.unit.setState('idle');
                    if (this.unit.statusPanel)
                    {
                        this.unit.statusPanel.apBar.enableTransitions();
                        this.unit.statusPanel.updateValues();
                    }

                    Renderer.camera.trackUnit();
                    this.onMoveComplete();
                }
            });
        };

        Player.prototype.onSoldierDeath = function (unit)
        {
            this.closeUnitStatusPanel(unit, true);
            Utility.removeElement(this.units, unit);
            if (!this.units.length)
                this.trigger('defeat', this);
        };

        Player.prototype.openUnitStatusPanel = function (unit, isSelection)
        {
            var options = this.getUnitStatusPanelOptions(unit, isSelection);
            if (!options)
                return;

            if (!unit.statusPanel)
            {
                unit.statusPanel = new UnitStatusPanel();
                unit.statusPanel.open(unit);
            }

            unit.statusPanel.setOptions(options);
        };

        Player.prototype.performAttack = function (targetTile, affectedTiles, attack)
        {
            var deltaX = targetTile.x - this.unit.tileX;
            var deltaY = targetTile.y - this.unit.tileY;

            // TODO: Create a method for this that isn't tied to the UI
            //       Filter out affected tile targets
            //       Apply cost, direction, and target lock
            //       Compute resulting hit outcome and damage

            this.unit.ap -= attack.cost;
            this.unit.setDirection(deltaX, deltaY);

            this.unit.setState('attack');
            SoundManager.playTrack(attack.track);

            if (this.unit.statusPanel)
                this.unit.statusPanel.updateValues();

            this.unit.on('animationComplete', this, function onAttackFinished()
            {
                // TODO: Split this out? Simplify to apply precomputed damage
                for (var i = 0; i < affectedTiles.length; ++i)
                {
                    var unit = affectedTiles[i].tile.unit;
                    if (unit)
                    {
                        unit.damage(attack.damage);
                        if (unit.statusPanel)
                            unit.statusPanel.updateValues();
                    }
                }

                this.unit.setState('idle');
                this.unit.off('animationComplete', this, onAttackFinished);
                this.onAttackComplete();
            });
        };

        Player.prototype.performTurn = function (unit)
        {
            this.unit = unit;
            this.openUnitStatusPanel(unit, true);
        };

        Events.register(Player.prototype);
        return Player;
    });