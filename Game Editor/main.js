define('engine/game/viewport', [], function ()
{
    'use strict';

    var controllerDefaults = {
        border: 0,
        centerTarget: false,
        leadTarget: false,
        isPercentageBased: false,
        leadScale: 1
    };

    function Viewport(renderer)
    {
        this.scale = 1;
        this.minScale = 0.25;
        this.maxScale = 4;
        this.renderer = renderer;
        this.controllerStack = new LinkedList();

        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');
        this.canvas.tabIndex = 0;

        document.body.insertBefore(this.canvas, document.body.firstElementChild || null);
        this.rect = new Rectangle(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

        this.onResize();
        window.addEventListener('resize', this.onResize.bind(this));

        window.viewport = this;
    }

    Viewport.prototype.addController = function (options)
    {
        var controller = Utility.merge({}, controllerDefaults, options);
        this.controllerStack.addFirst(controller);
        return controller;
    };

    Viewport.prototype.fromScreen = function (x, y)
    {
        return this.renderer.fromScreen(this, x, y);
    };

    Viewport.prototype.move = function (deltaX, deltaY)
    {
        this.setPosition(this.rect.left + deltaX, this.rect.top + deltaY);
    };

    Viewport.prototype.onResize = function ()
    {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        this.rect.width = this.canvas.width / this.scale;
        this.rect.height = this.canvas.height / this.scale;

        this.rect.setPosition(
            Math.floor(this.rect.center.x - this.rect.width / 2),
            Math.floor(this.rect.center.y - this.rect.height / 2)
        );
    };

    Viewport.prototype.removeController = function (controller)
    {
        this.controllerStack.remove(controller);
    };

    Viewport.prototype.setBounds = function (rect)
    {
        if (rect)
        {
            this.bounds = rect;
            this.setPosition(this.rect.left, this.rect.top);
        }
        else
            this.bounds = null;
    };

    Viewport.prototype.setPosition = function (xPosition, yPosition)
    {
        if (this.bounds)
        {
            if (this.bounds.width < this.rect.width)
                xPosition = 0;
            else if (xPosition < this.bounds.left)
                xPosition = this.bounds.left;
            else if (xPosition > this.bounds.right - this.rect.width)
                xPosition = this.bounds.right - this.rect.width;

            if (this.bounds.height < this.rect.height)
                yPosition = 0;
            else if (yPosition < this.bounds.top)
                yPosition = this.bounds.top;
            else if (yPosition > this.bounds.bottom - this.rect.height)
                yPosition = this.bounds.bottom - this.rect.height;
        }

        this.rect.setPosition(Math.floor(xPosition), Math.floor(yPosition));
    };

    Viewport.prototype.setScale = function (scale, position)
    {
        scale = Utility.clamp(scale, this.minScale, this.maxScale);
        if (this.scale === scale)
            return;

        var worldSpace = this.renderer.fromScreen(this, position.x, position.y);

        this.scale = scale;
        this.rect.width = this.canvas.width / scale;
        this.rect.height = this.canvas.height / scale;

        var screenSpace = this.renderer.toScreen(this, worldSpace.x, worldSpace.y);
        var offsetX = screenSpace.x - position.x;
        var offsetY = screenSpace.y - position.y;

        this.rect.setPosition(Math.floor(this.rect.left + offsetX), Math.floor(this.rect.top + offsetY));
    };

    Viewport.prototype.toScreen = function (x, y)
    {
        return this.renderer.toScreen(this, x, y);
    };

    Viewport.prototype.update = function ()
    {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.updateController();
    };

    Viewport.prototype.updateController = function ()
    {
        var controller = this.controllerStack.first;
        if (!controller || !controller.target)
            return;

        var borderX = controller.border;
        var borderY = controller.border;

        if (controller.isPercentageBased)
        {
            borderX *= this.rect.width;
            borderY *= this.rect.height;
        }

        var targetPositionX = controller.target.rect.center.x;
        var targetPositionY = controller.target.rect.center.y;
        if (controller.leadTarget)
        {
            targetPositionX += controller.target.velocity.x * controller.leadScale;
            targetPositionY += controller.target.velocity.y * controller.leadScale;
        }

        var newViewportX, newViewportY;
        if (controller.centerTarget)
        {
            newViewportX = targetPositionX - this.rect.width / 2;
            newViewportY = targetPositionY - this.rect.height / 2;
        }
        else
        {
            newViewportX = this.rect.left;
            newViewportY = this.rect.top;
        }

        var rightConstraint = newViewportX + this.rect.width - borderX;
        var bottomConstraint = newViewportY + this.rect.height - borderY;

        if (controller.target.rect.left < newViewportX + borderX)
            newViewportX = controller.target.rect.left - borderX;
        else if (controller.target.rect.right > rightConstraint)
            newViewportX = newViewportX + controller.target.rect.right - rightConstraint;

        if (controller.target.rect.top < newViewportY + borderY)
            newViewportY = controller.target.rect.top - borderY;
        else if (controller.target.rect.bottom > bottomConstraint)
            newViewportY = newViewportY + controller.target.rect.bottom - bottomConstraint;

        if (newViewportX !== this.rect.x || newViewportY !== this.rect.y)
            this.setPosition(newViewportX, newViewportY);
    };

    return Viewport;
});
define('engine/core/scheduler', [], function ()
{
    'use strict';

    // Shim for some webkit versions
    if (!window.requestAnimationFrame && window.webkitRequestAnimationFrame)
    {
        window.requestAnimationFrame = window.webkitRequestAnimationFrame;
        if (window.webkitCancelRequestAnimationFrame)
            window.cancelAnimationFrame = window.webkitCancelRequestAnimationFrame;
    }

    // Variables for the main loop
    var updateLoopId;
    var lastUpdateTime = 0;
    var eventQueue;
    var throttledEventQueue;

    function Scheduler() {}

    Scheduler.isRunning = false;

    Scheduler.priority = {
        update: 1000,
        animation: 500,
        render: 100
    };


    Scheduler.limitExecution = function (method, context, duration)
    {
        var throttledEvent = throttledEventQueue.first;
        while (throttledEvent)
        {
            if (throttledEvent.method === method && throttledEvent.context === context)
                return;

            throttledEvent = throttledEvent.next;
        }

        throttledEventQueue.addLast({method: method, context: context, timeRemaining: duration});
        return method.apply(context);
    };

    Scheduler.start = function ()
    {
        if (!eventQueue)
            eventQueue = new LinkedList();

        if (!throttledEventQueue)
            throttledEventQueue = new LinkedList();

        Scheduler.isRunning = true;
        updateLoopId = window.requestAnimationFrame(update);
    };

    Scheduler.stop = function ()
    {
        Scheduler.isRunning = false;
        window.cancelAnimationFrame(updateLoopId);
    };

    Scheduler.schedule = function (eventData)
    {
        if (eventData.interval == null)
            eventData.interval = 0;

        if (eventData.priority == null)
            eventData.priority = Scheduler.priority.update;

        eventData.timeRemaining = eventData.interval;
        eventQueue.insertSorted(eventData, 'priority');
    };

    Scheduler.unschedule = function (eventData)
    {
        eventQueue.remove(eventData);
    };

    Scheduler.unscheduleById = function (id)
    {
        eventQueue.removeBy('id', id);
    };


    function update(time)
    {
        if (!Scheduler.isRunning)
            return;

        var deltaTime = (time - lastUpdateTime) * 0.001;
        lastUpdateTime = time;

        // Don't let the game clock sink lower than 20fps
        if (deltaTime > 0.05)
            deltaTime = 0.05;

        // Update any events that have registered with the game
        var currentEvent = eventQueue.first;
        while (currentEvent)
        {
            currentEvent.timeRemaining -= deltaTime;
            if (currentEvent.timeRemaining < 0)
            {
                currentEvent.method.call(currentEvent.context, currentEvent, deltaTime);
                currentEvent.timeRemaining += currentEvent.interval;
                if (currentEvent.timeRemaining < 0)
                    currentEvent.timeRemaining = 0;
            }

            currentEvent = currentEvent.next;
        }

        currentEvent = throttledEventQueue.first;
        while (currentEvent)
        {
            currentEvent.timeRemaining -= deltaTime;
            if (currentEvent.timeRemaining < 0)
                throttledEventQueue.remove(currentEvent); // TODO: Optimize this a bit

            currentEvent = currentEvent.next;
        }

        updateLoopId = window.requestAnimationFrame(update);
    }

    return Scheduler;
});
define('engine/core/domShim', [], function ()
{
    'use strict';

    if (!document.documentElement.matches)
    { // Reassignment of matches to the proper variable, if the standard isn't already supported
        var matchMethods = ['webkitMatchesSelector', 'mozMatchesSelector', 'msMatchesSelector', 'oMatchesSelector'];
        for (var i = 0; i < matchMethods.length; i++)
        {
            if (document.documentElement[matchMethods[i]])
            {
                Element.prototype.matches = document.documentElement[matchMethods[i]];
                break;
            }
        }
    }

    // An early check for new KeyboardEvent(). Firefox has the function, but
    // doesn't allow it to be constructed because they love developers.
    var isKeyboardConstructionSupported = false;
    if (typeof window.KeyboardEvent === 'function')
    {
        (function ()
        {
            try
            {
                new window.KeyboardEvent('keydown');
                isKeyboardConstructionSupported = true;
            }
            catch (e)
            {
            }
        }());
    }

    // Events that have native simulation functions built in
    var nativeEvents = {'blur': true, 'click': true, 'focus': true};

    function isMatchingHandler(handlerData, namespace, selector, method)
    {
        if (method)
            return method === handlerData.method;

        if (namespace && namespace !== handlerData.namespace)
            return false;

        if (selector && selector !== handlerData.selector)
            return false;

        return true;
    }

    Element.prototype.on = function (eventName, selector, method)
    {
        var handler;
        if (arguments.length === 2)
        { // This handler is targeting the source element
            method = selector;
            handler = method;
            selector = null;
        }
        else
        {
            handler = function (e)
            {
                var childElement = e.target;
                while (childElement && childElement !== e.currentTarget)
                {
                    if (childElement.matches(selector))
                    {
                        method.call(e.currentTarget, e);
                        break;
                    }

                    childElement = childElement.parentNode;
                }
            };
        }

        if (!this._events)
            this._events = {};

        var fullName = eventName.split('.');
        var name = fullName[0];
        var namespace = fullName[1];

        if (!this._events[name])
            this._events[name] = [];

        this._events[name].push({
            name: name,
            namespace: namespace,
            handler: handler,
            method: method,
            selector: selector
        });

        this.addEventListener(name, handler, false);
    };

    Element.prototype.off = function (eventName, selector, method)
    {
        if (!this._events)
            return;

        var i;
        var handlers = [];
        if (eventName)
        {
            var namespace = eventName.split('.');
            eventName = namespace[0];
            namespace = namespace[1];

            var eventHandlers = this._events[eventName];
            if (eventHandlers)
            {
                if (arguments.length === 1)
                { // Removing by event name
                    handlers = eventHandlers;
                    delete this._events[eventName];
                }
                else
                { // Removing by selector and/or method
                    if (arguments.length === 2 && typeof selector === 'function')
                    {
                        method = selector;
                        selector = null;
                    }

                    for (i = eventHandlers.length - 1; i >= 0; i--)
                    {
                        if (isMatchingHandler(eventHandlers[i], namespace, selector, method))
                        {
                            handlers.push(eventHandlers[i]);
                            eventHandlers.splice(i, 1);
                        }
                    }

                    if (!eventHandlers.length)
                        delete this._events[eventName];
                }
            }
        }
        else
        { // Remove all events
            for (var name in this._events)
                handlers.push.apply(handlers, this._events[name]);

            this._events = null;
        }

        for (i = 0; i < handlers.length; i++)
        {
            var handlerData = handlers[i];
            this.removeEventListener(handlerData.name, handlerData.handler, false);
        }
    };

    Element.prototype.trigger = function (eventName, eventType, params)
    {
        if (nativeEvents[eventName])
        {
            this[eventName]();
            return;
        }

        if (!params)
            params = {bubbles: true, cancelable: true};

        // IE11 throws if view is undefined
        if (params.view === undefined)
            params.view = null;

        var eventObj;
        if (typeof window[eventType] === 'function')
        { // Most browsers have event constructors built in
            if (eventType === 'KeyboardEvent' && !isKeyboardConstructionSupported)
            { // Careful Firefox, you're getting pretty close to IE here
                eventObj = document.createEvent(eventType);
                eventObj.initKeyEvent(eventName, params.bubbles, params.cancelable, params.view,
                    params.ctrlKey, params.altKey, params.shiftKey, params.metaKey, params.key, params.char);
            }
            else
            {
                eventObj = new window[eventType](eventName, params);
            }
        }
        else
        { // IE does not (of course)
            eventObj = document.createEvent(eventType);
            switch (eventType)
            {
                case 'CustomEvent':
                    eventObj.initCustomEvent(eventName, params.bubbles, params.cancelable, params.detail);
                    break;
                case 'FocusEvent':
                    if (!params.detail)
                        params.relatedTarget = document.activeElement;

                    eventObj.initFocusEvent(eventName, params.bubbles, params.cancelable, params.view, params.detail, params.relatedTarget);
                    break;
                case 'KeyboardEvent':
                    var modifiers = '';
                    if (params.altKey) modifiers += 'Alt ';
                    if (params.ctrlKey) modifiers += 'Control ';
                    if (params.metaKey) modifiers += 'Meta ';
                    if (params.shiftKey) modifiers += 'Shift ';

                    eventObj.initKeyboardEvent(eventName, params.bubbles, params.cancelable, params.view,
                        params.key, params.location, params.modifiers, params.repeat, params.locale);
                    break;
                case 'MouseEvent':
                    eventObj.initMouseEvent(eventName, params.bubbles, params.cancelable, params.view, params.detail,
                        params.screenX, params.screenY, params.clientX, params.clientY, params.ctrlKey, params.altKey,
                        params.shiftKey, params.metaKey, params.button, params.relatedTarget);
                    break;
                case 'UIEvent':
                    eventObj.initUIEvent(eventName, params.bubbles, params.cancelable, params.view, params.detail);
                    break;
                default:
                    eventObj.initEvent(eventName, params.bubbles, params.cancelable);
                    break;
            }
        }

        this.dispatchEvent(eventObj);
    };
});
define('engine/core/linkedList', [], function ()
{
    'use strict';
    function LinkedList()
    {
        this.first = null;
    }

    LinkedList.prototype.addFirst = function (item)
    {
        item.next = this.first;
        this.first = item;
    };

    LinkedList.prototype.addLast = function (item)
    {
        item.next = null;
        if (this.first)
        {
            var current = this.first;
            while (current.next)
                current = current.next;

            current.next = item;
        }
        else
        {
            this.first = item;
        }
    };

    LinkedList.prototype.insertSorted = function (item, property)
    {
        if (this.first)
        {
            if (this.first[property] < item[property])
            {
                item.next = this.first;
                this.first = item;
            }
            else
            {
                var previous = this.first;
                while (previous.next && previous.next[property] > item[property])
                    previous = previous.next;

                item.next = previous.next;
                previous.next = item;
            }
        }
        else
        {
            this.first = item;
        }
    };

    LinkedList.prototype.remove = function (item)
    {
        if (this.first)
        {
            if (this.first === item)
            {
                this.first = this.first.next;
            }
            else
            {
                var current = this.first;
                while (current && current.next)
                {
                    if (current.next === item)
                    {
                        current.next = current.next.next;
                        break;
                    }

                    current = current.next;
                }
            }
        }
    };

    LinkedList.prototype.removeBy = function (property, value)
    {
        if (this.first)
        {
            if (this.first[property] === value)
            {
                this.first = this.first.next;
            }
            else
            {
                var current = this.first;
                while (current && current.next)
                {
                    if (current.next[property] === value)
                    {
                        current.next = current.next.next;
                        break;
                    }

                    current = current.next;
                }
            }
        }
    };

    LinkedList.prototype.removeFirst = function ()
    {
        if (this.first)
            this.first = this.first.next;
    };

    LinkedList.prototype.removeLast = function ()
    {
        if (this.first && this.first.next)
        {
            var current = this.first;
            while (current.next.next)
                current = current.next;

            current.next = null;
        }
        else
        {
            this.first = null;
        }
    };

    return LinkedList;
});
define('engine/core/rectangle', [], function ()
{
    'use strict';

    function Rectangle(x, y, width, height)
    {
        this.width = width;
        this.height = height;
        this.center = new Vector2();
        this.setPosition(x, y);
    }

    Rectangle.prototype.clone = function ()
    {
        return new Rectangle(this.left, this.top, this.width, this.height);
    };

    Rectangle.prototype.getPosition = function ()
    {
        return new Vector2(this.left, this.top);
    };

    Rectangle.prototype.getSimpleRect = function ()
    {
        return {x: this.left, y: this.top, width: this.width, height: this.height};
    };

    Rectangle.prototype.getSize = function ()
    {
        return new Vector2(this.width, this.height);
    };

    Rectangle.prototype.setCenter = function (x, y)
    {
        this.center.x = x;
        this.center.y = y;

        var halfWidth = this.width / 2;
        var halfHeight = this.height / 2;

        this.left = x - halfWidth;
        this.top = y - halfHeight;
        this.right = x - halfWidth;
        this.bottom = y - halfHeight;
    };

    Rectangle.prototype.setPosition = function (x, y)
    {
        this.left = x;
        this.top = y;

        this.right = x + this.width;
        this.bottom = y + this.height;

        this.center.x = x + this.width / 2;
        this.center.y = y + this.height / 2;
    };

    Rectangle.prototype.setSize = function (width, height)
    {
        this.width = width;
        this.height = height;

        this.right = this.left + this.width;
        this.bottom = this.top + this.height;

        this.center.x = this.left + this.width / 2;
        this.center.y = this.top + this.height / 2;
    };

    Rectangle.prototype.setSizeFromCenter = function (width, height)
    {
        this.width = width;
        this.height = height;

        var halfWidth = this.width / 2;
        var halfHeight = this.height / 2;

        this.left = this.center.x - halfWidth;
        this.top = this.center.y - halfHeight;
        this.right = this.center.x + halfWidth;
        this.bottom = this.center.y + halfHeight;
    };

    Rectangle.prototype.scale = function (value, isLocal)
    {
        if (isLocal !== false)
        {
            this.setSize(this.width * value, this.height * value);
        }
        else
        {
            this.width *= value;
            this.height *= value;
            this.setPosition(this.left * value, this.top * value);
        }
    };

    Rectangle.prototype.translate = function (x, y)
    {
        this.setPosition(this.left + x, this.top + y);
    };


    Rectangle.fromPoints = function (x1, y1, x2, y2)
    {
        var left, top, width, height;
        if (x1 < x2)
        {
            left = x1;
            width = x2 - x1;
        }
        else
        {
            left = x2;
            width = x1 - x2;
        }

        if (y1 < y2)
        {
            top = y1;
            height = y2 - y1;
        }
        else
        {
            top = y2;
            height = y1 - y2;
        }

        return new Rectangle(left, top, width, height);
    };

    Rectangle.fromSimpleRect = function (rect)
    {
        return new Rectangle(rect.x, rect.y, rect.width, rect.height);
    };

    return Rectangle;
});
define('engine/core/utility', [], function ()
{
    'use strict';

    return {
        appendElements: function (parent, elements)
        {
            if (Array.isArray(elements))
            {
                for (var i = 0; i < elements.length; i++)
                    parent.appendChild(elements[i]);
            }
            else
            {
                parent.appendChild(elements);
            }
        },

        clamp: function (value, min, max)
        {
            if (value <= min)
                return min;

            if (value >= max)
                return max;

            return value;
        },

        filter: function (obj, properties)
        {
            var result = {};
            for (var i = 0; i < properties.length; i++)
            {
                var property = properties[i];
                result[property] = obj[property];
            }

            return result;
        },

        findByProperty: function (array, property, value)
        {
            for (var i = 0; i < array.length; i++)
            {
                if (array[i][property] === value)
                    return array[i];
            }
        },

        findByProperties: function (array, properties)
        {
            for (var i = 0; i < array.length; i++)
            {
                var isMatching = true;
                for (var property in properties)
                {
                    if (array[i][property] !== properties[property])
                    {
                        isMatching = false;
                        break;
                    }
                }

                if (isMatching)
                    return array[i];
            }
        },

        findParent: function (element, selector)
        {
            while (element)
            {
                if (element.matches && element.matches(selector))
                    return element;

                element = element.parentNode;
            }
        },

        getElementFromTemplate: function (template, parent)
        {
            var tempElement = document.createElement('div');
            tempElement.innerHTML = template;

            var elements = [];
            for (var i = 0; i < tempElement.children.length; i++)
            {
                var node = tempElement.children[i];
                elements.push(node);
                if (parent)
                    parent.appendChild(node);
            }

            return (elements.length > 1) ? elements : elements[0];
        },

        getSign: function (number)
        {
            return number ? ((number < 0) ? -1 : 1) : 0;
        },

        inherit: function (Type, FromType)
        {
            Type.prototype = Object.create(FromType.prototype);
            Type.prototype.constructor = Type;
            Type.prototype.parent = FromType.prototype;
        },

        isObjectEmpty: function (obj)
        {
            for (var property in obj)
            {
                if (obj.hasOwnProperty(property))
                    return false;
            }

            return true;
        },

        merge: function ()
        {
            var baseObject = arguments[0];
            for (var i = 1; i < arguments.length; i++)
            {
                var object = arguments[i];
                if (object)
                {
                    for (var property in object)
                        baseObject[property] = object[property];
                }
            }

            return baseObject;
        },

        remove: function (array, element)
        {
            var index = array.indexOf(element);
            if (index >= 0)
            {
                array.splice(index, 1);
                return true;
            }
        },

        removeByProperty: function (array, property, value)
        {
            for (var i = 0; i < array.length; i++)
            {
                if (array[i][property] === value)
                    return array.splice(i, 1)[0];
            }
        },

        removeByProperties: function (array, properties)
        {
            for (var i = 0; i < array.length; i++)
            {
                var isMatching = true;
                for (var property in properties)
                {
                    if (array[i][property] !== properties[property])
                    {
                        isMatching = false;
                        break;
                    }
                }

                if (isMatching)
                    return array.splice(i, 1)[0];
            }
        },

        removeWhitespace: function (element)
        {
            for (var i = element.childNodes.length - 1; i >= 0; i--)
            {
                var childElement = element.childNodes[i];
                if (childElement.nodeType === 3 && !/S/.test(childElement.nodeValue))
                    element.removeChild(childElement);
                else if (childElement.nodeType === 1)
                    this.removeWhitespace(childElement);
            }
        }
    };
});
define('engine/core/vector2', [], function ()
{
    'use strict';
    function Vector2(x, y)
    {
        this.x = x || 0;
        this.y = y || 0;
    }

    Vector2.prototype.angle = function (angle)
    {
        if (angle == null)
        {
            return Math.atan2(this.y, this.x);
        }
        else
        {
            this.x = Math.cos(angle);
            this.y = Math.sin(angle);
        }
    };

    Vector2.prototype.clone = function ()
    {
        return new Vector2(this.x, this.y);
    };

    Vector2.prototype.length = function ()
    {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    };

    Vector2.prototype.lengthSquared = function ()
    {
        return this.x * this.x + this.y * this.y;
    };

    Vector2.prototype.normalize = function ()
    {
        var length = Math.sqrt(this.x * this.x + this.y * this.y);
        this.x /= length;
        this.y /= length;
        return length;
    };

    Vector2.prototype.rotate = function (angle)
    {
        var sine = Math.sin(angle);
        var cosine = Math.cos(angle);

        this.x = this.x * cosine - this.y * sine;
        this.y = this.x * sine + this.y * cosine;
        this.normalize();
    };


    Vector2.add = function (vector1, vector2)
    {
        return new Vector2(vector1.x + vector2.x, vector1.y + vector2.y);
    };

    Vector2.distance = function (vector1, vector2)
    {
        var deltaX = vector1.x - vector2.x;
        var deltaY = vector1.y - vector2.y;
        return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    };

    Vector2.distanceSquared = function (vector1, vector2)
    {
        var deltaX = vector1.x - vector2.x;
        var deltaY = vector1.y - vector2.y;
        return deltaX * deltaX + deltaY * deltaY;
    };

    Vector2.divide = function (vector1, value)
    {
        return new Vector2(vector1.x / value, vector1.y / value);
    };

    Vector2.dot = function (vector1, vector2)
    {
        return vector1.x * vector2.x + vector1.y * vector2.y;
    };

    Vector2.leftPerpendicular = function (vector)
    {
        return new Vector2(vector.y, -vector.x);
    };

    Vector2.multiply = function (vector1, value)
    {
        return new Vector2(vector1.x * value, vector1.y * value);
    };

    Vector2.normalize = function (vector)
    {
        var length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        return new Vector2(vector.x / length, vector.y / length);
    };

    Vector2.reverse = function (vector)
    {
        return new Vector2(-vector.x, -vector.y);
    };

    Vector2.rightPerpendicular = function (vector)
    {
        return new Vector2(-vector.y, vector.x);
    };

    Vector2.subtract = function (vector1, vector2)
    {
        return new Vector2(vector1.x - vector2.x, vector1.y - vector2.y);
    };

    return Vector2;
});
define('engine/game/game', ['./viewport', '../core/scheduler', '../core/domShim', '../core/linkedList', '../core/rectangle', '../core/utility', '../core/vector2'],
    function (Viewport, Scheduler, DomShim, LinkedList, Rectangle, Utility, Vector2)
    {
        'use strict';

        // Closure exports
        /* jshint sub:true */
        window['LinkedList'] = LinkedList;
        window['Rectangle'] = Rectangle;
        window['Utility'] = Utility;
        window['Vector2'] = Vector2;
        /* jshint sub:false */

        return {
            onReady: function (callback, renderer)
            {
                var interval = setInterval(function ()
                {
                    if (document.readyState === 'complete')
                    {
                        clearInterval(interval);

                        this.renderer = renderer;
                        Scheduler.start();
                        callback();
                    }
                }.bind(this), 20);
            },

            setScene: function (scene)
            {
                if (this.scene)
                {
                    this.scene.close();
                    this.scene.viewport = null;
                }

                this.scene = scene;
                this.scene.onLoaded(new Viewport(this.renderer));
            }
        };
    });
define('engine/rendering/render2dIsometric', [], function ()
{
    'use strict';
    return {
        drawGrid: function (viewport, rect, tileSize)
        {
            var context = viewport.context;
            var viewportRect = viewport.rect;

            var halfWidth = tileSize * viewport.scale / 2;
            var halfHeight = halfWidth / 2;

            var start, end;
            for (var x = 0; x <= rect.width; x++)
            {
                start = this.tileToScreen(x, 0, halfWidth, halfHeight);
                end = this.tileToScreen(x, rect.height, halfWidth, halfHeight);

                context.beginPath();
                context.moveTo(start.x + halfWidth - viewportRect.left, start.y - viewportRect.top);
                context.lineTo(end.x + halfWidth - viewportRect.left, end.y - viewportRect.top);
                context.stroke();
            }

            for (var y = 0; y <= rect.height; y++)
            {
                start = this.tileToScreen(0, y, halfWidth, halfHeight);
                end = this.tileToScreen(rect.width, y, halfWidth, halfHeight);

                context.beginPath();
                context.moveTo(start.x + halfWidth - viewportRect.left, start.y - viewportRect.top);
                context.lineTo(end.x + halfWidth - viewportRect.left, end.y - viewportRect.top);
                context.stroke();
            }
        },

        drawSpriteSheet: function (viewport, spriteSheet, rect)
        {
            var tileRect = spriteSheet.getCurrentTileBounds();
            if (tileRect)
            {
                var position = this.toScreen(viewport, rect.left, rect.top);

                var tileHeight = (rect.height * viewport.scale) / 2;
                var imageWidth = spriteSheet.tileWidth * viewport.scale;
                var imageHeight = spriteSheet.tileHeight * viewport.scale;

                var left = position.x - (imageWidth / 2);
                var top = position.y + tileHeight - imageHeight;

                viewport.context.drawImage(spriteSheet.image.data,
                    tileRect.x, tileRect.y, tileRect.width, tileRect.height,
                    left, top, imageWidth, imageHeight);
            }
        },

        drawRectangle: function (viewport, rect)
        {
            var context = viewport.context;

            context.beginPath();
            var position = this.toScreen(viewport, rect.left, rect.top);
            context.moveTo(position.x, position.y);

            position = this.toScreen(viewport, rect.right, rect.top);
            context.lineTo(position.x, position.y);

            position = this.toScreen(viewport, rect.right, rect.bottom);
            context.lineTo(position.x, position.y);

            position = this.toScreen(viewport, rect.left, rect.bottom);
            context.lineTo(position.x, position.y);
            context.closePath();
        },

        drawTiles: function (viewport, tileMap, spriteSheet)
        {
            var viewportRect, position;
            if (tileMap.xOffset || tileMap.yOffset)
            {
                viewportRect = viewport.rect.clone();
                position = this.toISO(-tileMap.xOffset, -tileMap.yOffset);
                viewportRect.translate(position.x * viewport.scale, position.y * viewport.scale);
            }
            else
            {
                viewportRect = viewport.rect;
            }

            var tileWidth = tileMap.tileSize * viewport.scale;
            var halfWidth = tileWidth / 2;
            var halfHeight = halfWidth / 2;

            var context = viewport.context;
            var viewportLeft = viewportRect.left;
            var viewportTop = viewportRect.top;

            for (var x = 0; x < tileMap.width; x++)
            {
                for (var y = 0; y < tileMap.height; y++)
                {
                    var tile = tileMap.getTile(x, y);
                    if (!tile)
                        continue;

                    var tileRect = spriteSheet.getTileBounds(tile - 1);
                    if (!tileRect)
                        continue;

                    position = this.tileToScreen(x, y, halfWidth, halfHeight);
                    context.drawImage(spriteSheet.image.data, tileRect.x, tileRect.y, tileRect.width, tileRect.height,
                            position.x - viewportLeft, position.y - viewportTop, tileWidth, halfWidth);
                }
            }
        },

        screenToTile: function (x, y, halfWidth, halfHeight)
        {
            return {
                x: Math.floor((x / halfWidth + y / halfHeight) / 2),
                y: Math.floor((y / halfHeight - x / halfWidth) / 2)
            };
        },

        tileToScreen: function (x, y, halfWidth, halfHeight)
        {
            return {
                x: (x - y) * halfWidth - halfWidth,
                y: (x + y) * halfHeight
            };
        },

        fromISO: function (x, y)
        {
            return {
                x: x + y * 2,
                y: y * 2 - x
            };
        },

        toISO: function (x, y)
        {
            return {
                x: (x - y) / 2,
                y: (x + y) / 4
            };
        },


        fromScreen: function (viewport, x, y)
        {
            x += viewport.rect.left;
            y += viewport.rect.top;

            return new Vector2((x + y * 2) / viewport.scale, (y * 2 - x) / viewport.scale);
        },

        toScreen: function (viewport, x, y)
        {
            return new Vector2(
                    ((x - y) / 2) * viewport.scale - viewport.rect.left,
                    ((x + y) / 4) * viewport.scale - viewport.rect.top
            );
        }
    };
});
define('engine/rendering/render2d', [], function ()
{
    'use strict';
    return {
        drawCircle: function (viewport, center, radius)
        {
            viewport.context.beginPath();
            viewport.context.arc(center.x - viewport.rect.left, center.y - viewport.rect.top, radius, 0, Math.PI * 2, false);
        },

        drawGrid: function (viewport, rect, tileSize)
        {
            var context = viewport.context;
            var viewportRect = viewport.rect;

            var visibleTileLeft = Math.max(0, Math.floor(viewportRect.left / tileSize));
            var visibleTileTop = Math.max(0, Math.floor(viewportRect.top / tileSize));

            var visibleTileRight = Math.min(rect.width, Math.ceil(viewportRect.right / tileSize));
            var visibleTileBottom = Math.min(rect.height, Math.ceil(viewportRect.bottom / tileSize));


            var topPosition = Math.floor((visibleTileTop * tileSize - viewportRect.top) * viewport.scale);
            var bottomPosition = Math.floor((visibleTileBottom * tileSize - viewportRect.top) * viewport.scale);

            for (var x = visibleTileLeft; x <= visibleTileRight; x++)
            {
                var xPosition = Math.floor((x * tileSize - viewportRect.left) * viewport.scale);

                context.beginPath();
                context.moveTo(xPosition, topPosition);
                context.lineTo(xPosition, bottomPosition);
                context.stroke();
            }

            var leftPosition = Math.floor((visibleTileLeft * tileSize - viewportRect.left) * viewport.scale);
            var rightPosition = Math.floor((visibleTileRight * tileSize - viewportRect.left) * viewport.scale);

            for (var y = visibleTileTop; y <= visibleTileBottom; y++)
            {
                var yPosition = Math.floor((y * tileSize - viewportRect.top) * viewport.scale);

                context.beginPath();
                context.moveTo(leftPosition, yPosition);
                context.lineTo(rightPosition, yPosition);
                context.stroke();
            }
        },

        drawRectangle: function (viewport, rect)
        {
            var x = Math.floor((rect.left - viewport.rect.left) * viewport.scale);
            var y = Math.floor((rect.top - viewport.rect.top) * viewport.scale);
            var width = Math.floor(rect.width * viewport.scale);
            var height = Math.floor(rect.height * viewport.scale);

            viewport.context.beginPath();
            viewport.context.rect(x, y, width, height);
        },

        drawTiles: function (viewport, tileMap, spriteSheet)
        {
            var viewportRect;
            if (tileMap.xOffset || tileMap.yOffset)
            {
                viewportRect = viewport.rect.clone();
                viewportRect.translate(-tileMap.xOffset, -tileMap.yOffset);
            }
            else
            {
                viewportRect = viewport.rect;
            }

            var tileSize = tileMap.tileSize;
            var visibleTileLeft = Math.max(0, Math.floor(viewportRect.left / tileSize));
            var visibleTileTop = Math.max(0, Math.floor(viewportRect.top / tileSize));

            var visibleTileRight = Math.min(tileMap.width - 1, Math.ceil(viewportRect.right / tileSize));
            var visibleTileBottom = Math.min(tileMap.height - 1, Math.ceil(viewportRect.bottom / tileSize));

            var visibleTileSize = tileSize * viewport.scale;
            for (var x = visibleTileLeft; x <= visibleTileRight; x++)
            {
                for (var y = visibleTileTop; y <= visibleTileBottom; y++)
                {
                    var tile = tileMap.getTile(x, y);
                    if (!tile)
                        continue;

                    var tileRect = spriteSheet.getTileBounds(tile - 1);
                    if (!tileRect)
                        continue;

                    var xPosition = (x * tileSize - viewportRect.left) * viewport.scale;
                    var yPosition = (y * tileSize - viewportRect.top) * viewport.scale;

                    viewport.context.drawImage(spriteSheet.image.data,
                        tileRect.x, tileRect.y, tileRect.width, tileRect.height,
                        xPosition, yPosition, visibleTileSize, visibleTileSize);
                }
            }
        },

        fromScreen: function (viewport, x, y)
        {
            return new Vector2(
                    viewport.rect.left + x / viewport.scale,
                    viewport.rect.top + y / viewport.scale
            );
        },

        toScreen: function (viewport, x, y)
        {
            return new Vector2((x - viewport.rect.left) * viewport.scale, (y - viewport.rect.top) * viewport.scale);
        }
    };
});
define('engine/data/fileHandler', [], function ()
{
    'use strict';
    var URL = window.URL || window.webkitURL;

    return {
        loadImage: function (file, callback)
        {
            if (file && file.type.match('image.*'))
            {
                var fileReader = new FileReader();
                fileReader.onload = function (fileResult)
                {
                    callback(file.name, fileResult.target.result);
                };

                fileReader.readAsDataURL(file);
                return true;
            }
        },

        loadJSON: function (file, callback)
        {
            if (file)
            {
                var index = file.name.lastIndexOf('.');
                var extension = file.name.substr(index + 1);
                if (extension.toLowerCase() !== 'json')
                    return;

                var fileReader = new FileReader();
                fileReader.onload = function (fileResult)
                {
                    callback(file.name, JSON.parse(fileResult.target.result));
                };

                fileReader.readAsText(file);
                return true;
            }
        },

        requestJSON: function (fileName, callback)
        {
            var request = new XMLHttpRequest();
            request.overrideMimeType('application/json');
            request.open('GET', fileName + '.json');

            request.onreadystatechange = function ()
            {
                if (request.readyState === 4 && request.status === 200)
                    callback(JSON.parse(request.responseText));
            };

            request.send();
        },

        saveJSON: function (fileName, data)
        {
            if (!Array.isArray(data))
                data = [data];

            var fileURL;
            try
            {
                fileURL = URL.createObjectURL(new Blob(data, {type: 'application/json'}));

                var downloadLink = document.createElement('a');
                downloadLink.href = fileURL;
                downloadLink.target = '_target';
                downloadLink.download = fileName;

                downloadLink.dispatchEvent(new MouseEvent('click', {view: window, bubbles: true, cancelable: true}));
            }
            catch (e)
            {
                console.log(e);
            }
            finally
            {
                if (fileURL)
                    URL.revokeObjectURL(fileURL);
            }
        }
    };
});
define('engine/media/imageCache', [], function ()
{
    'use strict';

    var images = {};

    function loadImage(source, callback)
    {
        var image = {isLoaded: false, data: new Image(), callback: callback};
        image.data.onload = onImageLoaded.bind(image);
        image.data.src = source;
        return image;
    }

    function onImageLoaded()
    {
        this.width = this.data.width;
        this.height = this.data.height;
        this.isLoaded = true;

        if (this.callback)
        {
            this.callback(this);
            this.callback = undefined;
        }

        this.data.onload = undefined;
    }

    return {
        clear: function ()
        {
            images = {};
        },

        createImage: function (data, callback)
        {
            return loadImage(data, callback);
        },

        getAll: function ()
        {
            var imageArray = [];
            for (var i in images)
                imageArray.push(images[i]);

            return imageArray;
        },

        getImage: function (id)
        {
            return images[id];
        },

        isLoading: function ()
        {
            for (var i in images)
            {
                if (!images[i].isLoaded)
                    return true;
            }

            return false;
        },

        loadImage: function (id, path, callback)
        {
            var image = images[id];
            if (!image)
            {
                image = loadImage(path, callback);
                image.id = id;
                images[id] = image;
            }

            return image;
        },

        unloadImage: function (id)
        {
            delete images[id];
        }
    };
});
define('engine/core/events', [], function ()
{
    'use strict';

    function on()
    {
        var eventName = arguments[0];
        if (!this.events)
            this.events = {};

        if (!this.events[eventName])
            this.events[eventName] = [];

        var context, method;
        if (arguments.length > 2)
        {
            context = arguments[1];
            method = arguments[2];
        }
        else
        {
            method = arguments[1];
        }

        this.events[eventName].push({context: context, method: method});
    }

    function off()
    {
        if (!this.events)
            return;

        var eventName = arguments[0];
        var handlers = this.events[eventName];
        if (!handlers || !handlers.length)
            return;

        if (arguments.length >= 3)
        {
            Utility.removeByProperties(handlers, {context: arguments[1], method: arguments[2]});
        }
        else if (arguments.length === 2)
        {
            if (typeof arguments[1] === 'function')
                Utility.removeByProperty(handlers, 'method', arguments[1]);
            else
                Utility.removeByProperty(handlers, 'context', arguments[1]);
        }
        else
        {
            this.events[eventName] = undefined;
        }
    }

    function trigger()
    {
        if (!this.events)
            return;

        var handlers = this.events[arguments[0]];
        if (handlers && handlers.length)
        {
            Array.prototype.shift.call(arguments);
            for (var i = 0; i < handlers.length; i++)
            {
                var handler = handlers[i];
                handler.method.apply(handler.context, arguments);
            }
        }
    }

    function clearEvents()
    {
        this.events = null;
    }

    return {
        register: function (object)
        {
            object.on = on;
            object.off = off;
            object.clearEvents = clearEvents;
            object.trigger = trigger;
            return object;
        }
    };
});
define('engine/core/inputHandler', ['./events'], function (Events)
{
    'use strict';

    var handleInput = true;
    var isControlKey = {17: true, 91: true, 93: true, 224: true};

    var actions = {};
    var activeActions = {};
    var executedActions = {};

    var inputs = {};
    var activeInputs = {};
    var inputToActionMap = {};
    var elementIdToActionMap = {};


    function hasMovedEnough(event1, event2)
    {
        return Math.abs(event1.x - event2.x) + Math.abs(event1.y - event2.y) > 10;
    }

    function handleMoveEvent(e)
    {
        var id = (e.identifier != null) ? e.identifier : 'mouse';
        var activeInput = activeInputs[id];
        if (!activeInput)
            return;

        var initialEvent = activeInput.events[0];
        var currentEvent = activeInput.events[activeInput.events.length - 1];
        if (initialEvent.targetId !== currentEvent.targetId)
            return;

        if (activeInput.isDragging)
        {
            var previousEvent = activeInput.events[activeInput.events.length - 2];
            var deltaX = previousEvent.x - currentEvent.x;
            var deltaY = previousEvent.y - currentEvent.y;
            InputHandler.trigger('drag', e, deltaX, deltaY);
        }
        else if (hasMovedEnough(initialEvent, currentEvent))
        {
            activeInput.isDragging = true;
            InputHandler.trigger('dragBegin', e);
        }

        return true;
    }

    function handleMoveEndEvent(e)
    {
        var id = (e.identifier != null) ? e.identifier : 'mouse';
        var activeInput = activeInputs[id];
        if (!activeInput)
            return;

        var events = activeInput.events;
        if (events.length > 1 && events[0].targetId !== events[events.length - 1].targetId)
            return;

        if (activeInput.isDragging)
        {
            var currentEvent = events.pop();
            var previousEvent = events.pop();

            var deltaX = currentEvent.x - previousEvent.x;
            var deltaY = currentEvent.y - previousEvent.y;
            InputHandler.trigger('dragEnd', e, deltaX, deltaY);
        }
        else
        {
            InputHandler.trigger('click', e);
        }

        delete activeInputs[activeInput.id];
    }

    function handlePinchEvent(e, touch1, touch2)
    {
        var event1 = activeInputs[touch1.identifier];
        var event2 = activeInputs[touch2.identifier];

        // Make sure the inputs started at a close enough time
        var initialEvent1 = event1.events[0];
        var initialEvent2 = event2.events[0];
        if (Math.abs(initialEvent1.timestamp - initialEvent2.timestamp) > 250)
            return;

        var currentEvent1 = event1.events[event1.events.length - 1];
        var currentEvent2 = event2.events[event2.events.length - 1];

        var previousEvent1 = event1.events[event1.events.length - 2];
        var previousEvent2 = event2.events[event2.events.length - 2];

        var initialDifference = Math.abs(previousEvent1.x - previousEvent2.x) + Math.abs(previousEvent1.y - previousEvent2.y);
        var currentDifference = Math.abs(currentEvent1.x - currentEvent2.x) + Math.abs(currentEvent1.y - currentEvent2.y);

        var centerX = (currentEvent1.x + currentEvent2.x) / 2;
        var centerY = (currentEvent1.y + currentEvent2.y) / 2;

        var windowSize = document.body.offsetWidth + document.body.offsetHeight;
        var scale = 5 * (currentDifference - initialDifference) / windowSize;

        InputHandler.trigger('pinch', e, centerX, centerY, scale);
        return true;
    }

    function updateInputEvent(e)
    {
        var id = (e.identifier != null) ? e.identifier : 'mouse';
        var activeEvent = activeInputs[id];
        if (!activeEvent)
        {
            activeEvent = {id: id, events: []};
            activeInputs[id] = activeEvent;
        }

        activeEvent.events.push({targetId: e.target.id, timestamp: e.timeStamp, x: e.pageX, y: e.pageY});
        return activeEvent;
    }


    function onKeyDown(e)
    {
        if (handleInput)
        {
            var key = isControlKey[e.keyCode] ? InputHandler.Keys.Control : e.keyCode;
            inputs[key] = true;

            if (!activateActionByKey(inputToActionMap, key))
                InputHandler.trigger('keydown', e);
        }
    }

    function onKeyUp(e)
    {
        if (handleInput)
        {
            var key = isControlKey[e.keyCode] ? InputHandler.Keys.Control : e.keyCode;
            inputs[key] = false;

            if (!deactivateActionByKey(inputToActionMap, key))
                InputHandler.trigger('keyup', e);
        }
    }


    function onMouseDown(e)
    {
        if (handleInput && activateInput(e.target.id, e.button))
        {
            updateInputEvent(e);
            InputHandler.trigger('mousedown', e);
        }
    }

    function onMouseMove(e)
    {
        if (handleInput)
        {
            if (activeInputs.mouse)
            {
                updateInputEvent(e);
                handleMoveEvent(e);
            }

            InputHandler.trigger('mousemove', e);
        }
    }

    function onMouseUp(e)
    {
        if (handleInput)
        {
            handleMoveEndEvent(e);
            deactivateInput(e.target.id, e.button);
            InputHandler.trigger('mouseup', e);
        }
    }

    function onMouseWheel(e)
    {
        if (handleInput)
        {
            var delta = Utility.clamp(e.wheelDelta || -e.detail, -1, 1);
            InputHandler.trigger('mousewheel', e, delta * 0.15);
        }
    }


    function onTouchStart(e)
    {
        if (handleInput && e.changedTouches)
        {
            for (var i = 0; i < e.changedTouches.length; i++)
            {
                var touch = e.changedTouches[i];
                updateInputEvent(touch);
                activateInput(touch.target.id, InputHandler.Keys.MouseLeft);
            }
        }

        e.preventDefault();
    }

    function onTouchMove(e)
    {
        if (handleInput && e.touches)
        {
            for (var i = 0; i < e.touches.length; i++)
                updateInputEvent(e.touches[i]);

            var isHandled;
            if (e.touches.length === 1)
            {
                isHandled = handleMoveEvent(e.touches[0]);
            }
            else if (e.touches.length === 2)
            {
                isHandled = handlePinchEvent(e, e.touches[0], e.touches[1]);
            }

            if (!isHandled)
            {
                for (i = 0; i < e.touches.length; i++)
                {
                    var touch = e.touches[i];
                    var initialEvent = activeInputs[touch.identifier].events[0];

                    deactivateInput(initialEvent.targetId, InputHandler.Keys.MouseLeft);
                    activateInput(touch.target.id, InputHandler.Keys.MouseLeft);
                }
            }
        }

        e.preventDefault();
    }

    function onTouchEnd(e)
    {
        if (handleInput && e.changedTouches)
        {
            for (var i = 0; i < e.changedTouches.length; i++)
            {
                var touch = e.changedTouches[i];
                handleMoveEndEvent(touch);
                deactivateInput(touch.target.id, InputHandler.Keys.MouseLeft);
            }
        }

        e.preventDefault();
    }

    function onTouchCancel(e)
    {
        if (handleInput && e.changedTouches)
        {
            for (var i = 0; i < e.changedTouches.length; i++)
            {
                var touch = e.changedTouches[i];
                delete activeInputs[touch.identifier];
                deactivateInput(touch.target.id, InputHandler.Keys.MouseLeft);
            }
        }
    }


    function activateInput(elementId, key)
    {
        if (!activateActionByKey(elementIdToActionMap, elementId))
        {
            inputs[key] = true;
            activateActionByKey(inputToActionMap, key);
            return true;
        }
    }

    function activateActionByKey(map, key)
    {
        var actionNames = map[key];
        if (actionNames)
        {
            for (var i = 0; i < actionNames.length; i++)
                activateAction(actionNames[i]);

            return true;
        }

        return false;
    }

    function activateAction(actionName)
    {
        var action = actions[actionName];
        if (action)
        {
            activeActions[action.name] = true;
            if (!executedActions[action.name])
            {
                executedActions[action.name] = true;
                InputHandler.trigger(action.name);
            }
        }
    }


    function deactivateInput(elementId, key)
    {
        if (!deactivateActionByKey(elementIdToActionMap, elementId))
        {
            inputs[key] = false;
            deactivateActionByKey(inputToActionMap, key);
            return true;
        }
    }

    function deactivateActionByKey(map, key)
    {
        var actionNames = map[key];
        if (actionNames)
        {
            for (var i = 0; i < actionNames.length; i++)
                deactivateAction(actionNames[i]);

            return true;
        }

        return false;
    }

    function deactivateAction(actionName)
    {
        var action = actions[actionName];
        if (action)
        {
            activeActions[action.name] = false;
            executedActions[action.name] = false;
        }
    }


    function associateWithActionObject(action, actionProperty, object, map)
    {
        if (object)
        {
            if (action[actionProperty])
                action[actionProperty].push(object);
            else
                action[actionProperty] = [object];

            if (map)
            {
                if (map[object])
                    map[object].push(action.name);
                else
                    map[object] = [action.name];
            }
        }
    }

    function dissociateWithActionObject(action, actionProperty, object, map)
    {
        if (object != null)
        {
            if (action[actionProperty])
                Utility.remove(action[actionProperty], object);

            var actionNames = map[object];
            if (actionNames)
            {
                Utility.remove(actionNames, action.name);
                if (!actionNames.length)
                    map[object] = undefined;
            }
        }
    }


    function InputHandler() {}

    InputHandler.isTouchEnabled = ('ontouchstart' in window) || ('onmsgesturechange' in window);

    InputHandler.Keys = {
        MouseLeft: 0,
        MouseMiddle: 1,
        MouseRight: 2,

        Backspace: 8,
        Enter: 13,
        Shift: 16,
        Control: 17,
        Alt: 18,
        Escape: 27,
        Spacebar: 32,
        Left: 37,
        Up: 38,
        Right: 39,
        Down: 40,
        Delete: 46,
        Number0: 48,
        Number1: 49,
        Number2: 50,
        Number3: 51,
        Number4: 52,
        Number5: 53,
        Number6: 54,
        Number7: 55,
        Number8: 56,
        Number9: 57,
        A: 65,
        B: 66,
        C: 67,
        D: 68,
        E: 69,
        F: 70,
        G: 71,
        H: 72,
        I: 73,
        J: 74,
        K: 75,
        L: 76,
        M: 77,
        N: 78,
        O: 79,
        P: 80,
        Q: 81,
        R: 82,
        S: 83,
        T: 84,
        U: 85,
        V: 86,
        W: 87,
        X: 88,
        Y: 89,
        Z: 90,
        NumPad0: 96,
        NumPad1: 97,
        NumPad2: 98,
        NumPad3: 99,
        NumPad4: 100,
        NumPad5: 101,
        NumPad6: 102,
        NumPad7: 103,
        NumPad8: 104,
        NumPad9: 105,
        F1: 112,
        F2: 113,
        F3: 114,
        F4: 115,
        F5: 116,
        F6: 117,
        F7: 118,
        F8: 119,
        F9: 120,
        F10: 121,
        F11: 122,
        F12: 123,
        Tilde: 192
    };

    InputHandler.clearInput = function ()
    {
        inputs = {};
        activeActions = {};
        activeInputs = {};
        executedActions = {};
    };

    InputHandler.disableInput = function ()
    {
        handleInput = false;
    };

    InputHandler.enableInput = function ()
    {
        handleInput = true;
    };

    InputHandler.isActive = function (action)
    {
        return activeActions[action];
    };

    InputHandler.isKeyDown = function (key)
    {
        return inputs[key];
    };

    InputHandler.registerAction = function (actionObject, context, handler)
    {
        var name = actionObject.name;
        var action = actions[name];
        if (!action)
        { // Create the action
            action = {name: name};
            actions[name] = action;
        }

        associateWithActionObject(action, 'inputKeys', actionObject.key, inputToActionMap);
        associateWithActionObject(action, 'elementIds', actionObject.elementId, elementIdToActionMap);

        if (handler)
            InputHandler.on(name, context, handler);
    };

    InputHandler.unregisterAction = function (actionObject)
    {
        var action = actions[actionObject.name];
        if (action)
        {
            dissociateWithActionObject(action, 'inputKeys', actionObject.key, inputToActionMap);
            dissociateWithActionObject(action, 'elementIds', actionObject.elementId, elementIdToActionMap);

            // Get rid of the action if it's no longer used
            if ((!action.inputKeys || !action.inputKeys.length) && (!action.elementIds || !action.elementIds.length))
                actions[actionObject.name] = undefined;
        }
    };


    // Stop all of this stuff from happening
    var preventDefault = function (e) { e.preventDefault(); };
    var preventDefaultOnCanvas = function (e)
    {
        var tagName = e.target.tagName;
        if (tagName && tagName.toLowerCase() === 'canvas')
            e.preventDefault();
    };


    window.addEventListener('contextmenu', preventDefault, false);
    window.addEventListener('MSHoldVisual', preventDefault, false);
    window.addEventListener('ondragstart', preventDefault, false);
    window.addEventListener('ondrop', preventDefault, false);
    window.addEventListener('selectstart', preventDefaultOnCanvas, false);

    // Hook into  the necessary events
    window.addEventListener('keydown', onKeyDown, false);
    window.addEventListener('keyup', onKeyUp, false);
    window.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('mouseup', onMouseUp, false);
    window.addEventListener('blur', InputHandler.clearInput);

    // This should really be the 'wheel' event, but browser support is still odd around it
    window.addEventListener('mousewheel', onMouseWheel, false);
    window.addEventListener('DOMMouseScroll', onMouseWheel, false);

    if (InputHandler.isTouchEnabled)
    {
        window.addEventListener('touchstart', onTouchStart, false);
        window.addEventListener('touchmove', onTouchMove, false);
        window.addEventListener('touchend', onTouchEnd, false);
        window.addEventListener('touchcancel', onTouchCancel, false);

        document.body.msTouchAction = 'none';
        document.body.className += ' touch';
    }

    Events.register(InputHandler);
    return InputHandler;
});
define('editor/controls/popup', ['engine/core/events'], function (Events)
{
    'use strict';
    var activePopup;

    function Popup(items, displayName)
    {
        this.items = items;
        this.displayName = displayName;
    }

    Popup.prototype.close = function ()
    {
        document.body.removeChild(this.element);
        activePopup = null;
        this.trigger('close');
    };

    Popup.prototype.onClick = function (e)
    {
        var element = Utility.findParent(e.target, '.popup-item');
        var span = element.querySelector('span');
        if (span)
        {
            var value = span.innerHTML;
            if (value)
            {
                this.trigger('itemClick', value, this.items[value]);
                this.close();
            }
        }
    };

    Popup.prototype.show = function (x, y)
    {
        if (activePopup)
            activePopup.close();

        this.element = document.createElement('div');
        this.element.className = 'popup popup-menu';

        this.itemMap = [];
        for (var property in this.items)
        {
            if (!this.items.hasOwnProperty(property))
                continue;

            var itemElement = document.createElement('div');
            itemElement.className = 'popup-item';

            var textElement = document.createElement('span');
            textElement.appendChild(document.createTextNode(property));
            itemElement.appendChild(textElement);
            this.element.appendChild(itemElement);

            this.itemMap.push({itemName: property, itemObject: this.items[property], element: itemElement});
        }

        document.body.appendChild(this.element);

        var elementWidth = this.element.offsetWidth;
        var elementHeight = this.element.offsetHeight;
        var maxWidth = document.body.clientWidth;
        var maxHeight = document.body.clientHeight;

        this.left = x - elementWidth / 2;
        this.top = y + 16;

        this.element.style.top = Utility.clamp(this.top, 8, maxHeight - elementHeight - 8) + 'px';
        this.element.style.left = Utility.clamp(this.left, 8, maxWidth - elementWidth - 8) + 'px';
        this.element.style.maxWidth = maxWidth + 'px';
        this.element.style.maxHeight = maxHeight + 'px';
        this.element.addEventListener('click', this.onClick.bind(this), false);

        activePopup = this;
        return this;
    };

    window.addEventListener('mousedown', function (e)
    {
        if (activePopup && !Utility.findParent(e.target, '.popup'))
            activePopup.close();
    }, false);

    Events.register(Popup.prototype);
    return Popup;
});
define('editor/controls/propertiesSection', ['engine/core/events'], function (Events)
{
    'use strict';

    function validateRect(propertyItem, value)
    {
        var propertyValue = propertyItem.valueProperty;
        var currentValue = parseFloat(value);
        if (currentValue != value)
            currentValue = propertyValue.value;

        if (propertyValue.key === 'width' || propertyValue.key === 'height')
        {
            currentValue = Math.round(currentValue);
            if (currentValue < 1)
                currentValue = propertyValue.value;
        }

        return currentValue;
    }

    var defaultConfig = {
        exclude: {'typeName': true},
        position: {isRequired: true, isNumeric: true},
        rect: {isRequired: true, map: ['left', 'top', 'width', 'height'], validate: validateRect}
    };


    function PropertiesSection()
    {
        this.element = document.createElement('div');
        this.element.className = 'properties';
        this.element.addEventListener('change', this.onElementChanged.bind(this), false);

        this.properties = [];
        this.config = Utility.merge({}, defaultConfig);
    }

    PropertiesSection.prototype.addValues = function (obj)
    {
        var properties = this.getPropertiesFromObject(obj);

        var fragment = document.createDocumentFragment();
        for (var i = 0; i < properties.length; i++)
        {
            var propertyElement = document.createElement('div');
            propertyElement.className = 'property-element';

            var keyElement = document.createElement('input');
            keyElement.className = 'property-key';
            keyElement.type = 'text';

            var property = properties[i];
            keyElement.value = property.key;
            property.element = keyElement;

            var config = this.config[property.key];
            if (config)
                keyElement.disabled = config.isRequired;

            var valueElement = document.createElement('div');
            valueElement.className = 'property-value';

            var propertyCount = property.values.length;
            var width = Math.floor((140 - (propertyCount - 1)) / propertyCount) + 'px';
            for (var j = 0; j < propertyCount; j++)
            {
                var valueItem = document.createElement('input');
                valueItem.className = 'property-value-item';
                valueItem.type = 'text';
                valueItem.style.width = width;

                var propertyValue = property.values[j];
                valueItem.value = propertyValue.value;
                propertyValue.element = valueItem;
                valueElement.appendChild(valueItem);
            }

            propertyElement.appendChild(keyElement);
            propertyElement.appendChild(valueElement);
            fragment.appendChild(propertyElement);
        }

        this.element.appendChild(fragment);
        this.properties.push.apply(this.properties, properties);
    };

    PropertiesSection.prototype.constrainValue = function (propertyItem, value)
    {
        var config = this.config[propertyItem.property.key];
        if (config)
        {
            if (config.validate)
            {
                value = config.validate(propertyItem, value);
            }
            else if (config.isNumeric)
            {
                value = parseFloat(value);
                if (value == null || !isFinite(value))
                    value = propertyItem.valueProperty.value;

                if (config.minValue)
                    value = Math.max(value, config.minValue);

                if (config.maxValue)
                    value = Math.min(value, config.maxValue);
            }
        }
        else
        {
            var numericValue = parseFloat(value);
            if (numericValue == value)
                value = numericValue;
        }

        return value;
    };

    PropertiesSection.prototype.getPropertyForElement = function (element)
    {
        for (var i = 0; i < this.properties.length; i++)
        {
            var property = this.properties[i];
            if (property.element === element)
                return {property: property};

            var valueProperty = Utility.findByProperty(property.values, 'element', element);
            if (valueProperty)
                return {property: property, valueProperty: valueProperty};
        }
    };

    PropertiesSection.prototype.getPropertiesFromObject = function (data)
    {
        var properties = [];
        for (var property in data)
        {
            if (!data.hasOwnProperty(property))
                continue;

            if (this.config.exclude && this.config.exclude[property])
                continue;

            var obj = {key: property, values: []};
            properties.push(obj);

            var value = data[property];
            if (typeof value === 'object')
            {
                var map;
                if (this.config[property])
                    map = this.config[property].map;

                if (map)
                {
                    for (var i = 0; i < map.length; i++)
                        obj.values.push({key: map[i], value: value[map[i]]});
                }
                else
                {
                    for (var valueProperty in value)
                    {
                        if (value.hasOwnProperty(valueProperty))
                            obj.values.push({key: valueProperty, value: value[valueProperty]});
                    }
                }
            }
            else
            {
                obj.values.push({value: value});
            }
        }

        return properties;
    };

    PropertiesSection.prototype.onElementChanged = function (e)
    {
        var propertyItem = this.getPropertyForElement(e.target);
        if (!propertyItem)
            return;

        var currentValue, previousValue;
        if (propertyItem.valueProperty)
        {
            currentValue = this.constrainValue(propertyItem, e.target.value);
            previousValue = propertyItem.valueProperty.value;
            propertyItem.valueProperty.value = currentValue;
        }
        else
        {
            currentValue = e.target.value.replace(' ', '');
            previousValue = propertyItem.property.key;

            if (currentValue)
            {
                propertyItem.property.key = currentValue;
            }
            else
            {
                Utility.remove(this.properties, propertyItem.property);
                this.element.removeChild(Utility.findParent(e.target, '.property-element'));
            }
        }

        if (previousValue !== currentValue)
        {
            this.trigger('propertyChange', propertyItem.property, propertyItem.valueProperty);
            e.target.value = currentValue;

            if (propertyItem.valueProperty)
            {
                if (propertyItem.valueProperty.key)
                    this.object[propertyItem.property.key][propertyItem.valueProperty.key] = currentValue;
                else
                    this.object[propertyItem.property.key] = currentValue;
            }
            else
            {
                var value = this.object[previousValue];
                delete this.object[previousValue];

                if (currentValue)
                    this.object[currentValue] = value;
            }

            if (this.object.onPropertyChanged)
                this.object.onPropertyChanged(propertyItem.property, propertyItem.valueProperty);
        }

        e.stopPropagation();
    };


    PropertiesSection.prototype.addNewProperty = function ()
    {// TODO: Find new, unique property key
        this.object.key = 'value';
        this.addValues({key: 'value'});
    };

    PropertiesSection.prototype.clear = function ()
    {
        this.properties.length = 0;
        while (this.element.firstChild)
            this.element.removeChild(this.element.firstChild);
    };

    PropertiesSection.prototype.setConfig = function (options)
    {
        this.config = Utility.merge({}, defaultConfig, options);
    };

    PropertiesSection.prototype.setObject = function (obj)
    {
        this.clear();
        this.object = obj;
        this.addValues(obj);
    };

    PropertiesSection.prototype.update = function ()
    {
        for (var i = 0; i < this.properties.length; i++)
        {
            var property = this.properties[i];
            var value = this.object[property.key];

            for (var j = 0; j < property.values.length; j++)
            {
                var valueObj = property.values[j];
                valueObj.element.value = (valueObj.key) ? value[valueObj.key] : value;
            }
        }
    };


    Events.register(PropertiesSection.prototype);
    return PropertiesSection;
});
define('engine/media/spriteSheet', ['../core/events'], function (Events)
{
    'use strict';

    var defaults = {
        speed: 0.0167,
        tileWidth: 64,
        tileHeight: 64
    };

    function SpriteSheet(properties)
    {
        this.animations = [];
        this.currentTile = 0;
        Utility.merge(this, defaults, properties);
    }

    SpriteSheet.prototype.defineAnimation = function (name, properties)
    {
        if (!properties.frames)
            properties.frames = {};

        properties.name = name;
        this.animations[name] = properties;
    };

    SpriteSheet.prototype.getCurrentTileBounds = function ()
    {
        if (!this.currentTileBounds)
            this.currentTileBounds = this.getTileBounds(this.currentTile);

        return this.currentTileBounds;
    };

    SpriteSheet.prototype.getTile = function (x, y)
    {
        if (this.image.isLoaded)
            return x + y * Math.floor(this.image.width / this.tileWidth);
    };

    SpriteSheet.prototype.getTileByPosition = function (xPosition, yPosition)
    {
        if (this.image.isLoaded)
        {
            var tilesPerRow = Math.floor(this.image.width / this.tileWidth);
            var xIndex = Math.floor(xPosition / this.tileWidth);
            var yIndex = Math.floor(yPosition / this.tileWidth);
            return xIndex + yIndex * tilesPerRow;
        }
    };

    SpriteSheet.prototype.getTileBounds = function (tileIndex)
    {
        if (this.image.isLoaded)
        {
            var tilesPerRow = Math.floor(this.image.width / this.tileWidth);
            var horizontalOffset = (tileIndex % tilesPerRow) * this.tileWidth;
            var verticalOffset = Math.floor(tileIndex / tilesPerRow) * this.tileHeight;

            return {
                x: horizontalOffset,
                y: verticalOffset,
                width: this.tileWidth,
                height: this.tileHeight
            };
        }
    };

    SpriteSheet.prototype.isLoaded = function ()
    {
        return this.image && this.image.isLoaded;
    };

    SpriteSheet.prototype.playAnimation = function (name, isReversed)
    {
        this.currentAnimation = this.animations[name];
        this.currentAnimation.isComplete = false;
        this.currentAnimation.isReversed = (isReversed === true);
        this.animationTime = 0;

        if (isReversed)
            this.setCurrentTile(this.currentAnimation.end);
        else
            this.setCurrentTile(this.currentAnimation.start);
    };

    SpriteSheet.prototype.setCurrentTile = function (index)
    {
        if (this.currentTile !== index)
        {
            this.currentTile = index;
            this.currentTileBounds = null;
        }
    };

    SpriteSheet.prototype.setImage = function (image)
    {
        this.image = image;
    };

    SpriteSheet.prototype.updateAnimation = function (deltaTime)
    {
        if (!this.currentAnimation || this.currentAnimation.isComplete)
            return;

        var frameTime = 0;
        this.animationTime += deltaTime;

        var startFrame, endFrame, direction;
        if (this.currentAnimation.isReversed)
        {
            startFrame = this.currentAnimation.end;
            endFrame = this.currentAnimation.start - 1;
            direction = -1;
        }
        else
        {
            startFrame = this.currentAnimation.start;
            endFrame = this.currentAnimation.end + 1;
            direction = 1;
        }

        var frame = startFrame;
        while (frame !== endFrame)
        {
            if (this.currentAnimation.frames[frame] != null)
                frameTime += this.currentAnimation.frames[frame];
            else
                frameTime += this.currentAnimation.speed;

            if (this.animationTime < frameTime)
            {
                this.setCurrentTile(frame);
                return;
            }

            frame += direction;
        }

        if (this.currentAnimation.reverseOnComplete && !this.currentAnimation.isReversed)
        {
            this.animationTime -= frameTime;
            this.currentAnimation.isReversed = true;
            this.setCurrentTile(this.currentAnimation.end);
        }
        else if (this.currentAnimation.isLooping)
        {
            this.animationTime -= frameTime;
            this.currentAnimation.isReversed = false;
            this.setCurrentTile(this.currentAnimation.start);
        }
        else
        {
            this.currentAnimation.isComplete = true;
            this.trigger('animationComplete', this.currentAnimation);
        }
    };

    Events.register(SpriteSheet.prototype);
    return SpriteSheet;
});
define('engine/spatial/tileMap', [], function ()
{
    'use strict';
    function TileMap(width, height, tileSize, ArrayType)
    {
        this.xOffset = 0;
        this.yOffset = 0;
        this.width = width;
        this.height = height;
        this.tileSize = tileSize;

        if (!ArrayType)
            ArrayType = Uint8Array;

        this.tiles = new ArrayType(new ArrayBuffer(width * height));
    }

    TileMap.prototype.getTile = function (x, y)
    {
        return this.tiles[x + y * this.width];
    };

    TileMap.prototype.getTileAtIndex = function (i)
    {
        return this.tiles[i];
    };

    TileMap.prototype.getTileAtPosition = function (x, y)
    {
        x = Math.floor(x / this.tileSize);
        y = Math.floor(y / this.tileSize);

        return this.tiles[x + y * this.width];
    };

    TileMap.prototype.isInBounds = function (x, y)
    {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    };

    TileMap.prototype.setTile = function (x, y, value)
    {
        this.tiles[x + y * this.width] = value;
    };

    TileMap.prototype.setTileAtIndex = function (i, value)
    {
        this.tiles[i] = value;
    };

    TileMap.prototype.setTileAtPosition = function (x, y, value)
    {
        x = Math.floor(x / this.tileSize);
        y = Math.floor(y / this.tileSize);

        this.tiles[x + y * this.width] = value;
    };

    return TileMap;
});
define('engine/data/webStorage', ['../core/events'], function (Events)
{
    'use strict';

    var saveIntervalId;

    function WebStorage() { }

    WebStorage.setSaveInterval = function (interval)
    {
        if (saveIntervalId)
            clearInterval(saveIntervalId);

        saveIntervalId = setInterval(function ()
        {
            WebStorage.trigger('save');
        }, interval * 1000);
    };


    WebStorage.getData = function (key)
    {
        if (window.localStorage)
        {
            var value = window.localStorage.getItem(key);
            if (value)
                return JSON.parse(value);
        }
    };

    WebStorage.deleteData = function ()
    {
        if (window.localStorage)
        {
            for (var i = 0; i < arguments.length; i++)
                window.localStorage.removeItem(arguments[i]);
        }
    };

    WebStorage.hasData = function ()
    {
        if (!window.localStorage)
            return false;

        for (var i = 0; i < arguments.length; i++)
        {
            if (!window.localStorage.getItem(arguments[i]))
                return false;
        }

        return true;
    };

    WebStorage.setData = function (key, value)
    {
        if (window.localStorage)
        {
            try
            {
                window.localStorage.setItem(key, JSON.stringify(value));
            }
            catch (e)
            {
            }
        }
    };


    if (window.localStorage)
    {
        window.addEventListener('beforeunload', function ()
        {
            WebStorage.trigger('save');
        }, false);
    }

    Events.register(WebStorage);
    return WebStorage;
});
/**
 * @license RequireJS text 2.0.9 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/text for details
 */
/*jslint regexp: true */
/*global require, XMLHttpRequest, ActiveXObject,
 define, window, process, Packages,
 java, location, Components, FileUtils */

define('text', ['module'], function (module)
{
    'use strict';

    var text, fs, Cc, Ci, xpcIsWindows,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = {},
        masterConfig = (module.config && module.config()) || {};

    text = {
        version: '2.0.9',

        strip: function (content)
        {
            //Strips <?xml ...?> declarations so that external SVG and XML
            //documents can be added to a document without worry. Also, if the string
            //is an HTML document, only the part inside the body tag is returned.
            if (content)
            {
                content = content.replace(xmlRegExp, "");
                var matches = content.match(bodyRegExp);
                if (matches)
                {
                    content = matches[1];
                }
            }
            else
            {
                content = "";
            }
            return content;
        },

        jsEscape: function (content)
        {
            return content.replace(/(['\\])/g, '\\$1')
                .replace(/[\f]/g, "\\f")
                .replace(/[\b]/g, "\\b")
                .replace(/[\n]/g, "\\n")
                .replace(/[\t]/g, "\\t")
                .replace(/[\r]/g, "\\r")
                .replace(/[\u2028]/g, "\\u2028")
                .replace(/[\u2029]/g, "\\u2029");
        },

        createXhr: masterConfig.createXhr || function ()
        {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined")
            {
                return new XMLHttpRequest();
            }
            else if (typeof ActiveXObject !== "undefined")
            {
                for (i = 0; i < 3; i += 1)
                {
                    progId = progIds[i];
                    try
                    {
                        xhr = new ActiveXObject(progId);
                    }
                    catch (e)
                    {
                    }

                    if (xhr)
                    {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        /**
         * Parses a resource name into its component parts. Resource names
         * look like: module/name.ext!strip, where the !strip part is
         * optional.
         * @param {String} name the resource name
         * @returns {Object} with properties "moduleName", "ext" and "strip"
         * where strip is a boolean.
         */
        parseName: function (name)
        {
            var modName, ext, temp,
                strip = false,
                index = name.indexOf("."),
                isRelative = name.indexOf('./') === 0 ||
                             name.indexOf('../') === 0;

            if (index !== -1 && (!isRelative || index > 1))
            {
                modName = name.substring(0, index);
                ext = name.substring(index + 1, name.length);
            }
            else
            {
                modName = name;
            }

            temp = ext || modName;
            index = temp.indexOf("!");
            if (index !== -1)
            {
                //Pull off the strip arg.
                strip = temp.substring(index + 1) === "strip";
                temp = temp.substring(0, index);
                if (ext)
                {
                    ext = temp;
                }
                else
                {
                    modName = temp;
                }
            }

            return {
                moduleName: modName,
                ext: ext,
                strip: strip
            };
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port)
        {
            var uProtocol, uHostName, uPort,
                match = text.xdRegExp.exec(url);
            if (!match)
            {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                   (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
                   ((!uPort && !uHostName) || uPort === port);
        },

        finishLoad: function (name, strip, content, onLoad)
        {
            content = strip ? text.strip(content) : content;
            if (masterConfig.isBuild)
            {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config)
        {
            //Name has format: some.module.filext!strip
            //The strip part is optional.
            //if strip is present, then that means only get the string contents
            //inside a body tag in an HTML string. For XML/SVG content it means
            //removing the <?xml ...?> declarations so the content can be inserted
            //into the current doc without problems.

            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config.isBuild && !config.inlineText)
            {
                onLoad();
                return;
            }

            masterConfig.isBuild = config.isBuild;

            var parsed = text.parseName(name),
                nonStripName = parsed.moduleName +
                               (parsed.ext ? '.' + parsed.ext : ''),
                url = req.toUrl(nonStripName),
                useXhr = (masterConfig.useXhr) ||
                         text.useXhr;

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort))
            {
                text.get(url, function (content)
                {
                    text.finishLoad(name, parsed.strip, content, onLoad);
                }, function (err)
                {
                    if (onLoad.error)
                    {
                        onLoad.error(err);
                    }
                });
            }
            else
            {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension, but do not include the
                //!strip part to avoid file system issues.
                req([nonStripName], function (content)
                {
                    text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                        parsed.strip, content, onLoad);
                });
            }
        },

        write: function (pluginName, moduleName, write, config)
        {
            if (buildMap.hasOwnProperty(moduleName))
            {
                var content = text.jsEscape(buildMap[moduleName]);
                write.asModule(pluginName + "!" + moduleName,
                        "define(function () { return '" +
                        content +
                        "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config)
        {
            var parsed = text.parseName(moduleName),
                extPart = parsed.ext ? '.' + parsed.ext : '',
                nonStripName = parsed.moduleName + extPart,
            //Use a '.js' file name so that it indicates it is a
            //script that can be loaded across domains.
                fileName = req.toUrl(parsed.moduleName + extPart) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            text.load(nonStripName, req, function (value)
            {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents)
                {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents)
                {
                    return write.asModule(moduleName, fileName, contents);
                };

                text.write(pluginName, nonStripName, textWrite, config);
            }, config);
        }
    };

    if (masterConfig.env === 'node' || (!masterConfig.env &&
                                        typeof process !== "undefined" &&
                                        process.versions && !!process.versions.node && !process.versions['node-webkit']))
    {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        text.get = function (url, callback, errback)
        {
            try
            {
                var file = fs.readFileSync(url, 'utf8');
                //Remove BOM (Byte Mark Order) from utf8 files if it is there.
                if (file.indexOf('\uFEFF') === 0)
                {
                    file = file.substring(1);
                }
                callback(file);
            }
            catch (e)
            {
                errback(e);
            }
        };
    }
    else if (masterConfig.env === 'xhr' || (!masterConfig.env &&
                                            text.createXhr()))
    {
        text.get = function (url, callback, errback, headers)
        {
            var xhr = text.createXhr(), header;
            xhr.open('GET', url, true);

            //Allow plugins direct access to xhr headers
            if (headers)
            {
                for (header in headers)
                {
                    if (headers.hasOwnProperty(header))
                    {
                        xhr.setRequestHeader(header.toLowerCase(), headers[header]);
                    }
                }
            }

            //Allow overrides specified in config
            if (masterConfig.onXhr)
            {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt)
            {
                var status, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4)
                {
                    status = xhr.status;
                    if (status > 399 && status < 600)
                    {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        errback(err);
                    }
                    else
                    {
                        callback(xhr.responseText);
                    }

                    if (masterConfig.onXhrComplete)
                    {
                        masterConfig.onXhrComplete(xhr, url);
                    }
                }
            };
            xhr.send(null);
        };
    }
    else if (masterConfig.env === 'rhino' || (!masterConfig.env &&
                                              typeof Packages !== 'undefined' && typeof java !== 'undefined'))
    {
        //Why Java, why is this so awkward?
        text.get = function (url, callback)
        {
            var stringBuffer, line,
                encoding = "utf-8",
                file = new java.io.File(url),
                lineSeparator = java.lang.System.getProperty("line.separator"),
                input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                content = '';
            try
            {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();

                // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                // http://www.unicode.org/faq/utf_bom.html

                // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                if (line && line.length() && line.charAt(0) === 0xfeff)
                {
                    // Eat the BOM, since we've already found the encoding on this file,
                    // and we plan to concatenating this buffer with others; the BOM should
                    // only appear at the top of a file.
                    line = line.substring(1);
                }

                if (line !== null)
                {
                    stringBuffer.append(line);
                }

                while ((line = input.readLine()) !== null)
                {
                    stringBuffer.append(lineSeparator);
                    stringBuffer.append(line);
                }
                //Make sure we return a JavaScript string and not a Java string.
                content = String(stringBuffer.toString()); //String
            }
            finally
            {
                input.close();
            }
            callback(content);
        };
    }
    else if (masterConfig.env === 'xpconnect' || (!masterConfig.env &&
                                                  typeof Components !== 'undefined' && Components.classes &&
                                                  Components.interfaces))
    {
        //Avert your gaze!
        Cc = Components.classes,
            Ci = Components.interfaces;
        Components.utils['import']('resource://gre/modules/FileUtils.jsm');
        xpcIsWindows = ('@mozilla.org/windows-registry-key;1' in Cc);

        text.get = function (url, callback)
        {
            var inStream, convertStream, fileObj,
                readData = {};

            if (xpcIsWindows)
            {
                url = url.replace(/\//g, '\\');
            }

            fileObj = new FileUtils.File(url);

            //XPCOM, you so crazy
            try
            {
                inStream = Cc['@mozilla.org/network/file-input-stream;1']
                    .createInstance(Ci.nsIFileInputStream);
                inStream.init(fileObj, 1, 0, false);

                convertStream = Cc['@mozilla.org/intl/converter-input-stream;1']
                    .createInstance(Ci.nsIConverterInputStream);
                convertStream.init(inStream, "utf-8", inStream.available(),
                    Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

                convertStream.readString(inStream.available(), readData);
                convertStream.close();
                inStream.close();
                callback(readData.value);
            }
            catch (e)
            {
                throw new Error((fileObj && fileObj.path || '') + ': ' + e);
            }
        };
    }
    return text;
});

define('text!editor/templates/mainPanel.html', [], function () { return '<div class="main-panel">\r\n    <div data-name="level-panel">\r\n        <div class="header">\r\n            <label>Level</label>\r\n            <div class="header-button-panel">\r\n                <div class="icon add-icon" title="Add property"></div>\r\n            </div>\r\n        </div>\r\n        <div class="contents">\r\n            <input data-name="saveFileName" type="text" placeholder="File name"/>\r\n            <button data-name="new">New</button>\r\n            <button data-name="save">Save</button>\r\n            <input type="file" data-name="load"/>\r\n        </div>\r\n    </div>\r\n    <div data-name="grid-panel">\r\n        <div class="header">\r\n            <label>Grid</label>\r\n            <div class="header-button-panel">\r\n                <div class="icon visibility-icon" title="Toggle grid visibility"></div>\r\n            </div>\r\n        </div>\r\n        <div class="contents"></div>\r\n    </div>\r\n    <div data-name="layer-panel">\r\n        <div class="header">\r\n            <label>Layers</label>\r\n            <div class="header-button-panel">\r\n                <div class="icon up-icon" title="Move layer up"></div>\r\n                <div class="icon down-icon" title="Move layer down"></div>\r\n                <div class="icon add-icon" title="Add layer"></div>\r\n            </div>\r\n        </div>\r\n        <div class="layer-item-panel"></div>\r\n    </div>\r\n    <div class="properties-panel"></div>\r\n</div>';});

define('text!editor/templates/layer.html', [], function () { return '<div class="layer">\r\n    <div class="icon visibility-icon visible" title="Toggle layer visibility"></div>\r\n    <div class="layer-title-container">\r\n        <input type="text"/>\r\n    </div>\r\n    <div class="icon remove-icon" title="Remove layer"></div>\r\n</div>';});

define('editor/core/mainPanel', ['Editor', 'text!../templates/mainPanel.html', 'text!../templates/layer.html'], function (Editor, Template, LayerTemplate)
{
    'use strict';
    function MainPanel()
    {
        var grid = {isVisible: false, rect: new Rectangle(0, 0, 64, 64), tileSize: 64};
        Editor.getGridSettings = function () { return grid; };
        this.grid = grid;
        this.layers = [];

        document.body.insertAdjacentHTML('beforeend', Template);
        this.element = document.body.querySelector('.main-panel');

        this.layerItemPanel = this.element.querySelector('.layer-item-panel');
        this.propertiesPanel = this.element.querySelector('.properties-panel');

        this.properties = {};
        this.propertiesSection = new Editor.PropertiesSection();
        this.propertiesSection.setObject(this.properties);

        this.initialize();
    }

    MainPanel.prototype.initialize = function ()
    {
        this.element.addEventListener('click', this.onClick.bind(this));

        var levelPanel = this.element.querySelector('[data-name="level-panel"');
        levelPanel.on('click', '[data-name="new"]', this.clear.bind(this));
        levelPanel.on('change', '[data-name="load"]', this.onLoad.bind(this));
        levelPanel.on('click', '[data-name="save"]', this.onSave.bind(this));
        levelPanel.on('click', '.add-icon', this.propertiesSection.addNewProperty.bind(this.propertiesSection));
        levelPanel.querySelector('.contents').appendChild(this.propertiesSection.element);

        var layerPanel = this.element.querySelector('[data-name="layer-panel"');
        layerPanel.on('click', '.add-icon', this.onAddLayer.bind(this));
        layerPanel.on('click', '.up-icon', this.onMoveLayerUp.bind(this));
        layerPanel.on('click', '.down-icon', this.onMoveLayerDown.bind(this));

        var gridPanel = this.element.querySelector('[data-name="grid-panel"');
        gridPanel.on('click', '.visibility-icon', this.onToggleGridVisibility.bind(this));

        var gridPropertiesSection = new Editor.PropertiesSection();
        gridPropertiesSection.setConfig({exclude: {isVisible: true}, tileSize: {isRequired: true, minValue: 1}});
        gridPropertiesSection.setObject(this.grid);
        gridPanel.querySelector('.contents').appendChild(gridPropertiesSection.element);
    };


    MainPanel.prototype.onAddLayer = function (e)
    {
        var layerTypes = Editor.Plugins.layerTypes;
        if (!layerTypes || Utility.isObjectEmpty(layerTypes))
            return;

        this.popup = new Editor.Popup(layerTypes).show(e.pageX, e.pageY);
        this.popup.on('close', this, function () { this.popup = null; }.bind(this));
        this.popup.on('itemClick', this, function (key, layerType)
        {
            this.createLayerFromType(key, layerType);
        }.bind(this));
    };

    MainPanel.prototype.onMoveLayerUp = function ()
    {
        if (this.layers.length > 1)
        {
            var index = this.layers.indexOf(this.selectedLayer);
            if (index > 0)
            {
                this.layers.splice(index - 1, 0, this.layers.splice(index, 1)[0]);
                this.layerItemPanel.insertBefore(this.selectedLayer.element, this.selectedLayer.element.previousSibling);
            }
        }
    };

    MainPanel.prototype.onMoveLayerDown = function ()
    {
        if (this.layers.length > 1)
        {
            var index = this.layers.indexOf(this.selectedLayer);
            if (index < this.layers.length - 1)
            {
                this.layers.splice(index + 1, 0, this.layers.splice(index, 1)[0]);
                this.layerItemPanel.insertBefore(this.selectedLayer.element.nextSibling, this.selectedLayer.element);
            }
        }
    };


    MainPanel.prototype.createLayer = function (layer, name)
    {
        if (!name)
        { // Find a unique layer name
            var layerNames = {};
            for (var i = 0; i < this.layers.length; i++)
                layerNames[this.layers[i].name] = true;

            var number = 1;
            while (layerNames['Layer ' + number])
                number++;

            name = 'Layer ' + number;
        }

        // Create the new layer
        var layerObject = {
            name: name,
            object: layer,
            element: Utility.getElementFromTemplate(LayerTemplate, this.layerItemPanel),
            isVisible: (layer.isVisible != null) ? layer.isVisible : true
        };

        layerObject.title = layerObject.element.querySelector('input');
        layerObject.title.value = layerObject.name;
        layerObject.title.addEventListener('change', this.onLayerNameChanged.bind(this), false);

        this.layers.push(layerObject);
        if (!this.selectedLayer)
            this.selectLayer(layerObject);

        layerObject.title.focus();
    };

    MainPanel.prototype.createLayerFromType = function (key, LayerType)
    {
        var layer = new LayerType();
        layer.type = key;
        this.createLayer(layer);
    };

    MainPanel.prototype.removeLayer = function (layer)
    {
        this.layerItemPanel.removeChild(layer.element);
        Utility.remove(this.layers, layer);

        if (this.selectedLayer === layer)
            this.selectLayer(this.layers[0]);
    };

    MainPanel.prototype.selectLayer = function (layer)
    {
        if (this.selectedLayer === layer)
            return;

        if (this.selectedLayer)
        {
            this.selectedLayer.object.isSelected = false;
            this.selectedLayer.element.classList.remove('selected');
            if (this.selectedLayer.object.onDeselected)
                this.selectedLayer.object.onDeselected();
        }

        this.selectedLayer = layer;
        while (this.propertiesPanel.firstChild)
            this.propertiesPanel.removeChild(this.propertiesPanel.firstChild);

        if (this.selectedLayer)
        {
            this.selectedLayer.object.isSelected = true;
            this.selectedLayer.element.classList.add('selected');

            if (this.selectedLayer.object.getPanel)
            {
                var panel = this.selectedLayer.object.getPanel();
                if (panel)
                    Utility.appendElements(this.propertiesPanel, panel);
            }

            if (this.selectedLayer.object.onSelected)
                this.selectedLayer.object.onSelected();
        }
    };

    MainPanel.prototype.onLayerNameChanged = function (e)
    {
        var name = e.target.value;
        var currentLayer, isConflicting;

        for (var i = 0; i < this.layers.length; i++)
        {
            var layer = this.layers[i];
            if (layer.title === e.target)
                currentLayer = layer;
            else if (layer.name === name)
                isConflicting = true;
        }

        if (isConflicting)
            e.target.value = currentLayer.name;
        else
            currentLayer.name = name;
    };

    MainPanel.prototype.onToggleGridVisibility = function (e)
    {
        toggleVisibility(this.grid, e.target);
    };


    MainPanel.prototype.clear = function ()
    {
        this.layers.length = 0;
        this.selectLayer(null);
        this.propertiesSection.clear();

        while (this.layerItemPanel.firstChild)
            this.layerItemPanel.removeChild(this.layerItemPanel.firstChild);
    };

    MainPanel.prototype.loadData = function (fileName, data)
    {
        this.clear();
        var fileNameElement = this.element.querySelector('[data-name="saveFileName"]');
        fileNameElement.value = fileName.substr(0, fileName.lastIndexOf('.'));

        if (data.properties)
        {
            this.properties = data.properties;
            this.propertiesSection.setObject(this.properties);
        }

        if (data.layers)
        {
            var layerData;
            var layers = [];
            for (var layerName in data.layers)
            {
                layerData = data.layers[layerName];
                layerData.name = layerName;
                layers.push(layerData);
            }

            layers.sort(function (layer1, layer2)
            {
                return layer1.index - layer2.index;
            });

            for (var i = 0; i < layers.length; i++)
            {
                layerData = layers[i];
                var LayerType = Editor.Plugins.layerTypes[layerData.type];
                if (LayerType)
                {
                    var newLayer = new LayerType();
                    newLayer.index = layerData.index;
                    newLayer.type = layerData.type;
                    newLayer.deserialize(layerData);
                    this.createLayer(newLayer, layerData.name);
                }
                else
                {
                    console.log(layerData.type + ' could not be loaded');
                }
            }
        }
    };

    MainPanel.prototype.serializeData = function ()
    {
        var data = {layers: {}};
        data.fileName = this.element.querySelector('[data-name="saveFileName"]').value || 'level';

        if (!Utility.isObjectEmpty(this.properties))
            data.properties = this.properties;

        for (var i = 0; i < this.layers.length; i++)
        {
            var layer = this.layers[i];
            var layerData = layer.object.serialize();
            layerData.index = i;
            layerData.type = layer.object.type;
            data.layers[layer.title.value] = layerData;
        }

        return data;
    };


    MainPanel.prototype.onClick = function (e)
    {
        var layerElement = Utility.findParent(e.target, '.layer');
        if (layerElement)
        {
            var layer = Utility.findByProperty(this.layers, 'element', layerElement);
            if (e.target.matches('.remove-icon'))
            {
                this.removeLayer(layer);
            }
            else
            {
                this.selectLayer(layer);
                if (e.target.matches('.visibility-icon'))
                    toggleVisibility(layer, e.target);
            }
        }

        e.stopPropagation();
    };

    MainPanel.prototype.onLoad = function (e)
    {
        Editor.FileHandler.loadJSON(e.target.files[0], function (fileName, data)
        {
            if (Editor.Plugins.onLoad)
                Editor.Plugins.onLoad(data);

            this.loadData(fileName, data);
        }.bind(this));
    };

    MainPanel.prototype.onSave = function (e)
    {
        var data = this.serializeData();
        if (!Utility.isObjectEmpty(this.properties))
            data.properties = this.properties;

        for (var i = 0; i < this.layers.length; i++)
        {
            var layer = this.layers[i];
            var layerData = layer.object.serialize();
            layerData.index = i;
            layerData.type = layer.object.type;
            data.layers[layer.title.value] = layerData;
        }

        var fileName = data.fileName;
        delete data.fileName;

        if (Editor.Plugins.onSave)
            Editor.Plugins.onSave(data);

        Editor.FileHandler.saveJSON(fileName + '.json', JSON.stringify(data));
        e.stopPropagation();
    };


    function toggleVisibility(object, element)
    {
        object.isVisible = !object.isVisible;
        if (object.isVisible)
            element.classList.add('visible');
        else
            element.classList.remove('visible');
    }

    return MainPanel;
});
define('editor/core/editorInterface', ['Editor', './mainPanel'], function (Editor, MainPanel)
{
    'use strict';
    function EditorInterface()
    {
        Editor.Scheduler.schedule({context: this, method: this.draw, priority: Editor.Scheduler.priority.render});
        Editor.Scheduler.schedule({context: this, method: this.update});

        Editor.InputHandler.on('mousedown', this, this.forwardEvent.bind(this, 'onMouseDown'));
        Editor.InputHandler.on('mousemove', this, this.forwardEvent.bind(this, 'onMouseMove'));
        Editor.InputHandler.on('mouseup', this, this.forwardEvent.bind(this, 'onMouseUp'));
        Editor.InputHandler.on('click', this, this.forwardEvent.bind(this, 'onClick'));
        Editor.InputHandler.on('keydown', this, this.forwardEvent.bind(this, 'onKeyDown'));
        Editor.InputHandler.on('keyup', this, this.forwardEvent.bind(this, 'onKeyUp'));

        Editor.InputHandler.on('dragBegin', this, this.forwardEvent.bind(this, 'onDragBegin'));
        Editor.InputHandler.on('drag', this.onDrag.bind(this));
        Editor.InputHandler.on('dragEnd', this.forwardEvent.bind(this, 'onDragEnd'));
        Editor.InputHandler.on('pinch', this.onPinch.bind(this));
        Editor.InputHandler.on('mousewheel', this.onMouseWheel.bind(this));

        Editor.WebStorage.on('save', this, this.onExit);

        this.mainPanel = new MainPanel();
        this.loadResources(); // TODO: Should this be moved elsewhere?
    }

    function isEventOnCanvas(e)
    {
        return e.target.tagName && e.target.tagName.toLowerCase() === 'canvas';
    }

    EditorInterface.prototype.onExit = function ()
    {
        Editor.WebStorage.setData('levelData', this.mainPanel.serializeData());
    };

    EditorInterface.prototype.onLoaded = function (viewport)
    {
        this.viewport = viewport;

        var data = Editor.WebStorage.getData('levelData');
        if (data)
        {
            this.mainPanel.loadData(data.fileName, data);
        }
    };

    EditorInterface.prototype.update = function (e, deltaTime)
    {
        this.viewport.update(deltaTime);
    };

    EditorInterface.prototype.draw = function (e, deltaTime)
    {
        for (var i = this.mainPanel.layers.length - 1; i >= 0; i--)
        {
            var layer = this.mainPanel.layers[i];
            if (layer.isVisible && layer.object.draw)
                layer.object.draw(this.viewport, deltaTime);
        }

        var grid = this.mainPanel.grid;
        if (grid.isVisible)
        {
            this.viewport.context.lineWidth = 0.5;
            this.viewport.context.strokeStyle = 'blue';
            this.viewport.renderer.drawGrid(this.viewport, grid.rect, grid.tileSize);
        }
    };


    EditorInterface.prototype.forwardEvent = function (eventName, e)
    {
        if (!this.mainPanel.selectedLayer || !this.mainPanel.selectedLayer.isVisible)
            return;

        if (isEventOnCanvas(e))
        {
            var layerObject = this.mainPanel.selectedLayer.object;
            if (layerObject[eventName])
                layerObject[eventName](e, this.viewport);
        }
    };

    EditorInterface.prototype.onDrag = function (e, deltaX, deltaY)
    {
        if (isEventOnCanvas(e))
        {
            if (e.which === 1)
            {
                this.forwardEvent('onDragUpdate', e);
            }
            if (e.which === 2)
            {
                this.viewport.move(deltaX, deltaY);
            }
        }
    };

    EditorInterface.prototype.onPinch = function (e, x, y, delta)
    {
        if (isEventOnCanvas(e))
            this.viewport.setScale(this.viewport.scale + delta, new Vector2(x, y));
    };

    EditorInterface.prototype.onMouseWheel = function (e, delta)
    {
        if (isEventOnCanvas(e))
            this.viewport.setScale(this.viewport.scale + delta, new Vector2(e.pageX, e.pageY));
    };


    EditorInterface.prototype.loadResources = function ()
    {
        var resources = Editor.Plugins.resources;
        if (resources)
        {
            for (var i = 0; i < resources.length; i++)
            {
                var resource = resources[i];
                var fileName = resource.fileName;
                var resourceName = fileName.substr(0, fileName.lastIndexOf('.'));

                var image = Editor.ImageCache.loadImage(resourceName, 'resources/' + fileName);
                image.tileWidth = resource.tileWidth;
                image.tileHeight = resource.tileHeight;
            }
        }
    };

    return EditorInterface;
});
define('text!editor/templates/objectLayerPanel.html', [], function () { return '<div class="header">\r\n    <label>Object Layer Properties</label>\r\n    <div class="header-button-panel">\r\n        <div class="icon add-icon" title="Add property"></div>\r\n    </div>\r\n</div>\r\n<div class="contents tile-layer-panel"></div>';});

define('editor/layers/objectLayer', ['Editor', 'text!../templates/objectLayerPanel.html'], function (Editor, Template)
{
    'use strict';
    function ObjectLayer()
    {
        this.objects = [];
        this.selectedItems = [];
        this.properties = {};

        this.elements = Utility.getElementFromTemplate(Template);
        this.propertiesSection = new Editor.PropertiesSection();
        this.propertiesSection.setObject(this.properties);

        this.initialize();
    }

    ObjectLayer.prototype.createObject = function (key, ObjectType, position)
    {
        var obj = new ObjectType();
        if (obj.initialize)
            obj.initialize(position.x, position.y);

        if (!obj.rect)
            obj.rect = new Rectangle(Math.floor(position.x), Math.floor(position.y), obj.width || 64, obj.height || 64);

        obj.typeName = key;
        this.objects.push(obj);
    };

    ObjectLayer.prototype.draw = function (viewport)
    {
        for (var i = 0; i < this.objects.length; i++)
        {
            var obj = this.objects[i];
            if (obj.draw)
                obj.draw(viewport);
        }

        viewport.context.strokeStyle = '#99d2ff';
        for (i = 0; i < this.selectedItems.length; i++)
        {
            var item = this.selectedItems[i];
            viewport.renderer.drawRectangle(viewport, item.rect);
            viewport.context.stroke();
        }
    };

    ObjectLayer.prototype.getObjectAt = function (x, y)
    {
        for (var i = 0; i < this.objects.length; i++)
        {
            var obj = this.objects[i];
            if (x >= obj.rect.left && y >= obj.rect.top && x <= obj.rect.right && y <= obj.rect.bottom)
                return obj;
        }
    };

    ObjectLayer.prototype.getPanel = function ()
    {
        return this.elements;
    };

    ObjectLayer.prototype.initialize = function ()
    {
        var contentElement = this.elements[1];
        contentElement.insertBefore(this.propertiesSection.element, contentElement.firstChild);
        this.elements[0].querySelector('.add-icon').addEventListener('click', this.propertiesSection.addNewProperty.bind(this.propertiesSection), false);
    };

    ObjectLayer.prototype.onDragBegin = function (e, viewport)
    {
        var position = viewport.fromScreen(e.pageX, e.pageY);
        var obj = this.getObjectAt(position.x, position.y);
        if (obj)
        {
            this.selectItems(obj);
            this.draggable = {
                obj: obj,
                offset: Vector2.subtract(obj.rect.getPosition(), position)
            };
        }
    };

    ObjectLayer.prototype.onDragUpdate = function (e, viewport)
    {
        if (this.draggable)
        {
            var position = viewport.fromScreen(e.pageX, e.pageY);
            var newPosition = Vector2.add(position, this.draggable.offset);
            this.draggable.obj.setPosition(newPosition.x, newPosition.y);
            this.propertiesSection.update();
        }
    };

    ObjectLayer.prototype.onDragEnd = function (e, viewport)
    {
        if (this.draggable)
        {
            var position = viewport.fromScreen(e.pageX, e.pageY);
            var newPosition = Vector2.add(position, this.draggable.offset);
            this.draggable.obj.setPosition(newPosition.x, newPosition.y);
            this.propertiesSection.update();
            this.draggable = null;
        }
    };


    ObjectLayer.prototype.onClick = function (e, viewport)
    {
        var position = viewport.fromScreen(e.pageX, e.pageY);
        if (e.which === 1)
        {
            this.selectItems(this.getObjectAt(position.x, position.y));
        }
        else if (e.which === 3)
        {
            var objectTypes = Editor.Plugins.objectTypes;
            if (!objectTypes || Utility.isObjectEmpty(objectTypes))
                return;

            this.popup = new Editor.Popup(objectTypes).show(e.pageX, e.pageY);
            this.popup.on('close', this, function () { this.popup = null; }.bind(this));
            this.popup.on('itemClick', this, function (key, objectType)
            {
                this.createObject(key, objectType, position);
            }.bind(this));
        }
    };

    ObjectLayer.prototype.onKeyDown = function (e)
    {
        if (e.keyCode === 46)
        {
            for (var i = 0; i < this.selectedItems.length; i++)
                Utility.remove(this.objects, this.selectedItems[i]);

            this.selectItems();
        }
    };

    ObjectLayer.prototype.selectItems = function (items)
    {
        this.selectedItems.length = 0;
        this.propertiesSection.clear();

        if (items)
        {
            if (Array.isArray(items))
                this.selectedItems.push.apply(this.selectedItems, items);
            else
                this.selectedItems.push(items);
        }

        if (this.selectedItems.length === 1)
        {
            var item = this.selectedItems[0];
            this.propertiesSection.setConfig(item.getPropertyConfig && item.getPropertyConfig());
            this.propertiesSection.setObject(item);
        }
        else if (!this.selectedItems.length)
        {
            this.propertiesSection.setConfig();
            this.propertiesSection.setObject(this.properties);
        }
    };


    ObjectLayer.prototype.deserialize = function (data)
    {
        if (data.properties)
            this.properties = data.properties;

        var objectTypes = Editor.Plugins.objectTypes;
        for (var i = 0; i < data.objects.length; i++)
        {
            var objData = data.objects[i];
            var ObjectType = objectTypes[objData.typeName] || objectTypes.object;
            if (ObjectType)
            {
                var obj = new ObjectType();
                if (objData.rect)
                    objData.rect = Rectangle.fromSimpleRect(objData.rect);

                if (obj.deserialize)
                    obj.deserialize(objData);
                else
                    Utility.merge(obj, objData);

                this.objects.push(obj);
            }
        }

        this.selectItems();
    };

    ObjectLayer.prototype.serialize = function ()
    {
        var data = {objects: []};
        if (!Utility.isObjectEmpty(this.properties))
            data.properties = this.properties;

        for (var i = 0; i < this.objects.length; i++)
        {
            var obj = this.objects[i];
            var objData = Utility.merge({}, (obj.serialize) ? obj.serialize() : obj);

            if (objData.rect)
                objData.rect = objData.rect.getSimpleRect();

            data.objects.push(objData);
        }

        return data;
    };

    return ObjectLayer;
});
define('editor/controls/tileSelectionPopup', ['engine/core/events'], function (Events)
{
    'use strict';
    var activePopup;

    function TileSelectionPopup(spriteSheet)
    {
        this.brush = {};
        this.spriteSheet = spriteSheet;
    }

    TileSelectionPopup.prototype.close = function ()
    {
        activePopup = null;
        document.body.removeChild(this.element);
        this.trigger('close');
    };

    TileSelectionPopup.prototype.onMouseAction = function (e)
    {
        if (e.which === 1)
        {
            var xPosition = e.pageX - this.left + this.element.scrollLeft;
            var yPosition = e.pageY - this.top + this.element.scrollTop;

            switch (e.type)
            {
                case 'mousedown':
                    this.selectionRange = {x1: xPosition, y1: yPosition, x2: xPosition, y2: yPosition};
                    this.setSelectionMarker();
                    break;

                case 'mousemove':
                    this.selectionRange.x2 = xPosition;
                    this.selectionRange.y2 = yPosition;
                    this.setSelectionMarker();
                    break;

                case 'mouseup':
                    this.brush.tiles = [];
                    for (var y = 0; y < this.brush.rect.height; y++)
                    {
                        for (var x = 0; x < this.brush.rect.width; x++)
                        {
                            var x = x + this.brush.rect.left;
                            var y = y + this.brush.rect.top;
                            var tile = this.spriteSheet.getTile(x, y) + 1;
                            this.brush.tiles.push(tile);
                        }
                    }

                    this.trigger('selectionFinished', this.brush);
                    this.close();
                    break;
            }
        }

        e.preventDefault();
        e.stopPropagation();
    };

    TileSelectionPopup.prototype.setSelectionMarker = function ()
    { // TODO: Is there a better way to do this?
        var rect = Rectangle.fromPoints(this.selectionRange.x1, this.selectionRange.y1, this.selectionRange.x2, this.selectionRange.y2);

        var x = Math.floor(rect.left / this.spriteSheet.tileWidth);
        var y = Math.floor(rect.top / this.spriteSheet.tileHeight);
        var width = Math.ceil(rect.right / this.spriteSheet.tileWidth) - x;
        var height = Math.ceil(rect.bottom / this.spriteSheet.tileHeight) - y;
        this.brush.rect = new Rectangle(x, y, width, height);

        this.selectionMarker.style.display = 'block';
        this.selectionMarker.style.left = (x * this.spriteSheet.tileWidth + 1) + 'px';
        this.selectionMarker.style.top = (y * this.spriteSheet.tileHeight + 1) + 'px';
        this.selectionMarker.style.width = (width * this.spriteSheet.tileWidth - 3) + 'px';
        this.selectionMarker.style.height = (height * this.spriteSheet.tileHeight - 3) + 'px';
    };

    TileSelectionPopup.prototype.show = function (x, y)
    {
        if (activePopup)
            activePopup.close();

        this.element = document.createElement('div');
        this.element.className = 'popup';

        this.selectionMarker = document.createElement('div');
        this.selectionMarker.className = 'selection-marker';

        this.element.appendChild(this.spriteSheet.image.data);
        this.element.appendChild(this.selectionMarker);
        document.body.appendChild(this.element);

        var elementWidth = this.element.offsetWidth;
        var elementHeight = this.element.offsetHeight;
        var maxWidth = document.body.clientWidth;
        var maxHeight = document.body.clientHeight;

        this.left = Utility.clamp(x - elementWidth / 2, 0, maxWidth - elementWidth);
        this.top = Utility.clamp(y - elementHeight / 2, 0, maxHeight - elementHeight);

        this.element.style.top = this.top + 'px';
        this.element.style.left = this.left + 'px';
        this.element.style.maxWidth = maxWidth + 'px';
        this.element.style.maxHeight = maxHeight + 'px';

        var onMouseAction = this.onMouseAction.bind(this);
        this.element.addEventListener('mousedown', onMouseAction, false);
        this.element.addEventListener('mousemove', onMouseAction, false);
        this.element.addEventListener('mouseup', onMouseAction, false);

        activePopup = this;
        return this;
    };

    window.addEventListener('mousedown', function (e)
    {
        if (activePopup && !Utility.findParent(e.target, '.popup'))
            activePopup.close();
    }, false);

    Events.register(TileSelectionPopup.prototype);
    return TileSelectionPopup;
});
define('text!editor/templates/tileLayerPanel.html', [], function () { return '<div class="header">\r\n    <label>Tile Layer Properties</label>\r\n    <div class="header-button-panel">\r\n        <div class="icon add-icon" title="Add property"></div>\r\n    </div>\r\n</div>\r\n<div class="contents tile-layer-panel">\r\n    <div class="divider"></div>\r\n    <select data-name="spriteSheetSelect">\r\n        <option></option>\r\n    </select>\r\n    <!--<input type="file" data-name="spriteSheetInput"/>-->\r\n</div>';});

define('editor/layers/tileLayer', ['Editor', 'engine/media/spriteSheet', '../controls/tileSelectionPopup', 'text!../templates/tileLayerPanel.html'], function (Editor, SpriteSheet, TileSelectionPopup, Template)
{
    'use strict';
    var State = {
        None: 0,
        Painting: 1,
        Copying: 2
    };

    function TileLayer()
    {
        this.state = State.None;
        this.spriteSheet = new SpriteSheet();

        var grid = Editor.getGridSettings();
        this.tileMap = new Editor.TileMap(grid.rect.width, grid.rect.height, grid.tileSize);

        this.elements = Utility.getElementFromTemplate(Template);
        this.propertiesSection = new Editor.PropertiesSection();
        this.propertiesSection.setConfig({tileSize: {isRequired: true, minValue: 1}});

        this.properties = {rect: new Rectangle(0, 0, this.tileMap.width, this.tileMap.height), tileSize: grid.tileSize};
        this.propertiesSection.setObject(this.properties);
        this.initialize();
    }

    TileLayer.prototype.draw = function (viewport)
    {
        var tileSize = this.tileMap.tileSize;
        if (this.spriteSheet.isLoaded())
        {
            viewport.renderer.drawTiles(viewport, this.tileMap, this.spriteSheet);
            if (this.brush && this.isSelected && !this.popup && this.state === State.None)
            {
                var brushTileMap = {
                    xOffset: this.brush.rect.left * tileSize,
                    yOffset: this.brush.rect.top * tileSize,
                    width: this.brush.rect.width,
                    height: this.brush.rect.height,
                    tileSize: tileSize,
                    getTile: this.getBrushTile.bind(this.brush)
                };

                viewport.context.globalAlpha = 0.6;
                viewport.renderer.drawTiles(viewport, brushTileMap, this.spriteSheet);
                viewport.context.globalAlpha = 1;
            }
        }

        viewport.context.strokeStyle = '#cdcdcd';
        viewport.renderer.drawRectangle(viewport, new Rectangle(0, 0, this.tileMap.width * tileSize, this.tileMap.height * tileSize));
        viewport.context.stroke();

        if (this.brush && this.isSelected && !this.popup)
        {
            var brushRect = this.brush.rect.clone();
            brushRect.scale(tileSize, false);

            viewport.context.strokeStyle = '#d4ca40';
            viewport.renderer.drawRectangle(viewport, brushRect);
            viewport.context.stroke();
        }
    };

    TileLayer.prototype.getBrushTile = function (x, y)
    {
        return this.tiles[x + y * this.rect.width];
    };

    TileLayer.prototype.getTileHeight = function (tileSize)
    {
        if (Editor.Plugins.isIsometric)
            return tileSize / 2;

        return tileSize;
    };

    TileLayer.prototype.getPanel = function ()
    {
        return this.elements;
    };

    TileLayer.prototype.initialize = function ()
    {
        var images = Editor.ImageCache.getAll();
        images.sort();

        var contentElement = this.elements[1];
        var select = contentElement.querySelector('[data-name="spriteSheetSelect"]');
        for (var i = 0; i < images.length; i++)
        {
            var option = document.createElement('option');
            option.text = images[i].id;
            select.add(option, null);
        }

        select.addEventListener('change', this.onSpriteSheetSelectChanged.bind(this), false);

        contentElement.insertBefore(this.propertiesSection.element, contentElement.firstChild);
        this.propertiesSection.on('propertyChange', this, this.onPropertyChanged);
        this.elements[0].querySelector('.add-icon').addEventListener('click', this.propertiesSection.addNewProperty.bind(this.propertiesSection), false);
    };

    TileLayer.prototype.onPropertyChanged = function (property, propertyValue)
    {
        if (property.key === 'rect')
        {
            if (propertyValue.key !== 'width' && propertyValue.key !== 'height')
                return;

            var widthValue, heightValue;
            if (propertyValue.key === 'width')
            {
                widthValue = propertyValue.value;
                heightValue = this.tileMap.height;
            }
            else
            {
                widthValue = this.tileMap.width;
                heightValue = propertyValue.value;
            }

            var minWidth = Math.min(this.tileMap.width, widthValue);
            var minHeight = Math.min(this.tileMap.height, heightValue);

            var newMap = new Editor.TileMap(widthValue, heightValue, this.tileMap.tileSize);
            for (var x = 0; x < minWidth; x++)
            {
                for (var y = 0; y < minHeight; y++)
                {
                    var tile = this.tileMap.getTile(x, y);
                    if (tile)
                        newMap.setTile(x, y, tile);
                }
            }

            this.tileMap = newMap;
        }
        else if (property.key === 'tileSize')
        {
            this.tileMap.tileSize = propertyValue.value;
        }
    };

    TileLayer.prototype.onSpriteSheetSelectChanged = function (e)
    {
        this.setSpriteSheetImage(e.target.value);
    };

    TileLayer.prototype.onMouseDown = function (e, viewport)
    {
        if (e.which === 1)
        {
            if (e.altKey)
            {
                this.state = State.Copying;
                var position = viewport.fromScreen(e.pageX, e.pageY);
                this.selectionRange = {x1: position.x, y1: position.y, x2: position.x, y2: position.y};
            }
            else
            {
                this.state = State.Painting;
            }
        }
    };

    TileLayer.prototype.onMouseMove = function (e, viewport)
    {
        var position = viewport.fromScreen(e.pageX, e.pageY);
        if (this.state === State.Copying)
        {
            this.selectionRange.x2 = position.x;
            this.selectionRange.y2 = position.y;
            this.setBrush();
        }
        else if (this.brush)
        {
            this.setBrushPosition(position);
            if (this.state === State.Painting)
                this.setTile();
        }
    };

    TileLayer.prototype.onMouseUp = function (e, viewport)
    {
        if (e.which === 1)
        {
            if (this.state === State.Copying)
            {
                this.setBrush();
                this.selectionRange = null;
            }
            else if (this.state === State.Painting && this.brush)
            {
                this.setBrushPosition(viewport.fromScreen(e.pageX, e.pageY));
                this.setTile();
            }

            this.state = State.None;
        }
    };

    TileLayer.prototype.onClick = function (e)
    {
        if (e.which === 3 && this.spriteSheet.isLoaded())
        {
            this.popup = new TileSelectionPopup(this.spriteSheet).show(e.pageX, e.pageY);
            this.popup.on('selectionFinished', this, function (brush) { this.brush = brush; });
            this.popup.on('close', this, function () { this.popup = null; });
        }
    };


    TileLayer.prototype.setBrush = function ()
    {
        var rect = Rectangle.fromPoints(this.selectionRange.x1, this.selectionRange.y1, this.selectionRange.x2, this.selectionRange.y2);

        var tileSize = this.tileMap.tileSize;
        var x = Math.floor(rect.left / tileSize);
        var y = Math.floor(rect.top / tileSize);
        var width = Math.ceil(rect.right / tileSize) - x;
        var height = Math.ceil(rect.bottom / tileSize) - y;

        this.brush = {tiles: [], rect: new Rectangle(x, y, width, height)};
        for (y = this.brush.rect.top; y < this.brush.rect.bottom; y++)
        {
            for (x = this.brush.rect.left; x < this.brush.rect.right; x++)
            {
                var tile = 0;
                if (this.tileMap.isInBounds(x, y))
                    tile = this.tileMap.getTile(x, y);

                this.brush.tiles.push(tile);
            }
        }
    };

    TileLayer.prototype.setBrushPosition = function (position)
    {
        this.brush.rect.left = Math.floor(0.5 + position.x / this.tileMap.tileSize - this.brush.rect.width / 2);
        this.brush.rect.top = Math.floor(0.5 + position.y / this.tileMap.tileSize - this.brush.rect.height / 2);
    };

    TileLayer.prototype.setSpriteSheetImage = function (imageName)
    {
        var image = Editor.ImageCache.getImage(imageName);
        this.spriteSheetName = imageName;

        this.spriteSheet.setImage(image);
        if (image)
        {
            this.spriteSheet.tileWidth = image.tileWidth;
            this.spriteSheet.tileHeight = image.tileHeight;
        }
    };

    TileLayer.prototype.setTile = function ()
    {
        for (var x = 0; x < this.brush.rect.width; x++)
        {
            for (var y = 0; y < this.brush.rect.height; y++)
            {
                var x = this.brush.rect.left + x;
                var y = this.brush.rect.top + y;

                if (this.tileMap.isInBounds(x, y))
                {
                    var tile = this.brush.tiles[x + y * this.brush.rect.width];
                    this.tileMap.setTile(x, y, tile);
                }
            }
        }
    };


    TileLayer.prototype.deserialize = function (data)
    {
        this.properties = data.properties;
        this.properties.rect = Rectangle.fromSimpleRect(this.properties.rect);
        this.propertiesSection.setObject(this.properties);

        this.tileMap = new Editor.TileMap(this.properties.rect.width, this.properties.rect.height, this.properties.tileSize);
        for (var i = 0; i < data.tiles.length; i++)
            this.tileMap.setTileAtIndex(i, data.tiles[i]);

        if (data.spriteSheet)
        {
            this.elements[1].querySelector('[data-name="spriteSheetSelect"]').value = data.spriteSheet;
            this.setSpriteSheetImage(data.spriteSheet);
        }
    };

    TileLayer.prototype.serialize = function ()
    {
        var tileData = [];
        for (var i = 0; i < this.tileMap.tiles.length; i++)
            tileData.push(this.tileMap.tiles[i]);

        var properties = Utility.merge({}, this.properties);
        properties.rect = properties.rect.getSimpleRect();
        return {properties: properties, spriteSheet: this.spriteSheetName, tiles: tileData};
    };

    return TileLayer;
});
define('Editor',
    [
        'engine/data/fileHandler',
        'engine/media/imageCache',
        'engine/core/inputHandler',
        'editor/controls/popup',
        'editor/controls/propertiesSection',
        'engine/core/scheduler',
        'engine/media/spriteSheet',
        'engine/spatial/tileMap',
        'engine/data/webStorage'
    ],
    function (FileHandler, ImageCache, InputHandler, Popup, PropertiesSection, Scheduler, SpriteSheet, TileMap, WebStorage)
    {
        'use strict';
        return {
            FileHandler: FileHandler,
            InputHandler: InputHandler,
            ImageCache: ImageCache,
            Popup: Popup,
            PropertiesSection: PropertiesSection,
            Scheduler: Scheduler,
            SpriteSheet: SpriteSheet,
            TileMap: TileMap,
            WebStorage: WebStorage
        };
    });

require(['engine/game/game', 'engine/rendering/render2dIsometric', 'engine/rendering/render2d', 'editor/core/editorInterface', 'editor/layers/objectLayer', 'editor/layers/tileLayer'],
    function (Game, IsometricRenderer, Renderer, EditorInterface, ObjectLayer, TileLayer)
    {
        'use strict';
        Game.onReady(function ()
        {
            require(['Editor', 'Plugins'], function (Editor, Plugins)
            {
                Editor.Plugins = Plugins;
                Editor.Plugins.layerTypes = Utility.merge({'objectLayer': ObjectLayer, 'tileLayer': TileLayer}, Editor.Plugins.layerTypes);

                Game.renderer = Editor.Plugins.isIsometric ? IsometricRenderer : Renderer;
                Game.setScene(new EditorInterface());
            });
        }, Renderer);
    });
define("editor/main", function () {});
