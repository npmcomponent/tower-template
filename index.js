/**
 * Module that handles Client-side reactive templates (just plain DOM node manipulation, no strings).
 *
 * @module template
 */

/**
 * Module dependencies.
 */

var content = require('tower-content');
var directive = require('tower-directive');

/**
 * Expose `template`.
 */

exports = module.exports = template;

/**
 * Expose `collection`.
 */

exports.collection = {};

/**
 * Expose `compile`.
 */

exports.compile = compile;

/**
 * Expose `parse`.
 */

exports.parse = parse;

/**
 * Compile a DOM element's directives to a function.
 *
 * @param {String} name The template's name.
 * @param {HTMLNode} node The HTML node.
 * @return {Function} The compiled template function.
 * @api public
 */

function template(name, node) {
  // if `name` is a DOM node, arguments are shifted by 1
  if ('string' !== typeof name) return compile(name);
  // only 1 argument
  if (undefined === node) return exports.collection[name];
  // compile it
  return exports.collection[name] = compile(node);
}

/**
 * Parse HTML string or, if HTMLNode, just return that.
 *
 * @param {Mixed} obj
 */

function parse(obj) {
  
}

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
  var fn = node.nodeType
    ? compileNode(node)
    : compileEach(node);

  // clone original element
  fn.clone = function clone(scope){
    return fn(scope, node.cloneNode(true));
  }

  fn.clone2 = function(){
    return node.cloneNode(true);
  }

  return fn;
}

function compileNode(node) {
  var directivesFn = compileDirectives(node, nodeFn);
  
  // recursive
  var eachFn = node.childNodes
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
  var directives = getDirectives(node);

  if (!directives.length) return; // don't execute function if unnecessary.

  var fns = [];
  for (var i = 0, n = directives.length; i < n; i++) {
    fns.push(directives[i].compile(node, nodeFn));
  }

  return createDirectivesFn(fns);
}

function getDirectives(node) {
  var directives = [];

  // https://developer.mozilla.org/en-US/docs/Web/API/Node.nodeType
  switch (node.nodeType) {
    case 1: // element node (visible tags plus <style>, <meta>)
      // first, appendDirective directive named after node, if it exists.
      appendDirective(node.nodeName.toLowerCase(), directives);
      getDirectivesFromAttributes(node, directives);
      break;
    case 3: // text node
      // node.nodeValue
      appendDirective('interpolation', directives);
      break;
    case 8: // comment node
      //
      break;
  }

  if (directives.length) directives.sort(priority);
  return directives;
}

function getDirectivesFromAttributes(node, directives) {
  var attr;
  for (var i = 0, n = node.attributes.length; i < n; i++) {
    attr = node.attributes[i];
    // The specified property returns true if the 
    // attribute value is set in the document, 
    // and false if it's a default value in a DTD/Schema.
    // http://www.w3schools.com/dom/prop_attr_specified.asp
    // XXX: don't know what this does.
    if (!attr.specified) continue;
    appendDirective(attr.name, directives);
  }
}

/**
 * Add directive.
 *
 * @param {String} name The directive's name.
 * @param {String} directives The list of directives.
 */

function appendDirective(name, directives) {
  if (directive.defined(name)) {
    directives.push(directive(name));
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
    // XXX: maybe we can collect the directives in reverse
    //      and then use a `while` loop.
    for (i = 0; i < n; i++) {
      scope = fns[i](node, scope);
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