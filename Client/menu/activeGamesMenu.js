define(['text!menu/activeGamesMenu.html', 'menu/menuNavigator', 'core/src/imageCache'],
    function (ActiveGamesTemplate, MenuNavigator, ImageCache)
    {
        return {
            show: function (parentElement, socket, gameClickedCallback)
            {
                this.socket = socket;
                this.gameClickedCallback = gameClickedCallback;

                MenuNavigator.insertTemplate(parentElement, ActiveGamesTemplate);
            },

            onGamesCreated: function (games)
            {
                var waitingOnYouGames = [];
                var waitingOnThemGames = [];

                for (var i = 0; i < games.length; ++i)
                {
                    var currentGame = games[i];
                    for (var j = 0; j < currentGame.usernames.length; ++j)
                    {
                        var username = currentGame.usernames[j];
                        if (username !== this.socket.user.username)
                        {
                            currentGame.opponentUser = username;
                        }
                    }

                    if (this.isWaitingOnUser(currentGame))
                    {
                        waitingOnYouGames.push(currentGame);
                        continue;
                    }

                    waitingOnThemGames.push(currentGame);
                }

                this.insertGames('waitingOnYouTable', waitingOnYouGames);
                this.insertGames('waitingOnThemTable', waitingOnThemGames);
            },

            onGamesUpdated: function (games) {

            },

            isWaitingOnUser: function (game)
            {
                for (var i = 0; i < game.waitingOn.length; ++i)
                {
                    if (game.waitingOn[i] === this.socket.user.username)
                    {
                        return true;
                    }
                }

                return false;
            },

            insertGames: function (tableID, games)
            {
                var fragment = document.createDocumentFragment();
                for (var i = 0; i < games.length; ++i)
                {
                    var game = games[i];
                    var row = document.createElement('tr');
                    var levelNameCell = row.insertCell(0);
                    var opponentCell = row.insertCell(1);

                    row.addEventListener('click', this.onGameClicked.bind(this, game));

                    var levelImage = new Image();
                    levelImage.className = 'levelThumbnail';
                    ImageCache.bindImage(game.level, levelImage);

                    levelNameCell.appendChild(levelImage);
                    opponentCell.innerHTML = game.opponentUser.username;

                    fragment.appendChild(row);
                }

                document.getElementById(tableID).appendChild(fragment);
            },

            onGameClicked: function (game)
            {
                this.gameClickedCallback(game);
            }
        };
    });
