"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

var XmlStream = require('../../../utils/xml-stream');

var BaseXform = require('../base-xform');

var VmlNoteXform = require('./vml-note-xform'); // This class is (currently) single purposed to insert the triangle
// drawing icons on commented cells


var VmlNotesXform =
/*#__PURE__*/
function (_BaseXform) {
  _inherits(VmlNotesXform, _BaseXform);

  function VmlNotesXform() {
    _classCallCheck(this, VmlNotesXform);

    return _possibleConstructorReturn(this, _getPrototypeOf(VmlNotesXform).apply(this, arguments));
  }

  _createClass(VmlNotesXform, [{
    key: "render",
    value: function render(xmlStream, model) {
      xmlStream.openXml(XmlStream.StdDocAttributes);
      xmlStream.openNode(this.tag, VmlNotesXform.DRAWING_ATTRIBUTES);
      xmlStream.openNode('o:shapelayout', {
        'v:ext': 'edit'
      });
      xmlStream.leafNode('o:idmap', {
        'v:ext': 'edit',
        data: 1
      });
      xmlStream.closeNode();
      xmlStream.openNode('v:shapetype', {
        id: '_x0000_t202',
        coordsize: '21600,21600',
        'o:spt': 202,
        path: 'm,l,21600r21600,l21600,xe'
      });
      xmlStream.leafNode('v:stroke', {
        joinstyle: 'miter'
      });
      xmlStream.leafNode('v:path', {
        gradientshapeok: 't',
        'o:connecttype': 'rect'
      });
      xmlStream.closeNode();
      model.comments.forEach(function (item, index) {
        VmlNotesXform.vmlCommentXform.render(xmlStream, item, index);
      });
      xmlStream.closeNode();
    }
  }, {
    key: "parseOpen",
    value: function parseOpen(node) {
      if (this.parser) {
        this.parser.parseOpen(node);
        return true;
      }

      switch (node.name) {
        case this.tag:
          this.reset();
          this.model = {
            anchors: []
          };
          break;

        default:
          this.parser = this.map[node.name];

          if (this.parser) {
            this.parser.parseOpen(node);
          }

          break;
      }

      return true;
    }
  }, {
    key: "parseText",
    value: function parseText(text) {
      if (this.parser) {
        this.parser.parseText(text);
      }
    }
  }, {
    key: "parseClose",
    value: function parseClose(name) {
      if (this.parser) {
        if (!this.parser.parseClose(name)) {
          this.model.anchors.push(this.parser.model);
          this.parser = undefined;
        }

        return true;
      }

      switch (name) {
        case this.tag:
          return false;

        default:
          // could be some unrecognised tags
          return true;
      }
    }
  }, {
    key: "reconcile",
    value: function reconcile(model, options) {
      var _this = this;

      model.anchors.forEach(function (anchor) {
        if (anchor.br) {
          _this.map['xdr:twoCellAnchor'].reconcile(anchor, options);
        } else {
          _this.map['xdr:oneCellAnchor'].reconcile(anchor, options);
        }
      });
    }
  }, {
    key: "tag",
    get: function get() {
      return 'xml';
    }
  }]);

  return VmlNotesXform;
}(BaseXform);

VmlNotesXform.DRAWING_ATTRIBUTES = {
  'xmlns:v': 'urn:schemas-microsoft-com:vml',
  'xmlns:o': 'urn:schemas-microsoft-com:office:office',
  'xmlns:x': 'urn:schemas-microsoft-com:office:excel'
};
VmlNotesXform.vmlCommentXform = new VmlNoteXform();
module.exports = VmlNotesXform;
//# sourceMappingURL=vml-notes-xform.js.map
