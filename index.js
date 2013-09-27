
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
 * Expose `collection`.
 */

exports.collection = {};

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

exports.has = function(name){
  return !!exports.collection.hasOwnProperty(name);
};

/**
 * Traverse `node` and children recursively,
 * and collect and execute directives.
 *
 * @param {HTMLNode} node
 * @param {Content} scope
 * @return {Function} The compiled template function.
 */

function compile(node) {
  // http://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
  var nodeFn = node.nodeType
    ? compileNode(node)
    : compileEach(node);

  function fn(scope, el) {
    if (!content.is(scope))
      scope = content('anonymous').init(scope);

    return nodeFn(scope, el);
  }

  return fn;
}

function compileNode(node) {
  var directivesFn = compileDirectives(node, nodeFn);
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

function compileDirectives(node, nodeFn) {
  var attrs = {};
  var directives = getDirectives(node, attrs);

  if (!directives.length) return; // don't execute function if unnecessary.

  var terminal = false;
  var fns = [];
  for (var i = 0, n = directives.length; i < n; i++) {
    var fn = directives[i].compile(node, nodeFn, attrs);
    fns.push(fn);
    terminal = directives[i]._terminal;
    if (terminal) break;
  }

  var directivesFn = createDirectivesFn(fns);

  directivesFn.terminal = terminal;

  return directivesFn;
}

function getDirectives(node, attrs) {
  var directives = [];

  // https://developer.mozilla.org/en-US/docs/Web/API/Node.nodeType
  switch (node.nodeType) {
    case 1: // element node (visible tags plus <style>, <meta>)
      // first, appendDirective directive named after node, if it exists.
      var obj = appendDirective(node.nodeName.toLowerCase(), 'element', directives);
      getDirectivesFromAttributes(node, directives, attrs, obj);
      break;
    case 3: // text node
      // node.nodeValue
      appendDirective('interpolation', 'attribute', directives);
      break;
    case 8: // comment node
      break;
  }

  if (directives.length) directives.sort(priority);
  return directives;
}

function getDirectivesFromAttributes(node, directives, attrs, elementDirective) {
  var attr;
  for (var i = 0, n = node.attributes.length; i < n; i++) {
    attr = node.attributes[i];
    // The specified property returns true if the 
    // attribute value is set in the document, 
    // and false if it's a default value in a DTD/Schema.
    // http://www.w3schools.com/dom/prop_attr_specified.asp
    // XXX: don't know what this does.
    if (!attr.specified || attrs[attr.name]) continue;
    if (appendDirective(attr.name, 'attribute', directives)) {
      attrs[attr.name] = directives[directives.length - 1].compileExpression(attr.value);
    } else if (elementDirective && elementDirective.hasAttribute(attr.name)) {
      attrs[attr.name] = directives[directives.length - 1].compileExpressionForAttribute(attr.name, attr.value);
    }
    // else, just a basic value
  }
}

/**
 * Add directive.
 *
 * @param {String} name The directive's name.
 * @param {Array} directives The list of directives.
 */

function appendDirective(name, type, directives) {
  var obj = directive.collection[name];
  if (obj && obj._types[type]) {
    directives.push(obj);
    return obj;
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
  return b._priority - a._priority;
}