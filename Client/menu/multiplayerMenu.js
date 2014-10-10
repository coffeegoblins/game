define([
        'text!menu/multiplayerMenu.html',
        'menu/menuNavigator',
        'menu/battleConfigurationMenu',
        'menu/loginMenu',
        'menu/playerSearchMenu',
        'menu/activeGamesMenu',
        'menu/notificationsMenu',
        'core/src/levelLoader',
        'core/src/plotManager',
        'core/src/scheduler',
        'core/src/browserNavigation',
        'core/src/inputHandler',
        'renderer/src/renderer',
    ],
    function (Template, MenuNavigator, BattleConfigurationMenu, LoginMenu, PlayerSearchMenu, ActiveGamesMenu, NotificationsMenu, LevelLoader, PlotManager, Scheduler, BrowserNavigation, InputHandler, Renderer)
    {
        function parseFunctions(key, value)
        {
            if (typeof value === 'string' && value.length >= 8 && value.substring(0, 8) === 'function')
                return eval('(' + value + ')');

            return value;
        }

        return {
            show: function (parentElement, socket)
            {
                this.levels = {};
                this.socket = socket;
                this.parentElement = parentElement;

                this.loadGameLogic();
                MenuNavigator.insertTemplate(parentElement, Template);

                this.playerSearchMenu = new PlayerSearchMenu();

                this.content = document.getElementById('content');
                this.searchCriteria = document.getElementById('searchCriteria');
                this.searchButton = document.getElementById('searchButton');
                this.logoutButton = document.getElementById('logoutButton');
                this.notificationsButton = document.getElementById('notificationsButton');

                this.searchButton.addEventListener('click', this.searchForPlayer.bind(this));
                this.logoutButton.addEventListener('click', this.disconnect.bind(this));
                this.notificationsButton.addEventListener('click', NotificationsMenu.toggle.bind(NotificationsMenu, this.parentElement));

                this.playerSearchMenu.on('challengeDeclared', this, this.onChallengeDeclared);
                //this.activeGamesMenu.on('gameClicked', this, this.launchGame);

                ActiveGamesMenu.show(this.content, this.socket, this.launchGame.bind(this));
                NotificationsMenu.show(this.parentElement, this.socket, this.onChallengeAccepted.bind(this), this.onChallengeDeclined.bind(this));

                this.socket.on(this.socket.events.playerSearch.response.success, this.onSearchCompleted.bind(this));
                this.socket.on(this.socket.events.getLevels.response.success, this.onGetLevelsCompleted.bind(this));
            },

            disconnect: function ()
            {
                this.socket.disconnect();
            },

            launchGame: function (game)
            {
                document.body.className = 'game';
                while (document.body.lastChild)
                    document.body.removeChild(document.body.lastChild);

                Scheduler.clear();
                Renderer.initialize();
                InputHandler.disableInput();
                BrowserNavigation.on('leaving:singlePlayer', this, this.uninitialize);

                PlotManager.loadGame(this.socket, this.gameLogic, game, this.levels[game.level]);
            },

            uninitialize: function ()
            {
                Scheduler.clear();
                Renderer.uninitialize();
                InputHandler.disableInput();
                BrowserNavigation.off('leaving:singlePlayer', this);
            },

            loadGameLogic: function ()
            {
                var gameLogicVersion;
                var serializedGameLogic = window.localStorage.getItem('gameLogic');
                if (serializedGameLogic)
                {
                    //this.gameLogic = JSON.parse(serializedGameLogic, parseFunctions);
                    gameLogicVersion = '0.0';
                }

                this.socket.emit(this.socket.events.getGameLogic.url, gameLogicVersion);
                this.socket.on(this.socket.events.getGameLogic.response.success, function (gameLogic)
                {
                    if (gameLogic)
                    {
                        window.localStorage.setItem('gameLogic', gameLogic);
                        this.gameLogic = JSON.parse(gameLogic, parseFunctions);
                    }
                }.bind(this));
            },

            onGetLevelsCompleted: function (levels)
            {
                if (levels)
                {
                    var levelLoader = new LevelLoader();
                    for (var i = 0; i < levels.length; ++i)
                    {
                        var level = levels[i];
                        levelLoader.onLevelLoaded(level, function (data)
                        {
                            this.levels[level.name] = data;
                            Renderer.createLevelImage(level.name, data);
                        }.bind(this));
                    }
                }
            },

            onChallengeAccepted: function (id, levelName, onSuccess)
            {
                this.showBattleConfigurationMenu(levelName, function (levelData)
                {
                    this.socket.emit(this.socket.events.challengeAccepted.url, id, levelData);
                    this.socket.on(this.socket.events.createGame.response.success, function (game)
                    {
                        onSuccess();
                        this.launchGame(game);
                    }.bind(this));
                }.bind(this));
            },

            onChallengeDeclined: function (challengeID, callback)
            {
                this.socket.emit(this.socket.events.challengeDeclined.url, challengeID);

                callback();
            },

            onChallengeDeclared: function (userId)
            {
                this.showBattleConfigurationMenu(null, function (levelData)
                {
                    this.socket.emit(this.socket.events.challengeUser.url, userId, levelData);
                    this.parentElement.style.display = '';
                }.bind(this));
            },

            onSearchCompleted: function (cursor)
            {
                MenuNavigator.removeChildren(this.content);

                NotificationsMenu.hide();
                this.playerSearchMenu.show(this.content, cursor);

                this.searchCriteria.disabled = false;
                this.searchButton.disabled = false;
            },

            searchForPlayer: function ()
            {
                // TODO: Can't search for all players? Searching for '*' throws an exception
                if (!this.searchCriteria.value)
                {
                    MenuNavigator.removeChildren(this.content);
                    this.activeGamesMenu.show(this.content);
                    return;
                }

                this.searchCriteria.disabled = true;
                this.searchButton.disabled = true;

                this.socket.emit(this.socket.events.playerSearch.url, this.searchCriteria.value);
            },

            showBattleConfigurationMenu: function (levelName, callback)
            {
                // TODO Fix hack, use browser nav to save state
                var children = [];
                for (var i = 0; i < this.content.children.length; ++i)
                {
                    children.push(this.content.children[i]);
                }

                this.content.innerHTML = '';

                var battleConfig = new BattleConfigurationMenu(this.socket, this.gameLogic);
                battleConfig.on('cancel', this, function ()
                {
                    this.content.innerHTML = '';
                    for (i = 0; i < children.length; ++i)
                    {
                        this.content.appendChild(children[i]);
                    }
                }.bind(this));

                battleConfig.on('confirm', this, function (levelData)
                {
                    this.content.innerHTML = '';
                    for (i = 0; i < children.length; ++i)
                    {
                        this.content.appendChild(children[i]);
                    }

                    callback(levelData);
                }.bind(this));

                battleConfig.show(this.content, levelName);
            }
        };
    });
