/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

// minimal template polyfill
(function() {
  var needsTemplate = (typeof HTMLTemplateElement === 'undefined');
  // NOTE: Patch document.importNode to work around IE11 bug that
  // casues children of a document fragment imported while
  // there is a mutation observer to not have a parentNode (!?!)
  // This needs to happen *after* patching importNode to fix template cloning
  if (/Trident/.test(navigator.userAgent)) {
    (function() {
      var importNode = document.importNode;
      document.importNode = function() {
        var n = importNode.apply(document, arguments);
        // Copy all children to a new document fragment since
        // this one may be broken
        if (n.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          var f = document.createDocumentFragment();
          f.appendChild(n);
          return f;
        } else {
          return n;
        }
      };
    })();
  }

  // returns true if nested templates cannot be cloned (they cannot be on
  // some impl's like Safari 8 and Edge)
  // OR if cloning a document fragment does not result in a document fragment
  var needsCloning = (function() {
    if (!needsTemplate) {
      var t = document.createElement('template');
      var t2 = document.createElement('template');
      t2.content.appendChild(document.createElement('div'));
      t.content.appendChild(t2);
      var clone = t.cloneNode(true);
      return (clone.content.childNodes.length === 0 || clone.content.firstChild.content.childNodes.length === 0
        || !(document.createDocumentFragment().cloneNode() instanceof DocumentFragment));
    }
  })();

  var TEMPLATE_TAG = 'template';
  var TemplateImpl = function() {};

  if (needsTemplate) {

    var contentDoc = document.implementation.createHTMLDocument('template');
    var canDecorate = true;

    var templateStyle = document.createElement('style');
    templateStyle.textContent = TEMPLATE_TAG + '{display:none;}';

    var head = document.head;
    head.insertBefore(templateStyle, head.firstElementChild);

    /**
      Provides a minimal shim for the <template> element.
    */
    TemplateImpl.prototype = Object.create(HTMLElement.prototype);

    /**
      The `decorate` method moves element children to the template's `content`.
      NOTE: there is no support for dynamically adding elements to templates.
    */
    TemplateImpl.decorate = function(template) {
      // if the template is decorated, return fast
      if (template.content) {
        return;
      }
      template.content = contentDoc.createDocumentFragment();
      var child;
      while (child = template.firstChild) {
        template.content.appendChild(child);
      }

      template.cloneNode = function(deep) {
        return TemplateImpl.cloneNode(this, deep);
      };

      // add innerHTML to template, if possible
      // Note: this throws on Safari 7
      if (canDecorate) {
        try {
          Object.defineProperty(template, 'innerHTML', {
            get: function() {
              var o = [];
              var wrapper = contentDoc.createElement('div');
              for (var e = this.content.firstChild; e; e = e.nextSibling) {
                if (e.nodeType === Node.ELEMENT_NODE) o.push(e.outerHTML);
                else {
                  wrapper.appendChild(e.cloneNode(true));
                  o.push(wrapper.innerHTML);
                  wrapper.textContent = '';
                }
              }
              return o.join('');
            },
            set: function(text) {
              var wrap = findWrap(text);
              var body = contentDoc.body;
              body.innerHTML = [wrap[1], text, wrap[2]].join('');
              TemplateImpl.bootstrap(contentDoc);
              while (this.content.firstChild) {
                this.content.removeChild(this.content.firstChild);
              }
              var j = wrap[0];
              while (j--) {
                body = body.lastChild;
              }
              while (body.firstChild) {
                this.content.appendChild(body.firstChild);
              }
            },
            configurable: true
          });

        } catch (err) {
          canDecorate = false;
        }
      }
      // bootstrap recursively
      TemplateImpl.bootstrap(template.content);
    };

    var wrapMap = {
      // Support: IE <=9 only
      option: [ 1, "<select multiple='multiple'>", "</select>" ],
      // XHTML parsers do not magically insert elements in the
      // same way that tag soup parsers do. So we cannot shorten
      // this by omitting <tbody> or other required elements.
      thead: [ 1, "<table>", "</table>" ],
      col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
      tr: [ 2, "<table><tbody>", "</tbody></table>" ],
      td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
      _default: [ 0, "", "" ]
    };

    // Support: IE <=9 only
    wrapMap.optgroup = wrapMap.option;

    wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
    wrapMap.th = wrapMap.td;

    var rTagName = /<([a-z][^\/\0>\x20\t\r\n\f]+)/i;

    function findWrap(text) {
      // https://github.com/jquery/jquery/blob/a6b07052/src/manipulation/var/rtagName.js
      var tag = (rTagName.exec(text) || [ "", "" ])[1].toLowerCase();
      return wrapMap[tag] || wrapMap._default;
    }

    /**
      The `bootstrap` method is called automatically and "fixes" all
      <template> elements in the document referenced by the `doc` argument.
    */
    TemplateImpl.bootstrap = function(doc) {
      var templates = doc.querySelectorAll(TEMPLATE_TAG);
      for (var i=0, l=templates.length, t; (i<l) && (t=templates[i]); i++) {
        TemplateImpl.decorate(t);
      }
    };

    // auto-bootstrapping for main document
    document.addEventListener('DOMContentLoaded', function() {
      TemplateImpl.bootstrap(document);
    });

    // Patch document.createElement to ensure newly created templates have content
    var createElement = document.createElement;
    document.createElement = function() {
      'use strict';
      var el = createElement.apply(document, arguments);
      if (el.localName === 'template') {
        TemplateImpl.decorate(el);
      }
      return el;
    };
  }

  // make cloning/importing work!
  if (needsTemplate || needsCloning) {
    // NOTE: we rely on this cloneNode not causing element upgrade.
    // This means this polyfill must load before the CE polyfill and
    // this would need to be re-worked if a browser supports native CE
    // but not <template>.
    var nativeCloneNode = Node.prototype.cloneNode;

    TemplateImpl.cloneNode = function(template, deep) {
      var clone = nativeCloneNode.call(template, false);
      // NOTE: decorate doesn't auto-fix children because they are already
      // decorated so they need special clone fixup.
      if (this.decorate) {
        this.decorate(clone);
      }
      if (deep) {
        // NOTE: use native clone node to make sure CE's wrapped
        // cloneNode does not cause elements to upgrade.
        clone.content.appendChild(
            nativeCloneNode.call(template.content, true));
        // now ensure nested templates are cloned correctly.
        this.fixClonedDom(clone.content, template.content);
      }
      return clone;
    };

    // Given a source and cloned subtree, find <template>'s in the cloned
    // subtree and replace them with cloned <template>'s from source.
    // We must do this because only the source templates have proper .content.
    TemplateImpl.fixClonedDom = function(clone, source) {
      // do nothing if cloned node is not an element
      if (!source.querySelectorAll) return;
      // these two lists should be coincident
      var s$ = source.querySelectorAll(TEMPLATE_TAG);
      var t$ = clone.querySelectorAll(TEMPLATE_TAG);
      for (var i=0, l=t$.length, t, s; i<l; i++) {
        s = s$[i];
        t = t$[i];
        if (this.decorate) {
          this.decorate(s);
        }
        t.parentNode.replaceChild(s.cloneNode(true), t);
      }
    };

    var originalImportNode = document.importNode;

    // override all cloning to fix the cloned subtree to contain properly
    // cloned templates.
    Node.prototype.cloneNode = function(deep) {
      var dom;
      // workaround for Edge bug cloning documentFragments
      // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8619646/
      if (this instanceof DocumentFragment) {
        if (!deep) {
          return this.ownerDocument.createDocumentFragment();
        } else {
          dom = this.ownerDocument.importNode(this, true);
        }
      } else {
        dom = nativeCloneNode.call(this, deep);
      }
      // template.content is cloned iff `deep`.
      if (deep) {
        TemplateImpl.fixClonedDom(dom, this);
      }
      return dom;
    };

    // NOTE: we are cloning instead of importing <template>'s.
    // However, the ownerDocument of the cloned template will be correct!
    // This is because the native import node creates the right document owned
    // subtree and `fixClonedDom` inserts cloned templates into this subtree,
    // thus updating the owner doc.
    document.importNode = function(element, deep) {
      if (element.localName === TEMPLATE_TAG) {
        return TemplateImpl.cloneNode(element, deep);
      } else {
        var dom = originalImportNode.call(document, element, deep);
        if (deep) {
          TemplateImpl.fixClonedDom(dom, element);
        }
        return dom;
      }
    };

    if (needsCloning) {
      HTMLTemplateElement.prototype.cloneNode = function(deep) {
        return TemplateImpl.cloneNode(this, deep);
      };
    }
  }

  if (needsTemplate) {
    window.HTMLTemplateElement = TemplateImpl;
  }

})();
