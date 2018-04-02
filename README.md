## [@amarajs/plugin-engine-browser](https://github.com/amarajs/plugin-engine-browser)

Plugin middleware for AmaraJS to work in web browsers.

### Installation

`npm install --save @amarajs/plugin-engine-browser`

### Usage

```javascript
import Amara from '@amarajs/core';
import AmaraBrowser from '@amarajs/plugin-engine-browser';
const amara = new Amara([
    AmaraBrowser()
]);
```

### Description

The `@amarajs/plugin-engine-browser` middleware provides [`@amarajs/core`](https://github.com/amarajs/core) with the ability to map each feature's `target` selector strings to DOM nodes. For example:

```javascript
amara.add({
    type: 'some-custom-type',
    // @amarajs/engine-plugin-browser will use these CSS
    // query selectors to identify the DOM nodes this
    // feature should be applied to
    targets: ['div#main', 'span', 'a[href^="#"]'],
    apply: () => {}
});
```

### Actions Dispatched

The `@amarajs/plugin-engine-browser` middleware dispatches an `"engine:append-observed-attributes"` action during bootstrap. This allows other middleware to specify which DOM attributes should be watched for changes. For example, [`@amarajs/plugin-router`](https://github.com/amarajs/plugin-router) adds `"route"` to the list of observed attributes, ensuring that any features which target `[route]` attributes will be applied automatically by AmaraJS.

action.type | action.payload
--- | ---
`"engine:append-observed-attributes"` | `Set<string>`

```javascript
// in custom middleware
// watch for changes to "modal" attributes
return function handler(action) {
    switch (action.type) {
    case 'engine:append-observed-attributes':
        action.payload.add('modal');
        break;
    }
};
```

### Customization

This plugin has no customization options.

### Contributing

If you have a feature request, please create a new issue so the community can discuss it.

If you find a defect, please submit a bug report that includes a working link to reproduce the problem (for example, using [this fiddle](https://jsfiddle.net/04f3v2x4/)). Of course, pull requests to fix open issues are always welcome!

### License

The MIT License (MIT)

Copyright (c) Dan Barnes

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
