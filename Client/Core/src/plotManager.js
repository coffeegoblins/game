define([
        'renderer/src/renderer',
        './scheduler',
        './inputHandler',
        './browserNavigation',
        './levelLoader',
        './turnManager',
        './soldier',
        './players/automatedPlayer',
        './players/localPlayer',
        './players/remotePlayer'
    ],
    function (Renderer, Scheduler, InputHandler, BrowserNavigation, LevelLoader, TurnManager, Soldier, AutomatedPlayer, LocalPlayer, RemotePlayer)
    {
        'use strict';

        function createSoldiers(positions, unitTypes)
        {
            var soldiers = [];
            var positionIndex = 0;
            for (var unitType in unitTypes)
            {
                for (var i = 0; i < unitTypes[unitType]; i++)
                {
                    var position = positions[positionIndex++];
                    var soldier = new Soldier({
                        tileX: position.x,
                        tileY: position.y,
                        type: unitType
                    });

                    soldiers.push(soldier);
                }
            }

            return soldiers;
        }

        return {
            loadLevel: function (unitLogic, levelName, units)
            {
                Scheduler.clear();
                Renderer.initialize();
                BrowserNavigation.on('leaving:singlePlayer', this, this.uninitialize);
                this.turnManager = new TurnManager();

                LevelLoader.loadLevel(levelName, function (data)
                {
                    this.currentMap = data.map;
                    Renderer.addRenderableMap(this.currentMap);

                    for (var i = 0; i < data.objects.length; i++)
                    {
                        var obj = data.objects[i];
                        data.map.addObject(obj, obj.x, obj.y);
                        Renderer.addRenderableObject(obj);
                    }

                    this.players = [
                        new LocalPlayer(unitLogic, this.currentMap, createSoldiers(data.player1Positions, units)),
                        new AutomatedPlayer(unitLogic, this.currentMap, createSoldiers(data.player2Positions, {
                            archer: 1, rogue: 1, shield: 1, warrior: 1
                        }))
                    ];

                    for (i = 0; i < this.players.length; i++)
                    {
                        var player = this.players[i];
                        player.on('defeat', this, this.onPlayerDefeat);
                        player.on('endTurn', this, this.endTurn);

                        for (var j = 0; j < player.units.length; j++)
                        {
                            var unit = player.units[j];
                            this.turnManager.addUnit(unit);
                            Renderer.addRenderableSoldier(unit);
                            this.currentMap.addUnit(unit, unit.tileX, unit.tileY);
                        }
                    }

                    InputHandler.disableInput();
                    this.beginTurn();
                }.bind(this));
            },

            beginTurn: function ()
            {
                this.turnManager.beginTurn();

                var unit = this.turnManager.activeUnit;
                unit.isSelected = true;
                Renderer.camera.moveToUnit(unit, this.onCameraMoved.bind(this));

                // Update all the turn numbers
                for (var i = 0; i < this.players.length; i++)
                {
                    var player = this.players[i];
                    for (var j = 0; j < player.units.length; j++)
                    {
                        unit = player.units[j];
                        if (unit.statusPanel)
                            unit.statusPanel.updateValues();
                    }
                }
            },

            endTurn: function ()
            {
                this.turnManager.activeUnit.isSelected = false;
                this.turnManager.endTurn();

                Renderer.clearRenderablePaths();
                this.beginTurn();
            },

            onCameraMoved: function (unit)
            {
                unit.player.performTurn(unit);
            },

            onPlayerDefeat: function (player)
            {
                console.log('player defeated');
            },

            uninitialize: function ()
            {
                Scheduler.clear();
                Renderer.uninitialize();
                InputHandler.disableInput();
                BrowserNavigation.off('leaving:singlePlayer', this);
            }
        };
    });
