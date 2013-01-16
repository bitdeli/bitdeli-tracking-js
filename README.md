JavaScript tracking library for Bitdeli
=======================================

**Coming soon: Usage instructions and documentation**

[Contact us](https://bitdeli.com/contact) if you are interested in being an early tester.

[Bitdeli Home](https://bitdeli.com)


## Developers ##

_Please note: The following instructions are intended for developers contributing to this library. To use the library to track events on your website please refer to the official documentation._

This library uses the [Ender](http://ender.jit.su/) package manager to compile multiple modules to one distributable file. To install the latest version of Ender, run the following [npm](https://npmjs.org/) command (you may have to use `sudo` to install the package globally):

```
[sudo] npm install ender@dev -g
```

_These build instructions have been tested to work on version `0.9.13-dev` of the `ender` package._

To build and compile the library and its dependencies, run the included Makefile:

```
make
```

This will automatically download and install the required Ender packages under the `node_modules` subfolder.

After the build process is complete, both a development build and a minified production build can be found in the `build` subfolder.


## Contributing ##

To suggest a feature or report a bug, visit the [Issues page](https://github.com/bitdeli/bitdeli-tracking-js/issues).


## Copyright and License ##

Copyright 2013 Bitdeli Inc.

[MIT License](https://github.com/bitdeli/bitdeli-tracking-js/blob/master/LICENSE)


[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/bitdeli/bitdeli-tracking-js/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

