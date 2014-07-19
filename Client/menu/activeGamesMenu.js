define(['text!menu/activeGamesMenu.html', 'core/src/utility', 'menu/menuNavigator', 'core/src/plotManager'],
    function (ActiveGamesTemplate, Utility, MenuNavigator, PlotManager)
    {
        'use strict';

        function parseFunctions(key, value)
        {
            if (typeof value === 'string' && value.length >= 8 && value.substring(0, 8) === 'function')
                return eval('(' + value + ')');

            return value;
        }

        function ActiveGamesMenu(socket)
        {
            this.socket = socket;

            var waitingOnYouGames = [];
            var waitingOnThemGames = [];

            this.socket.on(this.socket.events.getGames.response.success, function (games)
            {
                for (var i = 0; i < games.length; ++i)
                {
                    var currentGame = games[i];

                    for (var j = 0; j < currentGame.users.length; ++j)
                    {
                        var user = currentGame.waitingOn[j];

                        if (user.lowerCaseUsername !== this.socket.user.lowerCaseUsername)
                        {
                            currentGame.opponentUser = user;
                        }
                    }

                    if (this.isWaitingOnUser(currentGame))
                    {
                        waitingOnYouGames.push(currentGame);
                        continue;
                    }

                    waitingOnThemGames.push(currentGame);
                }

                this.updateTemplate(waitingOnYouGames, waitingOnThemGames);
            }.bind(this));

            this.loadGameLogic();
        }

        ActiveGamesMenu.prototype.isWaitingOnUser = function (game)
        {
            for (var k = 0; k < game.waitingOn.length; ++k)
            {
                if (game.waitingOn[k].lowerCaseUsername === this.socket.user.lowerCaseUsername)
                {
                    return true;
                }
            }

            return false;
        };

        ActiveGamesMenu.prototype.show = function (parentElement)
        {
            this.parentElement = parentElement;

            this.socket.emit(this.socket.events.getGames.name);
        };

        ActiveGamesMenu.prototype.updateTemplate = function (waitingOnYouGames, waitingOnThemGames)
        {
            Utility.insertTemplate(this.parentElement, ActiveGamesTemplate);

            this.insertGames('waitingOnYouTable', waitingOnYouGames);
            this.insertGames('waitingOnThemTable', waitingOnThemGames);
        };

        ActiveGamesMenu.prototype.insertGames = function (tableID, games)
        {
            var table = document.getElementById(tableID);

            MenuNavigator.removeChildren(table);

            for (var i = 0; i < games.length; ++i)
            {
                var game = games[i];

                var row = table.insertRow(i);
                var levelNameCell = row.insertCell(0);
                var opponentCell = row.insertCell(1);

                row.addEventListener('click', this.onGameClicked.bind(this, game));

                levelNameCell.innerHTML = game.level;
                opponentCell.innerHTML = game.opponentUser.username;
            }
        };

        ActiveGamesMenu.prototype.onGameClicked = function (game)
        {
            document.body.className = 'game';
            while (document.body.lastChild)
                document.body.removeChild(document.body.lastChild);

            if (this.gameLogic)
            {
                PlotManager.loadLevel(this.socket, this.gameLogic, 'level1', game.units);
            }
        };

        ActiveGamesMenu.prototype.loadGameLogic = function ()
        {
            var gameLogicVersion;
            var serializedGameLogic = window.localStorage.getItem('gameLogic');
            if (serializedGameLogic)
            {
                this.gameLogic = JSON.parse(serializedGameLogic, parseFunctions);
                gameLogicVersion = this.gameLogic.version;
            }

            this.socket.emit(this.socket.events.getGameLogic.name, gameLogicVersion);
            this.socket.on(this.socket.events.getGameLogic.response.success, function (gameLogic)
            {
                if (gameLogic)
                {
                    window.localStorage.setItem('gameLogic', gameLogic);
                    this.gameLogic = JSON.parse(gameLogic, parseFunctions);
                }
            }.bind(this));
        };

        return ActiveGamesMenu;
    });
