
.. _js-lib:

JavaScript Library
==================

.. toctree::
   :hidden:
   :glob:

   javascript-*


The Bitdeli JavaScript library provides an easy and flexible way to gather usage
data from any web application directly to Bitdeli. The library is similar to the
ones provided by other analytics providers such as Google Analytics, Mixpanel
and KISSmetrics.

The main features of the Bitdeli JavaScript library are:

- **Identifying page visitors** with a random UUID or a custom user ID
- **Storing custom user properties** over multiple events and sessions
- **Tracking user actions**, such as page views, clicks and form submissions
- **Automatically gathering page visit information**, such as browser user agent
  strings and referrers

See :doc:`API reference <javascript-api>` for detailed documentation.

Since the data from the tracking library is sent directly to Bitdeli, your
:ref:`cards <card-script>` will update more frequently than with our 3rd party
service integrations. Also, data from the JavaScript library has a higher
retention than data from other sources. See :ref:`data-sources` for more details
about update intervals and retention.

The source code for the library can be found on `GitHub
<https://github.com/bitdeli/bitdeli-tracking-js>`_. To suggest a feature or
report a bug, `contact us </contact>`_ or visit the `Issues page
<https://github.com/bitdeli/bitdeli-tracking-js/issues>`_ on GitHub.


.. _js-lib-setup:

Setup
-----

`Log in </login>`_ to your Bitdeli account and go to `your account settings
</settings/data>`_ to find your unique snippet and instructions for setting up
the JavaScript tracking library.

To start tracking events in your web application add the following snippet
inside the `<head>` tag of your site:

.. code-block:: html

    <script type="text/javascript">
      var _bdq = _bdq || [];
      _bdq.push(["setAccount", "YOUR_INPUT_ID", "YOUR_INPUT_TOKEN"]);
      _bdq.push(["trackPageview"]);

      (function() {
        var bd = document.createElement("script"); bd.type = "text/javascript"; bd.async = true;
        bd.src = ("https:" == document.location.protocol ? "https://" : "http://") + "d2flrkr957qc5j.cloudfront.net/bitdeli.min.js";
        var s = document.getElementsByTagName("script")[0]; s.parentNode.insertBefore(bd, s);
      })();
    </script>

The snippet loads the JavaScript tracking library for Bitdeli asynchronously
without affecting the loading time of other elements on your site.

For more details on using the tracking library, see the :doc:`javascript-api`.

If you are using multiple analytics providers you can also use `analytics.js
<https://github.com/segmentio/analytics.js>`_ to embed and use the Bitdeli
library alongside other tracking libraries.
