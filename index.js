
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
  // use nodeList[i] in case it gets compiled beneath
  // XXX: therefore, it must always be on arrays
  if (node.nodeType) {
    // find nodeList and index;
    var nodeList;
    var index;
    if (node.parentNode) {
      nodeList = node.parentNode.childNodes;
      for (var i = 0; i < nodeList.length; i++) {
        if (node == nodeList[i]) {
          index = i;
          break;
        }
      }
    } else {
      var frag = document.createDocumentFragment();
      frag.appendChild(node);
      nodeList = frag.childNodes;
      index = 0;
    }
  }

  var nodeFn = node.nodeType
    ? compileNode(node, index, nodeList, start)
    : compileEach(node);

  function fn(scope, el) {
    if (!content.is(scope))
      scope = content('anonymous').init(scope);

    return nodeFn(scope, el);
  }

  return fn;
}

// XXX: compileNode(node, nodeList, directiveIndex)
function compileNode(node, index, nodeList, start) {
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

function compileEach(nodeList) {
  var fns = [];
  // doesn't cache `length` b/c items can be removed
  //for (var i = 0, n = children.length; i < n; i++) {
  for (var i = 0; i < nodeList.length; i++) {
    fns.push(compileNode(nodeList[i], i, nodeList));
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

    // XXX: if obj.element
    if (obj.template) {
      var templateEl = obj.templateEl.cloneNode(true);
      // XXX: replace <content> tags with the stuff from the current `node`.

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
      //node = comment;
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
      var tag = node.nodeName.toLowerCase();
      appendDirective(tag, 'element', node, directives, attrs);
      appendAttributeDirectives(node, directives, attrs, tag);
      break;
    case 3: // text node
      // node.nodeValue
      appendDirective('interpolation', 'attribute', directives, node, attrs);
      break;
    case 8: // comment node
      break;
  }

  return directives.length
    ? directives.sort(priority)
    : directives;
}

function appendAttributeDirectives(node, directives, attrs, tag) {
  var attr;
  for (var i = 0, n = node.attributes.length; i < n; i++) {
    attr = node.attributes[i];
    // http://www.w3schools.com/dom/prop_attr_specified.asp
    if (!attr.specified || attrs[attr.name]) continue;
    appendDirective(attr.name, 'attribute', node, directives, attrs, tag);
    // if the expression wasn't added
    if (!attrs[attr.name]) attrs[attr.name] = attr.value;
  }
}

/**
 * Add directive.
 *
 * @param {String} name The directive's name.
 * @param {Array} directives The list of directives.
 */

function appendDirective(name, type, node, directives, attrs, tag) {
  var Directive = directive.collection[name];
  if (Directive && Directive.prototype[type]) {
    if (!tag || !Directive.tag || (tag === Directive.tag)) {
      directives.push(new Directive(node, attrs)); 
    }
  }
}

/**
 * Creates a template function for node children
 * in an isolated JS scope.
 */

function createEachFn(fns) {
  var n = fns.length, i;

  function eachFn(scope, children, returnNode) {
    var current = [];
    for (i = 0; i < n; i++) {
      current.push(children[i]);
    }

    for (i = 0; i < n; i++) {
      // XXX: not sure this is correct.
      // XXX: should pass in `children` and `i` instead,
      //      in case something is replaced
      // if (current[i] !== children[i]) XXX: search for it, so we know the index
      fns[i](scope, current[i]);
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

  function directivesFn(scope, node, childNodes, i) {
    // if we've moved this node around, then
    // it should still have access to the original scope.
    if (node.__scope__)
      scope = node.__scope__;
    
    for (i = 0; i < n; i++) {
      // XXX: instead of `node`, do something like `childNodes[i]`
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