define([
        'renderer/src/renderer',
        './turnManager',
        './players/automatedPlayer',
        './players/localPlayer',
        './players/remotePlayer',
        './unitActions',
        './map',
        './soldier'
    ],
    function (Renderer, TurnManager, AutomatedPlayer, LocalPlayer, RemotePlayer, UnitActions, Map, Soldier)
    {
        'use strict';

        return {

            loadGame: function (socket, unitLogic, game, levelData)
            {
                this.players = [];
                this.socket = socket;
                this.unitLogic = unitLogic;
                this.currentGame = game;
                this.currentMap = levelData.map;
                this.turnManager = new TurnManager();
                this.unitActions = [];

                Renderer.addRenderableMap(this.currentMap);

                // TODO Fix
                var currentUsername = this.socket.user.username;
                var localUnits = [];
                var remoteUnits = [];
                for (var i = 0; i < game.units.length; ++i)
                {
                    var unit = new Soldier(game.units[i]);

                    if (unit.username === this.socket.user.username)
                    {
                        localUnits.push(unit);
                    }
                    else
                    {
                        remoteUnits.push(unit);
                    }

                    //unit.on('death', this.onSoldierDeath.bind(this));
                    //this.openUnitStatusPanel(unit);
                    this.turnManager.addUnit(unit);
                    Renderer.addRenderableSoldier(unit);
                }

                for (i = 0; i < game.usernames.length; i++)
                {
                    var username = game.usernames[i];
                    if (username === currentUsername)
                    {
                        this.localPlayer = new LocalPlayer(this.socket, unitLogic, this.currentMap, localUnits);
                        this.players.push(this.localPlayer);
                    }
                    else
                    {
                        this.players.push(new RemotePlayer(this.socket, unitLogic, this.currentMap, remoteUnits));
                    }
                }

                for (i = 0; i < this.players.length; i++)
                {
                    var player = this.players[i];
                    player.on('defeat', this, this.onPlayerDefeat);
                    player.on('endTurn', this, this.endTurn);
                    player.on('attack', this, this.onLocalUnitAttack);
                    player.on('move', this, this.onLocalUnitMove);
                }

                this.beginTurn(this.onCameraMoved.bind(this));
            },

            beginTurn: function (callback)
            {
                this.turnManager.beginTurn();

                var unit = this.turnManager.activeUnit;
                unit.isSelected = true;
                Renderer.camera.moveToUnit(unit, callback);

                // Update all the turn numbers
                for (var i = 0; i < this.players.length; i++)
                {
                    var player = this.players[i];
                    for (var j = 0; j < player.units.length; j++)
                    {
                        var currentUnit = player.units[j];
                        if (currentUnit.statusPanel)
                        {
                            currentUnit.statusPanel.updateValues();
                        }
                    }
                }

                if (this.unitActions.length > 0 && unit.player !== this.localPlayer)
                {
                    // The local player is out of moves
                    this.socket.emit(this.socket.events.gameStateUpdate.url, this.currentGame._id, this.unitActions);

                    // TODO Clear when successful, check for error
                    // this.unitActions = [];
                }
            },

            endTurn: function ()
            {
                if (this.turnManager.activeUnit.player === this.localPlayer)
                {
                    this.unitActions.push(
                    {
                        type: "ENDTURN"
                    });
                }

                this.turnManager.activeUnit.isSelected = false;
                this.turnManager.endTurn();

                Renderer.clearRenderablePaths();
                this.beginTurn(this.onCameraMoved.bind(this));
            },

            onLocalUnitAttack: function (unit, attack, targetTile, affectedTiles)
            {
                this.unitActions.push(
                {
                    type: "ATTACK",
                    unitID: unit._id,
                    attack: attack,
                    targetTile: targetTile,
                    affectedTiles: affectedTiles
                });
            },

            onLocalUnitMove: function (map, unit, endNode)
            {
                this.unitActions.push(
                {
                    type: "MOVE",
                    unitID: unit._id,
                    endNode: endNode
                });
            },

            onCameraMoved: function (unit)
            {
                unit.player.performTurn(unit);
            },

            onPlayerDefeat: function (player)
            {
                console.log('player ' + player.name + ' defeated');
            },

            onGameStateUpdateReceived: function (actions)
            {
                this.performActions(actions);
            },

            performActions: function (actions)
            {
                var action = actions.shift();
                switch (action.type)
                {

                case "MOVE":
                    {
                        UnitActions.move(this.unitLogic, this.currentMap, action.unit, action.pathNodes);
                        break;
                    }

                case "ATTACK":
                    {
                        // TODO
                        break;
                    }

                case "ENDTURN":
                    {
                        // Nothing to validate
                        this.endTurn();

                        if (actions.length === 0)
                        {
                            this.beginTurn(this.onCameraMoved.bind(this));
                            return;
                        }
                        this.beginTurn(this.performActions.bind(this, actions));

                        break;
                    }

                default:
                    // TODO Handle out of date error
                    return;

                }
            }
        };
    });
