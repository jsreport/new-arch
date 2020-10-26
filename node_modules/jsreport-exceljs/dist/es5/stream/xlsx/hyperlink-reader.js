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

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

var Sax = require('sax');

var Enums = require('../../doc/enums');

var RelType = require('../../xlsx/rel-type');

var HyperlinkReader =
/*#__PURE__*/
function (_EventEmitter) {
  _inherits(HyperlinkReader, _EventEmitter);

  function HyperlinkReader(workbook, id) {
    var _this;

    _classCallCheck(this, HyperlinkReader);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(HyperlinkReader).call(this)); // in a workbook, each sheet will have a number

    _this.id = id;
    _this._workbook = workbook;
    return _this;
  }

  _createClass(HyperlinkReader, [{
    key: "each",
    value: function each(fn) {
      return this.hyperlinks.forEach(fn);
    }
  }, {
    key: "read",
    value: function read(entry, options) {
      var _this2 = this;

      var emitHyperlinks = false;
      var hyperlinks = null;

      switch (options.hyperlinks) {
        case 'emit':
          emitHyperlinks = true;
          break;

        case 'cache':
          this.hyperlinks = hyperlinks = {};
          break;

        default:
          break;
      }

      if (!emitHyperlinks && !hyperlinks) {
        entry.autodrain();
        this.emit('finished');
        return;
      }

      var parser = Sax.createStream(true, {});
      parser.on('opentag', function (node) {
        if (node.name === 'Relationship') {
          var rId = node.attributes.Id;

          switch (node.attributes.Type) {
            case RelType.Hyperlink:
              {
                var relationship = {
                  type: Enums.RelationshipType.Styles,
                  rId: rId,
                  target: node.attributes.Target,
                  targetMode: node.attributes.TargetMode
                };

                if (emitHyperlinks) {
                  _this2.emit('hyperlink', relationship);
                } else {
                  hyperlinks[relationship.rId] = relationship;
                }
              }
              break;

            default:
              break;
          }
        }
      });
      parser.on('end', function () {
        _this2.emit('finished');
      }); // create a down-stream flow-control to regulate the stream

      var flowControl = this._workbook.flowControl.createChild();

      flowControl.pipe(parser, {
        sync: true
      });
      entry.pipe(flowControl);
    }
  }, {
    key: "count",
    get: function get() {
      return this.hyperlinks && this.hyperlinks.length || 0;
    }
  }]);

  return HyperlinkReader;
}(EventEmitter);

module.exports = HyperlinkReader;
//# sourceMappingURL=hyperlink-reader.js.map
