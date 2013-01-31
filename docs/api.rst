
.. _js-api:

JavaScript Library API
======================

See the :doc:`javascript-library` main page for more information and setup
instructions.


Method Index
------------

.. table::

   ====================== =====
   :ref:`js-async-api`    :js:data:`window._bdq`, :js:func:`_bdq.push`
   ---------------------- -----
   :ref:`js-api-init`     :js:func:`setAccount`
   ---------------------- -----
   :ref:`js-api-props`    :js:func:`identify`, :js:func:`set`, :js:func:`setOnce`,
                          :js:func:`unset`
   ---------------------- -----
   :ref:`js-api-tracking` :js:func:`track`, :js:func:`trackPageview`,
                          :js:func:`trackClick`, :js:func:`trackSubmit`
   ====================== =====


.. _js-async-api:

Asynchronous API
----------------

.. js:data:: window._bdq

   This global variable is initialized in the tracking code and contains the
   asynchronous call queue for all API methods.


.. js:function:: _bdq.push(call)

   Adds an API method call to the asynchronous call queue. Since the
   :js:data:`window._bdq` object is initialized as an array, method calls can be
   added even before the tracking library has been loaded. When the library is
   loaded all previously added methods in the queue are immediately executed.

   :param Array call: An array containing the method name to be called and
                      the arguments that should be passed to the method.

   To call an API method, use the following syntax:

   .. code-block:: javascript

      _bdq.push([methodName, argument1, argument2, ...]);

   All the arguments after the method name are passed as-is to the
   method and should be listed in the order defined in the method description.

   See :ref:`js-api-methods` for a list of methods and their arguments.



.. _js-api-methods:

API Methods
-----------

.. _js-api-init:

Initialization
''''''''''''''

.. js:function:: setAccount(inputId, token)

   Defines the :ref:`Bitdeli data source <data-sources>` that should receive
   the tracking events. This method is included in the default tracking code.

   This method also initializes the cookie containing the user
   properties and thus *should be called before all other API methods*.

   :param String inputId: The ID of the data source, as
                          shown in `your account settings`_.

   :param String token: The authentication token of the data source, as
                        shown in `your account settings`_.

   **Example:**

   .. code-block:: javascript

      _bdq.push(["setAccount", "i-0123456789abcd-12345678", "0123456789abcdef0123456789a"]);

.. _`your account settings`: https://bitdeli.com/account/settings


.. _js-api-props:

User Properties
'''''''''''''''

.. js:function:: identify(userId)

   Identifies the current user with a unique ID. This ID is used to aggregate
   events into :ref:`profiles` before passing them to a :ref:`card-script`.

   If this method is not called before sending tracking events, a random UUID is
   automatically generated and assigned to the user.

   :param String userId: A unique identifier for the current user,
                         such as a database ID from your application database.

   **Example:**

   .. code-block:: javascript

      _bdq.push(["identify", "123456789"]);


.. js:function:: set(properties)

   Sets custom properties for the current user. These properties are persisted
   in a cookie and included in all events sent using the
   :ref:`tracking methods <js-api-tracking>`.

   :param Object properties: Properties to be assigned to the current user
                             (e.g. email address, username, subscription type).

   **Example:**

   .. code-block:: javascript

      _bdq.push(["set", {
          email: "johndoe@example.com",
          username: "johndoe"
      }]);


.. js:function:: setOnce(properties)

   Sets properties without overwriting previous values set with the same
   property name. This is especially useful for storing information about the
   user's origin, such as the initial referrer or the first page the user
   visited on the site.

   :param Object properties: Properties to be assigned to the current user.
                             Properties with previously assigned values are
                             discarded.

   **Example:**

   .. code-block:: javascript

      _bdq.push(["setOnce", {
          initial_referrer: document.referrer,
          landing_page: window.location.href
      }]);


.. js:function:: unset(property)

   Removes a property from the current user, ensuring that it is not
   included in any subsequent tracking events.

   :param String property: The name of the property to be removed


.. _js-api-tracking:

Tracking User Actions
'''''''''''''''''''''

.. js:function:: track(event[, properties, callback])

   Sends a single event to Bitdeli. In addition to the event name, the event
   can contain any amount of custom data in the form of properties.

   All properties previously set by :ref:`property methods <js-api-props>`
   are included in the event.

   :param String event: A descriptive name for the event. This value is
                        typically used when displaying overall event frequencies
                        or creating textual reports from the data.

   :param Object properties: *(optional)* Properties to track for this action.
                             Note these properties override existing properties
                             with the same name (but are not persisted).

   :param Function callback: *(optional)* A function that is called
                             after the request is completed. The callback is
                             called with one argument: ``1`` if the event was
                             tracked successfully or ``0`` if the event
                             was not tracked.

   **Examples:**

   .. code-block:: javascript

      _bdq.push(["track", "signed up"]);

   .. code-block:: javascript

      _bdq.push(["track", "added product to cart", {
          productId: "42",
          title: "A Brief History of Time",
          price: 2399
      }]);

   .. code-block:: javascript

      _bdq.push(["track", "clicked play button", {}, function(response) {
          if (response == 1) alert("tracked successfully!");
      }]);


.. js:function:: trackPageview([page, callback])

   Sends a predefined page view event to Bitdeli. This method is included
   by default in the tracking code, but can also be called elsewhere. Users
   with so-called single page apps may want to call this method every time the
   application view changes significantly (even if the page is not reloaded).

   :param String page: *(optional)* The page URL to track. If the page is not
                       defined, the current location is used instead.

   :param Function callback: *(optional)* Tracking request callback
                             (see :js:func:`track` for details).

   **Example:**

   .. code-block:: javascript

      _bdq.push(["trackPageview", "http://example.com/#/product/42"]);


.. js:function:: trackClick(selector, event[, properties, callback])

   Attaches a ``click`` event listener to the specified DOM element(s). The
   next time the element is clicked, a tracking event is sent with the
   name and properties defined in the arguments.

   This method is designed for tracking outbound links that cause the user to
   leave the current page when clicked. To ensure that the tracking request is
   sent before the page changes, this method cancels the default ``onclick``
   behavior of the browser, sends the event to Bitdeli and redirects the user to
   the correct page after the event has been tracked.

   To prevent this workaround from causing a noticeable lag, the default browser
   action is forced after 300 milliseconds regardless of the status of the
   tracking request. For this reason we recommend using the basic
   :js:func:`track` method for events that need to be tracked accurately.

   See :js:func:`track` for details on the ``event``, ``properties`` and
   ``callback`` arguments.

   :param String|Element|Array selector: A CSS selector, DOM element or an
         array of selectors or elements. Only selectors with a single ID or
         class are supported (see examples below).

   :param String event: A descriptive name for the event.

   :param Object|Function properties: *(optional)* Properties to track for this
         action. For DOM event tracking methods, this can also be a function
         that returns properties when passed the DOM element that was clicked.

   :param Function callback: *(optional)* Tracking request callback.

   The ``callback`` function for DOM event tracking methods is passed the
   following arguments:

   :param Number response: ``1`` if the event was tracked successfully,
                           ``0`` if there was an error.

   :param Event event: The DOM Event object that initiated the tracking request.

   :param Boolean timedOut: ``true`` if the request was cut off after the
                            300ms delay.

   Returning ``false`` from the callback function cancels the default action
   (i.e. page change).

   **Examples:**

   .. code-block:: javascript

      _bdq.push(["trackClick", "#article-source", "clicked source link on article page"]);

   .. code-block:: javascript

      _bdq.push(["trackClick", ".cart-button", "clicked cart button", {
          position: "header"
      }]);

   Using `jQuery <http://jquery.com/>`_ (or a similar DOM utility):

   .. code-block:: javascript

      _bdq.push(["trackClick", [".external-link", ".header-link"], function() {
          // `this` references the DOM element that was clicked
          return {
              url: $(this).attr("href"),
              text: $(this).text()
          };
      }]);


.. js:function:: trackSubmit(selector, event[, properties, callback])

   Attaches a ``submit`` event listener to the specified DOM element(s). When
   the submit event is triggered on the element, a tracking event is sent
   with the name and properties defined in the arguments.

   This method cancels the default submit action of the browser similarly
   to the ``trackClick`` method. See :js:func:`trackClick` for details and
   notes on this behaviour.

   See :js:func:`trackClick` and :js:func:`track` for details on the ``event``,
   ``properties`` and ``callback`` arguments.

   :param String|Element|Array selector: A CSS selector, DOM element or an
         array of selectors or elements. Only selectors with a single ID or
         class are supported (see examples below).

   :param String event: A descriptive name for the event.

   :param Object|Function properties: *(optional)* Properties to track for this
         action. For DOM event tracking methods, this can also be a function
         that returns properties when passed the DOM element that was submitted.

   :param Function callback: *(optional)* Tracking request callback.

   **Example:**

   .. code-block:: javascript

      _bdq.push(["trackSubmit", "#signup-form", "submitted signup form"]);
