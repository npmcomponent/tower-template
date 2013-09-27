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