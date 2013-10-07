
/**
 * Module dependencies.
 */

var directive = require('tower-directive');
var content = require('tower-content');

/**
 * Expose `template`.
 */

exports = module.exports = template;

/**
 * Expose `compile`.
 */

exports.compile = compile;

/**
 * Expose `collection`.
 */

exports.collection = {};

/**
 * Expose `document`.
 *
 * For server-side use.
 */

exports.document = 'undefined' == typeof document
  ? {} // XXX: tower/server-dom
  : window.document;

/**
 * Client-side reactive templates (just plain DOM node manipulation, no strings).
 *
 * @module template
 *
 * @param {String} name The template's name.
 * @param {HTMLNode} node The HTML node.
 * @return {Function} The compiled template function.
 * @api public
 */

function template(name, node) {
  if ('function' === typeof node)
    return exports.collection[name] = node;

  // if `name` is a DOM node, arguments are shifted by 1
  if ('string' !== typeof name) return compile(name);
  // only 1 argument
  if (undefined === node) return exports.collection[name];
  // compile it
  return exports.collection[name] = compile(node);
}

/**
 * Check if template with `name` exists.
 *
 * @api public
 */

exports.defined = function(name){
  return !!exports.collection.hasOwnProperty(name);
};

/**
 * Traverse `node` and children recursively,
 * and collect and execute directives.
 *
 * @param {HTMLNode} node
 * @param {Array} start Directives to start.
 * @return {Function} The compiled template function.
 */

function compile(node, start) {
  // http://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
  // XXX: if node gets replaced here, needs to be reflected
  var nodeFn = node.nodeType
    ? compileNode(node, start)
    : compileEach(node);

  function fn(scope, el) {
    if (!content.is(scope))
      scope = content('anonymous').init(scope);

    return nodeFn(scope, el);
  }

  return fn;
}

function compileNode(node, start) {
  var directivesFn = compileDirectives(node, nodeFn, start);
  var terminal = directivesFn && directivesFn.terminal;
  
  // recursive
  var eachFn = !terminal && node.childNodes
    ? compileEach(node.childNodes)
    : undefined;

  // `returnNode` is used for recursively 
  // passing children. this is used for cloning, 
  // where it should apply the directives to 
  // the new children, not the original 
  // template's children.

  function nodeFn(scope, returnNode) {
    returnNode || (returnNode = node);

    // apply directives to node.
    if (directivesFn) scope = directivesFn(scope, returnNode);

    // recurse, apply directives to children.
    //if (eachFn && returnNode.childNodes)
    if (eachFn && returnNode.childNodes)
      eachFn(scope, returnNode.childNodes, returnNode);

    return returnNode;
  }

  return nodeFn;
}

function compileEach(children) {
  var fns = [];
  // doesn't cache `length` b/c items can be removed
  //for (var i = 0, n = children.length; i < n; i++) {
  for (var i = 0; i < children.length; i++) {
    fns.push(compileNode(children[i]));
  }

  return createEachFn(fns);
}

function compileDirectives(node, nodeFn, start) {
  var directives = getDirectives(node, start);
  if (!directives.length) return; // don't execute function if unnecessary.

  var terminal = false;
  var fns = [];
  var obj;

  for (var i = start || 0, n = directives.length; i < n; i++) {
    obj = directives[i];

    if (obj.template) {
      // XXX: replace <content> tags with the stuff from the current `node`.
      var templateEl = obj.templateEl.cloneNode(true);

      if (obj.replace) {
        node.parentNode.replaceChild(templateEl, node);
        node = templateEl;
        directives = directives.concat(getDirectives(node));
        n = directives.length;
        terminal = true;
      } else {
        node.appendChild(templateEl);
      }
    }

    // meta node (such as `data-each` or `data-if`)
    if (obj.meta) {
      obj.terminal = true;
      // you have to replace nodes, not remove them, to keep order.
      var val = node.getAttribute(obj.name);
      var comment = exports.document.createComment(' ' + obj.name + ':' + val + ' ');
      if (node.parentNode)
        node.parentNode.replaceChild(comment, node);
      // XXX: should skip already processed directives
      // <profile data-each="user in users"></profile>
      // template(el, [ 'profile', 'data-each' ]);
      nodeFn = compile(node, i + 1);
      node = comment;
    }

    var fn = obj.compile(node, nodeFn);
    fns.push(fn);
    terminal = obj.terminal;
    if (terminal) break;
  }

  var directivesFn = createDirectivesFn(fns);
  directivesFn.terminal = terminal;
  return directivesFn;
}

function getDirectives(node, start) {
  var directives = [];
  var attrs = {};

  // https://developer.mozilla.org/en-US/docs/Web/API/Node.nodeType
  switch (node.nodeType) {
    case 1: // element node (visible tags plus <style>, <meta>)
      // first, appendDirective directive named after node, if it exists.
      appendDirective(node.nodeName.toLowerCase(), 'element', node, directives);
      appendAttributeDirectives(node, directives, attrs);
      break;
    case 3: // text node
      // node.nodeValue
      appendDirective('interpolation', 'attribute', directives, node);
      break;
    case 8: // comment node
      break;
  }

  if (directives.length) directives.sort(priority);
  return directives;
}

function appendAttributeDirectives(node, directives, attrs) {
  var attr;
  for (var i = 0, n = node.attributes.length; i < n; i++) {
    attr = node.attributes[i];
    // http://www.w3schools.com/dom/prop_attr_specified.asp
    if (!attr.specified || attrs[attr.name]) continue;
    appendDirective(attr.name, 'attribute', node, directives, attrs);
  }
}

/**
 * Add directive.
 *
 * @param {String} name The directive's name.
 * @param {Array} directives The list of directives.
 */

function appendDirective(name, type, node, directives, attrs) {
  var Directive = directive.collection[name];
  if (Directive && Directive.prototype[type]) {
    directives.push(new Directive(node, attrs));
  }
}

/**
 * Creates a template function for node children
 * in an isolated JS scope.
 */

function createEachFn(fns) {
  var n = fns.length, i;

  function eachFn(scope, children, returnNode) {
    for (i = 0; i < n; i++) {
      // XXX: not sure this is correct.
      fns[i](scope, children[i]);
    }
  }

  return eachFn;
}

/**
 * Creates a template function for node directives
 * in an isolated JS scope.
 *
 * @param {Array} fns Array of directive functions.
 * @return {Function} A template function for node directives.
 */

function createDirectivesFn(fns) {
  var n = fns.length, i;

  function directivesFn(scope, node) {
    // if we've moved this node around, then
    // it should still have access to the original scope.
    if (node.__scope__)
      scope = node.__scope__;
    
    for (i = 0; i < n; i++) {
      scope = fns[i](scope, node);
    }

    return scope;
  }

  return directivesFn;
}

/**
 * Sort by priority.
 */

function priority(a, b) {
  return b.priority - a.priority;
}