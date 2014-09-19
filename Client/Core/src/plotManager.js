define([
        'renderer/src/renderer',
        './turnManager',
        './players/automatedPlayer',
        './players/localPlayer',
        './players/remotePlayer',
        './unitActions',
        './map',
        './soldier',
        'renderer/src/ui/actionPanel',
        'renderer/src/ui/confirmationPanel'
    ],
    function (Renderer, TurnManager, AutomatedPlayer, LocalPlayer, RemotePlayer, UnitActions,
        Map, Soldier, ActionPanel, ConfirmationPanel)
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
                this.actionPanel = new ActionPanel();
                this.actionPanel.on('actionSelected', this, this.onActionSelected);

                this.socket.on(this.socket.events.gameStateUpdate.response.success, function ()
                {
                    this.unitActions = [];
                }.bind(this));

                Renderer.addRenderableMap(this.currentMap);

                // TODO Fix
                var currentUsername = this.socket.user.username;
                var localUnits = [];
                var remoteUnits = [];
                for (var i = 0; i < game.units.length; ++i)
                {
                    var unit = new Soldier(game.units[i]);
                    unit.isLocal = game.units[i].username === currentUsername;

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

                Renderer.camera.moveToUnit(this.turnManager.activeUnit, callback);

                if (this.unitActions.length > 0 && unit.player !== this.localPlayer)
                {
                    // The local player is out of moves
                    this.socket.emit(this.socket.events.gameStateUpdate.url, this.currentGame._id, this.unitActions);
                }
            },

            onCameraMoved: function (unit)
            {
                if (!unit.isLocal)
                {
                    return;
                }

                this.actionPanel.open(unit, this.unitLogic.getAttacks(unit));
            },

            onActionSelected: function (action)
            {
                Renderer.clearRenderablePaths();
                this.actionPanel.hide();

                if (action.name === 'endTurn')
                {
                    this.endTurn();
                    return;
                }

                if (action.name === 'move')
                {
                    this.availableNodes = this.unitLogic.getMoveNodes(this.map, this.unit);
                    Renderer.addRenderablePath('moveTiles', this.availableNodes, false);
                    this.map.on('tileClick', this, this.onMoveTileSelected);
                }
                else
                {
                    this.currentAttack = action;
                    this.availableNodes = this.unitLogic.getAttackNodes(this.map, this.unit, this.currentAttack);

                    Renderer.addRenderablePath('attack', this.availableNodes, false);
                    this.map.on('tileClick', this, this.onAttackTileSelected);
                }

                this.confirmationPanel = new ConfirmationPanel();
                this.confirmationPanel.on('actionSelected', this, this.onPerformActionSelected);
                this.confirmationPanel.open(this.unit);
            },

            endTurn: function ()
            {
                if (this.turnManager.activeUnit.username === this.socket.user.username)
                {
                    this.unitActions.push(
                    {
                        type: "ENDTURN"
                    });
                }

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
