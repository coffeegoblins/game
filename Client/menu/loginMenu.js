define(['text!menu/loginMenu.html', 'menu/menuNavigator', 'lib/socket.io'], function (Template, MenuNavigator, io)
{
    var SERVER_URL = 'http://nodejs-coffeegoblins.rhcloud.com:8000';

    return {
        show: function (parentElement, loginSuccessCallback)
        {
            this.parentElement = parentElement;
            this.loginSuccessCallback = loginSuccessCallback;

            var token = localStorage.getItem('token');
            if (token)
            {
                this.connectSocket(token, this.loginSuccessCallback, function ()
                {
                    // Token is expired
                    localStorage.removeItem('token');

                    this.show(parentElement, loginSuccessCallback);
                }.bind(this));

                return;
            }

            parentElement.innerHTML = Template;

            this.errorMessage = document.getElementById('errorMessage');
            this.usernameInput = document.getElementById('usernameInput');
            this.passwordInput = document.getElementById('passwordInput');
            this.confirmPasswordInput = document.getElementById('confirmPasswordInput');
            this.loginButton = document.getElementById('loginButton');
            this.registerButton = document.getElementById('registerButton');

            this.loginButton.addEventListener('click', this.login.bind(this), false);
            this.registerButton.addEventListener('click', this.register.bind(this), false);
        },

        setError: function (error)
        {
            if (error)
            {
                this.errorMessage.innerHTML = error;
            }
        },

        login: function ()
        {
            var requestData = 'username=' + encodeURIComponent(this.usernameInput.value) + "&password=" + encodeURIComponent(btoa(this.passwordInput.value));
            this.sendRequest('/login', requestData, function (request)
            {
                if (request.status === 200)
                {
                    var response = JSON.parse(request.responseText);

                    localStorage.setItem("token", response.token);

                    this.connectSocket(response.token, this.loginSuccessCallback, this.setError.bind(this));
                }
                else
                { // TODO: Handle error better
                    this.errorMessage.innerHTML = request.statusText;
                }
            }.bind(this));
        },

        register: function ()
        {
            if (this.passwordInput.value !== this.confirmPasswordInput.value)
            {
                this.errorMessage.textContent = 'Passwords did not match!';
                return;
            }

            var requestData = 'username=' + encodeURIComponent(this.usernameInput.value) + "&password=" + encodeURIComponent(this.passwordInput.value);
            this.sendRequest('/register', requestData, function (request)
            {
                if (request.status === 200)
                {
                    this.login();
                }
                else
                { // TODO: Handle error better
                    this.errorMessage.innerHTML = request.statusText;
                }
            }.bind(this));
        },

        connectSocket: function (token, successCallback, errorCallback)
        {
            var socket = io(SERVER_URL,
                {
                    query: "token=" + token,
                    forceNew: true
                });

            socket.on('connect', successCallback.bind(this, socket));
            socket.on('error', errorCallback);
        },

        sendRequest: function (route, data, callback)
        {
            var request = new XMLHttpRequest();
            request.open('POST', SERVER_URL + route.toString());
            request.overrideMimeType('application/json');
            request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

            request.onreadystatechange = function ()
            {
                if (request.readyState === 4)
                    callback(request);
            };

            request.send(data);
        }
    };
});
