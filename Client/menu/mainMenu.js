define(['text!menu/mainMenu.html', 'text!menu/mainMenuButtons.html', 'text!menu/searchBar.html',
        'core/src/plotManager', './loginPopup', 'core/src/browserNavigation', 'text!menu/playerSearch.html', './unitSelection'],
    function (MainMenuTemplate, MainMenuButtonsTemplate, SearchBarTemplate, PlotManager, LoginPopup, BrowserNavigation, PlayerSearchTemplate, UnitSelection)
    {
        'use strict';
        function MainMenu()
        {
            BrowserNavigation.on('root', this.show.bind(this));
            BrowserNavigation.on('unitSelection', this.loadUnitSelection.bind(this));
            BrowserNavigation.on('singlePlayer', this.loadSinglePlayer.bind(this));

            this.loginPopup = new LoginPopup(this);
        }

        MainMenu.prototype.show = function ()
        {
            document.body.innerHTML = MainMenuTemplate;
            document.body.className = 'main-menu';

            this.mainMenuBar = document.getElementById('mainMenuBar');
            this.mainMenuChains = document.getElementById('mainMenuChains');
            this.mainMenuContent = document.getElementById('content');
            this.mainMenuChains.innerHTML = MainMenuButtonsTemplate;

            this.mainMenuChains.on('click', '.menuItem p', this.onMenuItemClicked.bind(this));
            this.mainMenuChains.className = 'lowerChains';
        };

        MainMenu.prototype.hide = function ()
        {
            document.body.innerHTML = "";
        };

        MainMenu.prototype.onMenuItemClicked = function (e)
        {
            switch (e.target.id)
            {
                case 'singlePlayer':
                    this.mainMenuChains.className = 'raiseChains';
                    BrowserNavigation.addState('unitSelection');
                    this.loadUnitSelection();
                    break;
                case 'multiPlayer':
                    this.mainMenuChains.className = 'raiseChains';
                    setTimeout(this.loginPopup.show(this.onLoginSucceeded, this), 0);
                    break;
                case 'options':

                    break;
                case 'exit':

                    break;
            }
        };

        MainMenu.prototype.loadSinglePlayer = function ()
        {
            document.body.className = 'game';
            while (document.body.lastChild)
                document.body.removeChild(document.body.lastChild);

            PlotManager.loadLevel('level1');
        };

        MainMenu.prototype.loadUnitSelection = function ()
        {
            document.body.className = '';

            var unitSelection = new UnitSelection().show();
            unitSelection.on('cancel', this, this.show);
            unitSelection.on('confirm', this, function ()
            {
                BrowserNavigation.addState('singlePlayer');
                this.loadSinglePlayer();
            });
        };

        MainMenu.prototype.onLoginSucceeded = function (socket, user)
        {
            while (this.mainMenuChains.lastChild)
                this.mainMenuChains.removeChild(this.mainMenuChains.lastChild);

            this.mainMenuBar.innerHTML = SearchBarTemplate;

            document.getElementById('searchButton').addEventListener('click', this.onPlayerSearchButtonClicked.bind(this));

            this.socket = socket;
            this.user = user;

            this.socket.on(this.socket.events.searchByUsername.response.success, function (cursor)
            {
                for (var x = this.searchResultsTable.rows.length - 1; x >= 0; --x)
                {
                    this.searchResultsTable.deleteRow(x);
                }

                for (var i = 0; i < cursor.length; ++i)
                {
                    var row = this.searchResultsTable.insertRow(i);

                    var cell1 = row.insertCell(0);
                    var cell2 = row.insertCell(1);

                    cell1.innerHTML = cursor[i].username;
                    cell1.className = "userName";
                    cell2.innerHTML = "<input type='button' value='Challenge!' id='" + cursor[i]._id + "'>";

                    document.getElementById(cursor[i]._id).addEventListener('click', this.onPlayerChallenged.bind(this));
                }
            }.bind(this));
        };

        MainMenu.prototype.onPlayerSearchButtonClicked = function ()
        {
            this.mainMenuChains.className = 'raiseChains';
            this.mainMenuContent.innerHTML = PlayerSearchTemplate;

            this.searchCriteria = document.getElementById('searchCriteria');
            this.searchResultsTable = document.getElementById('searchResultsTable');

            this.socket.emit(this.socket.events.searchByUsername.name, this.searchCriteria.value);
        };

        MainMenu.prototype.onPlayerChallenged = function (e)
        {
            this.socket.emit(this.socket.events.challengeUser.name, this.user._id, e.target.id);
        };

        return new MainMenu();
    });
