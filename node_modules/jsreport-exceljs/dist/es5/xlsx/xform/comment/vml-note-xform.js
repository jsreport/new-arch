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

var BaseXform = require('../base-xform');

var VmlAnchorXform = require('./vml-anchor-xform'); // render the triangle in the cell for the comment


var VmlNoteXform =
/*#__PURE__*/
function (_BaseXform) {
  _inherits(VmlNoteXform, _BaseXform);

  function VmlNoteXform() {
    _classCallCheck(this, VmlNoteXform);

    return _possibleConstructorReturn(this, _getPrototypeOf(VmlNoteXform).apply(this, arguments));
  }

  _createClass(VmlNoteXform, [{
    key: "render",
    value: function render(xmlStream, model, index) {
      xmlStream.openNode('v:shape', VmlNoteXform.V_SHAPE_ATTRIBUTES(index));
      xmlStream.leafNode('v:fill', {
        color2: 'infoBackground [80]'
      });
      xmlStream.leafNode('v:shadow', {
        color: 'none [81]',
        obscured: 't'
      });
      xmlStream.leafNode('v:path', {
        'o:connecttype': 'none'
      });
      xmlStream.openNode('v:textbox', {
        style: 'mso-direction-alt:auto'
      });
      xmlStream.leafNode('div', {
        style: 'text-align:left'
      });
      xmlStream.closeNode();
      xmlStream.openNode('x:ClientData', {
        ObjectType: 'Note'
      });
      xmlStream.leafNode('x:MoveWithCells');
      xmlStream.leafNode('x:SizeWithCells');
      VmlNoteXform.vmlAnchorXform.render(xmlStream, model);
      xmlStream.leafNode('x:AutoFill', null, 'False');
      xmlStream.leafNode('x:Row', null, model.refAddress.row - 1);
      xmlStream.leafNode('x:Column', null, model.refAddress.col - 1);
      xmlStream.closeNode();
      xmlStream.closeNode();
    }
  }, {
    key: "tag",
    get: function get() {
      return 'v:shape';
    }
  }]);

  return VmlNoteXform;
}(BaseXform);

module.exports = VmlNoteXform;

VmlNoteXform.V_SHAPE_ATTRIBUTES = function (index) {
  return {
    id: "_x0000_s".concat(1025 + index),
    type: '#_x0000_t202',
    style: 'position:absolute; margin-left:105.3pt;margin-top:10.5pt;width:97.8pt;height:59.1pt;z-index:1;visibility:hidden',
    fillcolor: 'infoBackground [80]',
    strokecolor: 'none [81]',
    'o:insetmode': 'auto'
  };
};

VmlNoteXform.vmlAnchorXform = new VmlAnchorXform();
//# sourceMappingURL=vml-note-xform.js.map
