*This repository is a mirror of the [component](http://component.io) module [tower/template](http://github.com/tower/template). It has been modified to work with NPM+Browserify. You can install it using the command `npm install npmcomponent/tower-template`. Please do not open issues or send pull requests against this repo. If you have issues with this repo, report it to [npmcomponent](https://github.com/airportyh/npmcomponent).*
# Tower Template

Client-side reactive templates (just plain DOM node manipulation, no strings).

## Installation

```bash
$ component install tower/template
```

## Example

```js
var template = require('tower-template');
var element = document.querySelector('#todos');
var fn = template(element);
fn({ some: 'data' }); // applies "scope" (data) to DOM directives.
```

## Running Tests

For client-side testing, build:

```bash
$ component install -d
$ component build -d
```

Then view `test/index.html` in the browser:

```
open test/index.html
```

## Notes

- http://www.jspatterns.com/the-ridiculous-case-of-adding-a-script-element/

```js
directive('background', function(scope, el, attrs){
  for (var i = 0, n = attrs.length; i < n; i++) {
    attrs[i].watch(scope)
  }
});
```

## License

MIT

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/tower/client-view/trend.png)](https://bitdeli.com/free "Bitdeli Badge")