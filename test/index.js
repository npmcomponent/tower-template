
var content = require('tower-content');
var directive = require('tower-directive');
var document = 'undefined' !== typeof window && document;

if ('undefined' === typeof window) {
  var template = require('..');
  var assert = require('assert');
  var jsdom = require('jsdom').jsdom;
  var fs = require('fs');
  var path = require('path');
  document = jsdom(fs.readFileSync(path.join(__dirname, 'index.html')));
} else {
  var template = require('tower-template');
  var assert = require('timoxley-assert'); 
}

describe('template', function(){
  //beforeEach(directive.clear);

  it('should execute all', function(){
    directive('data-text', function(scope, el){
      el.textContent = scope.get(el.getAttribute('data-text')); 
    });

    directive('data-title', function(scope, el){
      el.setAttribute('title', scope.get(el.getAttribute('data-title')));
    });

    var el = document.querySelector('#should-execute-all');
    var fn = template(el);
    var scope = content('random').init({ foo: 'Foo', bar: 'Bar' });
    fn(scope);

    assert('Foo' === el.title);
    assert('Bar' === document.querySelector('#should-execute-all span').textContent);
  });

  describe('data-scope', function(){
    it('should create a nested scope', function(){
      assert(false === content.defined('custom'));
      
      content('custom')
        .attr('foo', 'string', 'Custom Scope Property!');

      var el = document.querySelector('#custom-scope');
      var fn = template(el);
      var scope = content('custom').init();
      fn(scope);
      assert('Custom Scope Property!' === document.querySelector('#custom-scope span').textContent);
    });
  });

  it('should allow passing new els to existing template', function(){
    directive('data-text', function(el){
      return function exec(scope, el) {
        el.textContent = scope.get(el.getAttribute('data-text')); 
      }
    });
    
    content('x')
      .attr('helloWorld', 'string', 'Hello World!');

    var el = document.querySelector('#existing-element');
    var fn = template(el);
    var scope = content('x').init();
    fn(scope);
    assert('Hello World!' === el.textContent);
    el = document.querySelector('#new-element');
    fn(scope, el);
    assert('Hello World!' === el.textContent);
  });

  it('should store templates by name', function(){
    var fn1 = template('one', document.querySelector('#name-one'));
    var fn2 = template('two', document.querySelector('#name-two'));
    assert(fn1 === template('one'));
    assert(fn2 === template('two'));
  });
});